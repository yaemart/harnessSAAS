import { Hono } from 'hono';
import { prisma } from './db.js';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { emitMdmEvent } from './mdm-events.js';
import { env } from './env.js';

// ── Helpers ──────────────────────────────────────────────

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return fn(tx as typeof prisma);
    });
}

function tid(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }) {
    return c.req.header('x-tenant-id') ?? c.req.query('tenantId') ?? null;
}

const mdm = new Hono();

type MappingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'SOFT_REVOKED';

function nowIso() {
    return new Date().toISOString();
}

async function publishCostUpdatedEvent(input: {
    tenantId: string;
    costVersionId: string;
    productGlobalId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    sourceSystem: string | null;
}) {
    await emitMdmEvent({
        type: 'entity.cost.updated',
        tenantId: input.tenantId,
        timestamp: nowIso(),
        source: 'mdm-api',
        payload: {
            costVersionId: input.costVersionId,
            productGlobalId: input.productGlobalId,
            effectiveFrom: input.effectiveFrom.toISOString(),
            effectiveTo: input.effectiveTo ? input.effectiveTo.toISOString() : null,
            sourceSystem: input.sourceSystem,
        },
    });
}

function parseOptionalNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return undefined;
    return num;
}

async function createCostVersion(input: {
    tx: typeof prisma;
    tenantId: string;
    productGlobalId: string;
    changedBy: string;
    purchaseCost?: number | null;
    shippingCost?: number | null;
    fbaFee?: number | null;
    otherCost?: number | null;
    currency?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    sourceSystem?: string | null;
    sourceRef?: string | null;
    reason?: string | null;
}) {
    const effectiveFrom = input.effectiveFrom ?? new Date();
    const effectiveTo = input.effectiveTo ?? null;

    await input.tx.costVersion.updateMany({
        where: {
            tenantId: input.tenantId,
            productGlobalId: input.productGlobalId,
            status: 'ACTIVE',
            effectiveTo: null,
            effectiveFrom: { lte: effectiveFrom },
        },
        data: {
            effectiveTo: effectiveFrom,
        },
    });

    return input.tx.costVersion.create({
        data: {
            tenantId: input.tenantId,
            productGlobalId: input.productGlobalId,
            purchaseCost: input.purchaseCost ?? null,
            shippingCost: input.shippingCost ?? null,
            fbaFee: input.fbaFee ?? null,
            otherCost: input.otherCost ?? null,
            currency: input.currency ?? 'USD',
            effectiveFrom,
            effectiveTo,
            status: 'ACTIVE',
            sourceSystem: input.sourceSystem ?? null,
            sourceRef: input.sourceRef ?? null,
            changedBy: input.changedBy,
            reason: input.reason ?? null,
        },
    });
}

async function appendMappingHistory(input: {
    tx: typeof prisma;
    mappingId: string;
    tenantId: string;
    action: string;
    oldStatus?: MappingStatus | null;
    newStatus?: MappingStatus | null;
    changedBy: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
}) {
    await input.tx.mappingHistory.create({
        data: {
            mappingId: input.mappingId,
            tenantId: input.tenantId,
            action: input.action,
            oldStatus: input.oldStatus ?? null,
            newStatus: input.newStatus ?? null,
            changedBy: input.changedBy,
            reason: input.reason ?? null,
            metadata: (input.metadata as never) ?? undefined,
        },
    });
}

async function upsertApprovedExternalIdMapping(input: {
    tx: typeof prisma;
    tenantId: string;
    entityType: 'PRODUCT' | 'LISTING';
    globalId: string;
    sourceSystem: string;
    externalId: string;
    externalSubId?: string | null;
    actor: string;
    reason?: string | null;
}) {
    const existing = await input.tx.externalIdMapping.findMany({
        where: {
            tenantId: input.tenantId,
            entityType: input.entityType,
            sourceSystem: input.sourceSystem,
            externalId: input.externalId,
            externalSubId: input.externalSubId ?? null,
        },
        orderBy: { createdAt: 'desc' },
    });

    let target = existing.find((x) => x.globalId === input.globalId) ?? existing[0];

    if (!target) {
        const created = await input.tx.externalIdMapping.create({
            data: {
                tenantId: input.tenantId,
                entityType: input.entityType,
                globalId: input.globalId,
                sourceSystem: input.sourceSystem,
                externalId: input.externalId,
                externalSubId: input.externalSubId ?? null,
                status: 'APPROVED',
                createdBy: input.actor,
                approvedBy: input.actor,
                approvedAt: new Date(),
                reason: input.reason ?? null,
            },
        });
        await appendMappingHistory({
            tx: input.tx,
            mappingId: created.id,
            tenantId: input.tenantId,
            action: 'APPROVED',
            oldStatus: null,
            newStatus: 'APPROVED',
            changedBy: input.actor,
            reason: input.reason ?? null,
        });
        return created;
    }

    const oldStatus = target.status as MappingStatus;
    target = await input.tx.externalIdMapping.update({
        where: { id: target.id },
        data: {
            globalId: input.globalId,
            status: 'APPROVED',
            approvedBy: input.actor,
            approvedAt: new Date(),
            reason: input.reason ?? target.reason,
            version: { increment: 1 },
        },
    });
    await appendMappingHistory({
        tx: input.tx,
        mappingId: target.id,
        tenantId: input.tenantId,
        action: 'APPROVED',
        oldStatus,
        newStatus: 'APPROVED',
        changedBy: input.actor,
        reason: input.reason ?? null,
    });

    const conflicts = existing.filter((x) => x.id !== target.id && x.status === 'APPROVED');
    for (const c of conflicts) {
        const soft = await input.tx.externalIdMapping.update({
            where: { id: c.id },
            data: {
                status: 'SOFT_REVOKED',
                revokedBy: 'system:auto-conflict',
                revokedAt: new Date(),
                reason: c.reason ?? 'auto soft revoke during dual-write conflict handling',
                version: { increment: 1 },
            },
        });
        await appendMappingHistory({
            tx: input.tx,
            mappingId: soft.id,
            tenantId: input.tenantId,
            action: 'SOFT_REVOKED',
            oldStatus: 'APPROVED',
            newStatus: 'SOFT_REVOKED',
            changedBy: 'system:auto-conflict',
            reason: 'approved conflict detected',
        });
    }

    return target;
}

async function upsertRejectedExternalIdMapping(input: {
    tx: typeof prisma;
    tenantId: string;
    entityType: 'PRODUCT' | 'LISTING';
    sourceSystem: string;
    externalId: string;
    externalSubId?: string | null;
    actor: string;
    reason?: string | null;
}) {
    const existing = await input.tx.externalIdMapping.findMany({
        where: {
            tenantId: input.tenantId,
            entityType: input.entityType,
            sourceSystem: input.sourceSystem,
            externalId: input.externalId,
            externalSubId: input.externalSubId ?? null,
        },
        orderBy: { createdAt: 'desc' },
    });

    let target = existing[0];
    if (!target) {
        const created = await input.tx.externalIdMapping.create({
            data: {
                tenantId: input.tenantId,
                entityType: input.entityType,
                globalId: crypto.randomUUID(),
                sourceSystem: input.sourceSystem,
                externalId: input.externalId,
                externalSubId: input.externalSubId ?? null,
                status: 'REJECTED',
                createdBy: input.actor,
                reason: input.reason ?? 'rejected in dual-write route',
            },
        });
        await appendMappingHistory({
            tx: input.tx,
            mappingId: created.id,
            tenantId: input.tenantId,
            action: 'REJECTED',
            oldStatus: null,
            newStatus: 'REJECTED',
            changedBy: input.actor,
            reason: input.reason ?? null,
        });
        return created;
    }

    const oldStatus = target.status as MappingStatus;
    target = await input.tx.externalIdMapping.update({
        where: { id: target.id },
        data: {
            status: 'REJECTED',
            reason: input.reason ?? target.reason,
            version: { increment: 1 },
        },
    });
    await appendMappingHistory({
        tx: input.tx,
        mappingId: target.id,
        tenantId: input.tenantId,
        action: 'REJECTED',
        oldStatus,
        newStatus: 'REJECTED',
        changedBy: input.actor,
        reason: input.reason ?? null,
    });
    return target;
}

// ══════════════════════════════════════════════════════════
//  Products (DNA Layer)
// ══════════════════════════════════════════════════════════

mdm.get('/products', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { brandId, categoryId, supplierId, lifecycle } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.product.findMany({
            where: {
                tenantId,
                brandId: brandId || undefined,
                categoryId: categoryId || undefined,
                supplierId: supplierId || undefined,
                lifecycleStage: lifecycle || undefined,
            },
            include: {
                brand: true,
                category: true,
                supplier: true,
                commodities: {
                    include: {
                        market: true,
                        listings: {
                            include: { platform: true }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.get('/products/:id', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const item = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: {
                brand: true,
                category: { include: { attributeSchemas: true } },
                supplier: true,
                commodities: { include: { market: true, media: true } },
                externalSkuMappings: true,
            },
        }),
    );
    if (!item) return c.json({ error: 'not found' }, 404);
    return c.json({ item });
});

mdm.post('/products', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const changedBy = c.req.header('x-user-id') ?? 'system';
    const body = await c.req.json<{
        brandId: string; categoryId: string; sku: string; name: string;
        supplierId?: string; upc?: string; asin?: string;
        costPrice?: number; msrp?: number; weight?: number;
        dimensions?: Record<string, unknown>; tags?: string[];
        imageUrls?: string[]; attributes?: Record<string, unknown>;
    }>();

    const costPrice = parseOptionalNumber(body.costPrice);
    const msrp = parseOptionalNumber(body.msrp);
    const weight = parseOptionalNumber(body.weight);
    if (body.costPrice !== undefined && costPrice === undefined) {
        return c.json({ error: 'costPrice must be a valid number' }, 400);
    }
    if (body.msrp !== undefined && msrp === undefined) {
        return c.json({ error: 'msrp must be a valid number' }, 400);
    }
    if (body.weight !== undefined && weight === undefined) {
        return c.json({ error: 'weight must be a valid number' }, 400);
    }

    try {
        const result = await withTenant(tenantId, async (tx) => {
            const item = await tx.product.create({
                data: {
                    tenantId,
                    brandId: body.brandId,
                    categoryId: body.categoryId,
                    sku: body.sku,
                    name: body.name,
                    supplierId: body.supplierId || null,
                    upc: body.upc || null,
                    asin: body.asin || null,
                    costPrice: costPrice ?? null,
                    msrp: msrp ?? null,
                    weight: weight ?? null,
                    dimensions: (body.dimensions as any) || undefined,
                    tags: body.tags ?? [],
                    imageUrls: body.imageUrls ?? [],
                    attributes: (body.attributes as any) || undefined,
                },
                include: { brand: true, category: true },
            });

            let costVersion: Awaited<ReturnType<typeof createCostVersion>> | null = null;
            if (costPrice !== undefined && costPrice !== null) {
                costVersion = await createCostVersion({
                    tx,
                    tenantId,
                    productGlobalId: item.id,
                    changedBy,
                    purchaseCost: costPrice,
                    sourceSystem: 'product_create',
                    sourceRef: item.id,
                    reason: 'seeded from product costPrice',
                });
            }

            return { item, costVersion };
        });

        if (result.costVersion) {
            await publishCostUpdatedEvent({
                tenantId,
                costVersionId: result.costVersion.id,
                productGlobalId: result.costVersion.productGlobalId,
                effectiveFrom: result.costVersion.effectiveFrom,
                effectiveTo: result.costVersion.effectiveTo,
                sourceSystem: result.costVersion.sourceSystem,
            });
        }

        return c.json({ item: result.item }, 201);
    } catch (error) {
        console.error("DEBUG PRODUCT POST ERROR:", error);
        return c.json({ error: String(error) }, 500);
    }
});

mdm.put('/products/:id', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<Record<string, unknown>>();
    const changedBy = c.req.header('x-user-id') ?? 'system';
    const hasCostPriceField = Object.prototype.hasOwnProperty.call(body, 'costPrice');
    const parsedCostPrice = hasCostPriceField ? parseOptionalNumber(body.costPrice) : undefined;
    if (hasCostPriceField && parsedCostPrice === undefined) {
        return c.json({ error: 'costPrice must be a valid number' }, 400);
    }
    const updateBody: Record<string, unknown> = { ...body };
    if (hasCostPriceField) updateBody.costPrice = parsedCostPrice;

    // Fetch old values for audit log
    const old = await withTenant(tenantId, (tx) => tx.product.findFirst({ where: { id, tenantId } }));
    if (!old) return c.json({ error: 'not found' }, 404);

    const result = await withTenant(tenantId, async (tx) => {
        const item = await tx.product.update({ where: { id, tenantId }, data: updateBody as never });

        const oldCostRaw = old.costPrice === null ? null : Number(old.costPrice);
        const newCostRaw = item.costPrice === null ? null : Number(item.costPrice);
        const costChanged = hasCostPriceField && oldCostRaw !== newCostRaw;

        let costVersion: Awaited<ReturnType<typeof createCostVersion>> | null = null;
        if (costChanged) {
            costVersion = await createCostVersion({
                tx,
                tenantId,
                productGlobalId: id,
                changedBy,
                purchaseCost: newCostRaw,
                sourceSystem: 'product_update',
                sourceRef: id,
                reason: 'derived from product costPrice update',
            });
        }
        return { item, costVersion };
    });
    const item = result.item;

    // Create change log entries
    for (const key of Object.keys(updateBody)) {
        const oldVal = (old as Record<string, unknown>)[key];
        const newVal = (item as Record<string, unknown>)[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            await withTenant(tenantId, (tx) =>
                tx.productChangeLog.create({
                    data: { tenantId, productId: id, field: key, oldValue: oldVal as never, newValue: newVal as never, changedBy, source: 'manual' },
                }),
            );
        }
    }

    if (result.costVersion) {
        await publishCostUpdatedEvent({
            tenantId,
            costVersionId: result.costVersion.id,
            productGlobalId: result.costVersion.productGlobalId,
            effectiveFrom: result.costVersion.effectiveFrom,
            effectiveTo: result.costVersion.effectiveTo,
            sourceSystem: result.costVersion.sourceSystem,
        });
    }

    return c.json({ item });
});

mdm.get('/products/:id/changelog', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const items = await withTenant(tenantId, (tx) =>
        tx.productChangeLog.findMany({ where: { tenantId, productId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    );
    return c.json({ items });
});

mdm.get('/products/:id/external-skus', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const items = await withTenant(tenantId, (tx) =>
        tx.externalSkuMapping.findMany({ where: { tenantId, productId: id } }),
    );
    return c.json({ items });
});

mdm.get('/products/:id/cost-versions', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50)));

    const items = await withTenant(tenantId, (tx) =>
        tx.costVersion.findMany({
            where: { tenantId, productGlobalId: id },
            orderBy: { effectiveFrom: 'desc' },
            take: limit,
        }),
    );
    return c.json({ items });
});

mdm.get('/cost-versions/approved', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const productGlobalId = c.req.query('productGlobalId')?.trim();
    const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 100)));

    const where: Prisma.Sql[] = [Prisma.sql`"tenantId" = ${tenantId}`];
    if (productGlobalId) where.push(Prisma.sql`"productGlobalId" = ${productGlobalId}`);

    const items = await withTenant(tenantId, (tx) =>
        tx.$queryRaw<Array<{
            id: string;
            tenantId: string;
            productGlobalId: string;
            purchaseCost: string | null;
            shippingCost: string | null;
            fbaFee: string | null;
            otherCost: string | null;
            currency: string;
            effectiveFrom: Date;
            effectiveTo: Date | null;
            updatedAt: Date;
        }>>(
            Prisma.sql`
                SELECT
                    "id",
                    "tenantId",
                    "productGlobalId",
                    "purchaseCost",
                    "shippingCost",
                    "fbaFee",
                    "otherCost",
                    "currency",
                    "effectiveFrom",
                    "effectiveTo",
                    "updatedAt"
                FROM "approved_cost_version"
                WHERE ${Prisma.join(where, ' AND ')}
                ORDER BY "updatedAt" DESC
                LIMIT ${limit}
            `,
        ),
    );

    return c.json({ items });
});

mdm.post('/products/:id/cost-versions', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const changedBy = c.req.header('x-user-id') ?? 'system';
    const body = await c.req.json<{
        purchaseCost?: number | string | null;
        shippingCost?: number | string | null;
        fbaFee?: number | string | null;
        otherCost?: number | string | null;
        currency?: string;
        effectiveFrom?: string;
        effectiveTo?: string | null;
        sourceSystem?: string;
        sourceRef?: string;
        reason?: string;
    }>();

    const purchaseCost = parseOptionalNumber(body.purchaseCost);
    const shippingCost = parseOptionalNumber(body.shippingCost);
    const fbaFee = parseOptionalNumber(body.fbaFee);
    const otherCost = parseOptionalNumber(body.otherCost);
    if (
        (body.purchaseCost !== undefined && purchaseCost === undefined) ||
        (body.shippingCost !== undefined && shippingCost === undefined) ||
        (body.fbaFee !== undefined && fbaFee === undefined) ||
        (body.otherCost !== undefined && otherCost === undefined)
    ) {
        return c.json({ error: 'cost values must be valid numbers' }, 400);
    }

    if ([purchaseCost, shippingCost, fbaFee, otherCost].every((x) => x === undefined || x === null)) {
        return c.json({ error: 'at least one non-null cost field is required' }, 400);
    }

    const now = new Date();
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime()) || (effectiveTo && Number.isNaN(effectiveTo.getTime()))) {
        return c.json({ error: 'invalid effectiveFrom/effectiveTo' }, 400);
    }
    if (effectiveTo && effectiveTo <= effectiveFrom) {
        return c.json({ error: 'effectiveTo must be greater than effectiveFrom' }, 400);
    }
    if (effectiveFrom < now && !effectiveTo) {
        return c.json({ error: 'historical cost version requires effectiveTo to avoid overlap' }, 400);
    }

    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({ where: { id, tenantId }, select: { id: true } }),
    );
    if (!product) return c.json({ error: 'Product not found' }, 404);

    const item = await withTenant(tenantId, (tx) =>
        createCostVersion({
            tx,
            tenantId,
            productGlobalId: id,
            changedBy,
            purchaseCost,
            shippingCost,
            fbaFee,
            otherCost,
            currency: body.currency ?? 'USD',
            effectiveFrom,
            effectiveTo,
            sourceSystem: body.sourceSystem ?? 'manual_cost_version',
            sourceRef: body.sourceRef ?? null,
            reason: body.reason ?? 'manual cost version create',
        }),
    );

    await publishCostUpdatedEvent({
        tenantId,
        costVersionId: item.id,
        productGlobalId: item.productGlobalId,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        sourceSystem: item.sourceSystem,
    });

    return c.json({ item }, 201);
});

mdm.post('/products/:id/cost-versions/:costVersionId/revoke', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const productId = c.req.param('id');
    const costVersionId = c.req.param('costVersionId');
    const changedBy = c.req.header('x-user-id') ?? 'system';
    const body = await c.req.json<{ reason?: string; effectiveTo?: string }>().catch(() => ({} as { reason?: string; effectiveTo?: string }));
    const revokeAt = body.effectiveTo ? new Date(body.effectiveTo) : new Date();
    if (Number.isNaN(revokeAt.getTime())) {
        return c.json({ error: 'invalid effectiveTo' }, 400);
    }

    const result = await withTenant(tenantId, async (tx) => {
        const current = await tx.costVersion.findFirst({
            where: { id: costVersionId, tenantId, productGlobalId: productId },
        });
        if (!current) return { error: { error: 'CostVersion not found' }, status: 404 as const };

        const nextEffectiveTo =
            current.effectiveTo && current.effectiveTo < revokeAt
                ? current.effectiveTo
                : revokeAt;
        const item = await tx.costVersion.update({
            where: { id: current.id },
            data: {
                status: 'INACTIVE',
                effectiveTo: nextEffectiveTo,
                changedBy,
                reason: body.reason ?? current.reason ?? 'manual revoke',
            },
        });
        return { item, status: 200 as const };
    });

    if ('error' in result) return c.json(result.error, result.status);

    await publishCostUpdatedEvent({
        tenantId,
        costVersionId: result.item.id,
        productGlobalId: result.item.productGlobalId,
        effectiveFrom: result.item.effectiveFrom,
        effectiveTo: result.item.effectiveTo,
        sourceSystem: result.item.sourceSystem,
    });

    return c.json({ item: result.item });
});

mdm.delete('/products/:id', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');

    // Validate Asset Deletion Constraints
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findUnique({
            where: { id, tenantId },
            include: {
                commodities: {
                    include: { listings: true }
                },
                externalSkuMappings: true
            }
        })
    );

    if (!product) return c.json({ error: 'Product not found' }, 404);

    const totalListings = product.commodities.reduce((acc, c) => acc + c.listings.length, 0);
    const totalBindings = product.externalSkuMappings.length;

    // OR-Logic: Only intercept if it has BOTH active listings AND ERP/WMS bindings
    if (totalListings > 0 && totalBindings > 0) {
        return c.json({
            error: 'Constraint Violation: Product has both active listings and ERP/WMS bindings.',
            code: 'DELETION_BLOCKED_DUAL_DEPENDENCY'
        }, 400);
    }

    // Pass constraints, proceed to cascade delete manually because of Restrict foreign keys
    try {
        await withTenant(tenantId, async (tx) => {
            const commodityIds = product.commodities.map(c => c.id);

            // Delete grand-children from Commodity
            if (commodityIds.length > 0) {
                await tx.listing.deleteMany({ where: { commodityId: { in: commodityIds } } });
                // CommodityMedia cascade deletes with Commodity automatically
            }

            // Delete direct children of Product
            await tx.performanceSnapshot.deleteMany({ where: { productId: id } });
            await tx.policyConfig.deleteMany({ where: { productId: id } });
            await tx.productChangeLog.deleteMany({ where: { productId: id } });
            await tx.externalSkuMapping.deleteMany({ where: { productId: id } });

            // Delete Commodities
            await tx.commodity.deleteMany({ where: { productId: id } });

            // Delete Core Product
            await tx.product.delete({ where: { id } });
        });

        return c.json({ success: true, message: 'Product and all related assets successfully deleted' });
    } catch (e) {
        console.error('Failed to cascade delete product:', e);
        return c.json({ error: 'Internal Server Error during cascading deletion' }, 500);
    }
});

// ══════════════════════════════════════════════════════════
//  Commodities (Product × Market)
// ══════════════════════════════════════════════════════════

mdm.get('/commodities', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { productId, marketId } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.commodity.findMany({
            where: { tenantId, productId: productId || undefined, marketId: marketId || undefined },
            include: { market: true, product: { include: { brand: true } }, media: true },
            orderBy: { updatedAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/commodities', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ productId: string; marketId: string; language: string; title: string; bulletPoints?: unknown }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.commodity.create({
            data: { tenantId, productId: body.productId, marketId: body.marketId, language: body.language, title: body.title, bulletPoints: body.bulletPoints as never },
            include: { market: true },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/commodities/:id', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<Record<string, unknown>>();
    const item = await withTenant(tenantId, (tx) =>
        tx.commodity.update({ where: { id, tenantId }, data: body as never }),
    );
    return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  Listings (Commodity × Platform) + Mapping Workflow
// ══════════════════════════════════════════════════════════

mdm.get('/listings', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { commodityId, platformId, mappingStatus } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.listing.findMany({
            where: {
                tenantId,
                commodityId: commodityId || undefined,
                platformId: platformId || undefined,
                mappingStatus: mappingStatus || undefined,
            },
            select: {
                id: true, tenantId: true, commodityId: true, platformId: true,
                externalListingId: true, title: true, isPrimary: true, status: true,
                mappingStatus: true, mappedBy: true, mappedAt: true,
                platformFulfillmentModeId: true, thirdPartyLogisticsId: true,
                origin: true, createdAt: true, updatedAt: true,
                platform: true, commodity: { include: { market: true } },
            },
            orderBy: { updatedAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/listings', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{
        commodityId: string; platformId: string; externalListingId: string; title: string;
        platformFulfillmentModeId?: string; thirdPartyLogisticsId?: string; isPrimary?: boolean;
    }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.listing.create({
            data: {
                tenantId,
                commodityId: body.commodityId,
                platformId: body.platformId,
                externalListingId: body.externalListingId,
                title: body.title,
                platformFulfillmentModeId: body.platformFulfillmentModeId,
                thirdPartyLogisticsId: body.thirdPartyLogisticsId,
                isPrimary: body.isPrimary ?? false,
                origin: 'system',
                mappingStatus: 'mapped',
            },
            include: { platform: true },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/listings/:id', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<Record<string, unknown>>();
    const item = await withTenant(tenantId, (tx) =>
        tx.listing.update({ where: { id, tenantId }, data: body as never }),
    );
    return c.json({ item });
});

// ── Listing Import & Mapping ────────────────────────────

mdm.post('/listings/import', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{
        platformId: string;
        listings: { externalListingId: string; title: string; rawPlatformData?: Record<string, unknown> }[];
    }>();
    const created = await withTenant(tenantId, async (tx) => {
        const results = [];
        for (const item of body.listings) {
            const existing = await tx.listing.findFirst({
                where: { platformId: body.platformId, externalListingId: item.externalListingId },
            });
            if (!existing) {
                const created = await tx.listing.create({
                    data: {
                        tenantId,
                        platformId: body.platformId,
                        externalListingId: item.externalListingId,
                        title: item.title,
                        rawPlatformData: item.rawPlatformData as never,
                        origin: 'platform_import',
                        mappingStatus: 'unmapped',
                    },
                });
                results.push(created);
            }
        }
        return results;
    });
    return c.json({ imported: created.length, items: created }, 201);
});

mdm.get('/listings/unmapped', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { platformId, marketId } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.listing.findMany({
            where: {
                tenantId,
                mappingStatus: { in: ['unmapped', 'ai_suggested'] },
                platformId: platformId || undefined,
            },
            select: {
                id: true, tenantId: true, commodityId: true, platformId: true,
                externalListingId: true, title: true, isPrimary: true, status: true,
                mappingStatus: true, mappedBy: true, mappedAt: true,
                origin: true, createdAt: true, updatedAt: true,
                platform: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/listings/:id/ai-suggest', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    // TODO: implement AI matching logic
    // For now, return top 5 candidates by name similarity
    const listing = await withTenant(tenantId, (tx) =>
        tx.listing.findFirst({ where: { id, tenantId } }),
    );
    if (!listing) return c.json({ error: 'not found' }, 404);

    const candidates = await withTenant(tenantId, (tx) =>
        tx.commodity.findMany({
            where: { tenantId },
            include: { product: true, market: true },
            take: 5,
        }),
    );

    await withTenant(tenantId, (tx) =>
        tx.listing.update({ where: { id, tenantId }, data: { mappingStatus: 'ai_suggested' } }),
    );

    return c.json({ candidates });
});

mdm.post('/listings/:id/map', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ commodityId: string }>();
    const mappedBy = c.req.header('x-user-id') ?? 'system';
    const item = await withTenant(tenantId, async (tx) => {
        let updated: Awaited<ReturnType<typeof tx.listing.update>> | undefined;
        if (env.MAPPING_WRITE_MODE !== 'new_only') {
            updated = await tx.listing.update({
                where: { id, tenantId },
                data: { commodityId: body.commodityId, mappingStatus: 'mapped', mappedBy, mappedAt: new Date() },
            });
        } else {
            updated = await tx.listing.findUniqueOrThrow({ where: { id, tenantId } });
        }
        if (env.MAPPING_WRITE_MODE !== 'legacy') {
            await upsertApprovedExternalIdMapping({
                tx,
                tenantId,
                entityType: 'LISTING',
                globalId: body.commodityId,
                sourceSystem: 'platform',
                externalId: updated.externalListingId,
                externalSubId: updated.platformId,
                actor: mappedBy,
                reason: 'mapped from legacy listing route',
            });
        }
        return updated;
    });
    return c.json({ item });
});

mdm.post('/listings/:id/reject', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
    const actor = c.req.header('x-user-id') ?? 'system';
    const item = await withTenant(tenantId, async (tx) => {
        const updated = await tx.listing.update({ where: { id, tenantId }, data: { mappingStatus: 'rejected' } });
        if (env.MAPPING_WRITE_MODE !== 'legacy') {
            await upsertRejectedExternalIdMapping({
                tx,
                tenantId,
                entityType: 'LISTING',
                sourceSystem: 'platform',
                externalId: updated.externalListingId,
                externalSubId: updated.platformId,
                actor,
                reason: body.reason ?? 'rejected from legacy listing route',
            });
        }
        return updated;
    });
    return c.json({ item });
});

mdm.post('/listings/bulk-map', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ mappings: { listingId: string; commodityId: string }[] }>();
    const mappedBy = c.req.header('x-user-id') ?? 'system';
    const results = await withTenant(tenantId, async (tx) => {
        const updated = [];
        for (const m of body.mappings) {
            let item: Awaited<ReturnType<typeof tx.listing.update>> | undefined;
            if (env.MAPPING_WRITE_MODE !== 'new_only') {
                item = await tx.listing.update({
                    where: { id: m.listingId, tenantId },
                    data: { commodityId: m.commodityId, mappingStatus: 'mapped', mappedBy, mappedAt: new Date() },
                });
            } else {
                item = await tx.listing.findUniqueOrThrow({ where: { id: m.listingId, tenantId } });
            }
            if (env.MAPPING_WRITE_MODE !== 'legacy') {
                await upsertApprovedExternalIdMapping({
                    tx,
                    tenantId,
                    entityType: 'LISTING',
                    globalId: m.commodityId,
                    sourceSystem: 'platform',
                    externalId: item.externalListingId,
                    externalSubId: item.platformId,
                    actor: mappedBy,
                    reason: 'bulk mapped from legacy listing route',
                });
            }
            updated.push(item);
        }
        return updated;
    });
    return c.json({ mapped: results.length });
});

// ══════════════════════════════════════════════════════════
//  4-Tier Tree & Performance
// ══════════════════════════════════════════════════════════

mdm.get('/tree/:productId', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const productId = c.req.param('productId');
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id: productId, tenantId },
            include: {
                brand: true,
                category: true,
                supplier: true,
                commodities: {
                    include: {
                        market: true,
                        media: true,
                        listings: {
                            include: {
                                platform: true,
                                platformFulfillmentMode: true,
                                thirdPartyLogistics: true,
                                snapshots: { orderBy: { snapshotDate: 'desc' }, take: 1 },
                            },
                        },
                    },
                },
            },
        }),
    );
    if (!product) return c.json({ error: 'not found' }, 404);
    return c.json({ tree: product });
});

mdm.get('/performance', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { platformId, marketId, brandId, categoryId, dateFrom, dateTo } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.performanceSnapshot.findMany({
            where: {
                tenantId,
                ...(dateFrom || dateTo ? { snapshotDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
            },
            orderBy: { snapshotDate: 'desc' },
            take: 500,
        }),
    );
    return c.json({ items });
});

// ══════════════════════════════════════════════════════════
//  External SKU Mapping
// ══════════════════════════════════════════════════════════

mdm.get('/sku-mappings', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const { sourceType, mappingStatus } = c.req.query() as Record<string, string | undefined>;
    const items = await withTenant(tenantId, (tx) =>
        tx.externalSkuMapping.findMany({
            where: {
                tenantId,
                sourceType: sourceType || undefined,
                mappingStatus: mappingStatus || undefined,
            },
            select: {
                id: true, tenantId: true, productId: true, sourceType: true,
                sourceId: true, externalSku: true, externalName: true,
                mappingStatus: true, mappedBy: true, mappedAt: true,
                createdAt: true,
                product: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.get('/sku-mappings/unmapped', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.externalSkuMapping.findMany({
            where: { tenantId, mappingStatus: { in: ['unmapped', 'ai_suggested'] } },
            include: { product: true },
            orderBy: { createdAt: 'desc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/sku-mappings/import', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{
        sourceType: string; sourceId: string;
        items: { externalSku: string; externalName?: string; rawData?: Record<string, unknown> }[];
    }>();
    const created = await withTenant(tenantId, async (tx) => {
        const results = [];
        for (const item of body.items) {
            const existing = await tx.externalSkuMapping.findFirst({
                where: { tenantId, sourceType: body.sourceType, sourceId: body.sourceId, externalSku: item.externalSku },
            });
            if (!existing) {
                const m = await tx.externalSkuMapping.create({
                    data: { tenantId, sourceType: body.sourceType, sourceId: body.sourceId, externalSku: item.externalSku, externalName: item.externalName, rawData: item.rawData as never },
                });
                results.push(m);
            }
        }
        return results;
    });
    return c.json({ imported: created.length, items: created }, 201);
});

mdm.post('/sku-mappings/:id/ai-suggest', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    // TODO: AI matching - fuzzy match externalSku/externalName against Product.sku/name
    const mapping = await withTenant(tenantId, (tx) =>
        tx.externalSkuMapping.findFirst({ where: { id, tenantId } }),
    );
    if (!mapping) return c.json({ error: 'not found' }, 404);
    const candidates = await withTenant(tenantId, (tx) =>
        tx.product.findMany({ where: { tenantId }, take: 5 }),
    );
    await withTenant(tenantId, (tx) =>
        tx.externalSkuMapping.update({ where: { id }, data: { mappingStatus: 'ai_suggested' } }),
    );
    return c.json({ candidates });
});

mdm.post('/sku-mappings/:id/map', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ productId: string }>();
    const mappedBy = c.req.header('x-user-id') ?? 'system';
    const item = await withTenant(tenantId, async (tx) => {
        let updated: Awaited<ReturnType<typeof tx.externalSkuMapping.update>> | undefined;
        if (env.MAPPING_WRITE_MODE !== 'new_only') {
            updated = await tx.externalSkuMapping.update({
                where: { id },
                data: { productId: body.productId, mappingStatus: 'mapped', mappedBy, mappedAt: new Date() },
            });
        } else {
            updated = await tx.externalSkuMapping.findUniqueOrThrow({ where: { id } });
        }
        if (env.MAPPING_WRITE_MODE !== 'legacy') {
            await upsertApprovedExternalIdMapping({
                tx,
                tenantId,
                entityType: 'PRODUCT',
                globalId: body.productId,
                sourceSystem: updated.sourceType,
                externalId: updated.externalSku,
                externalSubId: updated.sourceId,
                actor: mappedBy,
                reason: 'mapped from legacy sku-mapping route',
            });
        }
        return updated;
    });
    return c.json({ item });
});

mdm.post('/sku-mappings/:id/reject', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
    const actor = c.req.header('x-user-id') ?? 'system';
    const item = await withTenant(tenantId, async (tx) => {
        let updated: Awaited<ReturnType<typeof tx.externalSkuMapping.update>> | undefined;
        if (env.MAPPING_WRITE_MODE !== 'new_only') {
            updated = await tx.externalSkuMapping.update({ where: { id }, data: { mappingStatus: 'rejected' } });
        } else {
            updated = await tx.externalSkuMapping.findUniqueOrThrow({ where: { id } });
        }
        if (env.MAPPING_WRITE_MODE !== 'legacy') {
            await upsertRejectedExternalIdMapping({
                tx,
                tenantId,
                entityType: 'PRODUCT',
                sourceSystem: updated.sourceType,
                externalId: updated.externalSku,
                externalSubId: updated.sourceId,
                actor,
                reason: body.reason ?? 'rejected from legacy sku-mapping route',
            });
        }
        return updated;
    });
    return c.json({ item });
});

mdm.post('/sku-mappings/bulk-map', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ mappings: { id: string; productId: string }[] }>();
    const mappedBy = c.req.header('x-user-id') ?? 'system';
    const results = await withTenant(tenantId, async (tx) => {
        const updated = [];
        for (const m of body.mappings) {
            let item: Awaited<ReturnType<typeof tx.externalSkuMapping.update>> | undefined;
            if (env.MAPPING_WRITE_MODE !== 'new_only') {
                item = await tx.externalSkuMapping.update({
                    where: { id: m.id },
                    data: { productId: m.productId, mappingStatus: 'mapped', mappedBy, mappedAt: new Date() },
                });
            } else {
                item = await tx.externalSkuMapping.findUniqueOrThrow({ where: { id: m.id } });
            }
            if (env.MAPPING_WRITE_MODE !== 'legacy') {
                await upsertApprovedExternalIdMapping({
                    tx,
                    tenantId,
                    entityType: 'PRODUCT',
                    globalId: m.productId,
                    sourceSystem: item.sourceType,
                    externalId: item.externalSku,
                    externalSubId: item.sourceId,
                    actor: mappedBy,
                    reason: 'bulk mapped from legacy sku-mapping route',
                });
            }
            updated.push(item);
        }
        return updated;
    });
    return c.json({ mapped: results.length });
});

export { mdm as mdmAssetRoutes };
