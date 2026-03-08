import { Hono } from 'hono';
import { prisma } from './db.js';
import { DEFAULT_MODEL_ID, DEFAULT_MODELS, MODEL_CATALOG, WORK_TYPE_META, SYSTEM_TENANT_ID, ModelRouter, WorkType, type AIConfig } from './model-router.js';
import { requireRole, type AuthContext } from './auth-middleware.js';

import { AMAZON_US_CATALOG } from './amazon-catalog-v4.js';

// ── Helpers ──────────────────────────────────────────────

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return fn(tx as typeof prisma);
    });
}

function requireTenantId(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }) {
    return c.req.header('x-tenant-id') ?? c.req.query('tenantId') ?? null;
}

const mdm = new Hono();
mdm.use('/ai-config/test', requireRole('system_admin', 'tenant_admin'));
mdm.use('/ai-config/status', requireRole('system_admin', 'tenant_admin'));
mdm.use('/ai-config/work-types', requireRole('system_admin', 'tenant_admin'));
mdm.use('/ai-config/model-policy', requireRole('system_admin', 'tenant_admin'));
mdm.use('/ai-config/model-policy/*', requireRole('system_admin', 'tenant_admin'));

type Role = AuthContext['role'];

type AiModelPolicy = {
    includeLegacyByDefault?: boolean;
    allowedModelIds?: string[];
    blockedModelIds?: string[];
    roleOverrides?: Partial<Record<Role, {
        includeLegacy?: boolean;
        allowedModelIds?: string[];
        blockedModelIds?: string[];
    }>>;
};

function getAuthRole(c: any): Role {
    const auth = c.get('auth') as AuthContext | undefined;
    return auth?.role ?? 'operator';
}

function getAuthUserId(c: any): string {
    const auth = c.get('auth') as AuthContext | undefined;
    return auth?.userId ?? 'unknown';
}

function canManageAiConfig(role: Role) {
    return role === 'system_admin' || role === 'tenant_admin';
}

function filterModelsByPolicy(role: Role, policy?: AiModelPolicy | null) {
    const roleOverride = policy?.roleOverrides?.[role];
    const includeLegacy = roleOverride?.includeLegacy
        ?? policy?.includeLegacyByDefault
        ?? (role === 'system_admin');
    const allowed = new Set(roleOverride?.allowedModelIds ?? policy?.allowedModelIds ?? []);
    const blocked = new Set(roleOverride?.blockedModelIds ?? policy?.blockedModelIds ?? []);

    return MODEL_CATALOG.filter((item) => {
        if (!includeLegacy && item.isLegacy) return false;
        if (allowed.size > 0 && !allowed.has(item.id)) return false;
        if (blocked.has(item.id)) return false;
        return true;
    });
}

function sanitizeIds(ids?: string[]) {
    if (!Array.isArray(ids)) return [];
    const allowed = new Set(MODEL_CATALOG.map((m) => m.id));
    return Array.from(new Set(ids.map((s) => String(s).trim()).filter((s) => s && allowed.has(s))));
}

function sanitizePolicy(policy: AiModelPolicy): AiModelPolicy {
    const roleOverrides: AiModelPolicy['roleOverrides'] = {};
    const validRoles: Role[] = ['system_admin', 'tenant_admin', 'operator', 'supplier', 'viewer'];
    for (const role of validRoles) {
        const raw = policy.roleOverrides?.[role];
        if (!raw) continue;
        roleOverrides[role] = {
            includeLegacy: typeof raw.includeLegacy === 'boolean' ? raw.includeLegacy : undefined,
            allowedModelIds: sanitizeIds(raw.allowedModelIds),
            blockedModelIds: sanitizeIds(raw.blockedModelIds),
        };
    }

    return {
        includeLegacyByDefault: typeof policy.includeLegacyByDefault === 'boolean' ? policy.includeLegacyByDefault : undefined,
        allowedModelIds: sanitizeIds(policy.allowedModelIds),
        blockedModelIds: sanitizeIds(policy.blockedModelIds),
        roleOverrides,
    };
}

async function loadModelPolicy(tenantId: string): Promise<AiModelPolicy | null> {
    const policyCfg = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({
            where: { tenantId, policyKey: 'ai_model_policy' }
        })
    );
    return (policyCfg?.policyValue as AiModelPolicy | null) ?? null;
}

async function createPolicyAuditEvent(input: {
    tenantId: string;
    eventType: 'AI_MODEL_POLICY_UPDATED' | 'AI_MODEL_POLICY_CLEARED';
    actorRole: Role;
    actorUserId: string;
    previousPolicy: AiModelPolicy | null;
    newPolicy: AiModelPolicy | null;
}) {
    await withTenant(input.tenantId, (tx) =>
        tx.securityAuditEvent.create({
            data: {
                tenantId: input.tenantId,
                eventType: input.eventType,
                severity: 'INFO',
                details: {
                    actorRole: input.actorRole,
                    actorUserId: input.actorUserId,
                    previousPolicy: input.previousPolicy,
                    newPolicy: input.newPolicy,
                } as never,
            },
        })
    );
}

// ══════════════════════════════════════════════════════════
//  Markets
// ══════════════════════════════════════════════════════════

mdm.get('/markets', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.market.findMany({ where: { tenantId }, include: { languages: true }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/markets', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; currency?: string; timezone?: string; languages?: { language: string; isDefault?: boolean }[] }>();

    const globalEntry = await prisma.globalMarket.findUnique({ where: { code: body.code.toLowerCase() } });
    if (!globalEntry || !globalEntry.enabled) {
        return c.json({ error: `Market code '${body.code}' is not available in system registry. Contact system admin.` }, 400);
    }

    const item = await withTenant(tenantId, (tx) =>
        tx.market.create({
            data: {
                tenantId,
                code: body.code,
                name: body.name,
                currency: body.currency ?? globalEntry.currency,
                timezone: body.timezone ?? globalEntry.timezone,
                globalMarketCode: globalEntry.code,
                languages: body.languages ? { create: body.languages } : undefined,
            },
            include: { languages: true },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/markets/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const body = await c.req.json<{ name?: string; currency?: string; timezone?: string }>();
        const item = await withTenant(tenantId, (tx) =>
            tx.market.update({ where: { id, tenantId }, data: body }),
        );
        return c.json({ item });
    } catch (e: any) {
        console.error(`[API] Failed to update market ${id}:`, e);
        return c.json({ error: 'Failed to update market', details: e.message }, 500);
    }
});

mdm.delete('/markets/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const item = await prisma.market.findUnique({ where: { id } as any });
        if (!item) {
            return c.json({ error: 'Market not found in database', details: `ID ${id} was not found.` }, 404);
        }
        if (item.tenantId !== tenantId) {
            return c.json({
                error: 'Ownership mismatch',
                details: `Record belongs to tenant ${item.tenantId}, but request sent tenant ${tenantId}`
            }, 403);
        }

        const commodityCount = await withTenant(tenantId, (tx) =>
            tx.commodity.count({ where: { marketId: id, tenantId } })
        );
        if (commodityCount > 0) {
            return c.json({
                error: 'Cannot delete market while it has associated commodities',
                details: `This market has ${commodityCount} associated product twins. Delete them first.`
            }, 409);
        }

        const result = await withTenant(tenantId, (tx) =>
            tx.market.deleteMany({ where: { id, tenantId } })
        );
        console.log(`[API] Successfully deleted market ${id}`);
        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete market ${id}:`, e);
        return c.json({
            error: 'Failed to delete market',
            details: e.message,
            code: e.code
        }, 500);
    }
});

// ══════════════════════════════════════════════════════════
//  Platforms
// ══════════════════════════════════════════════════════════

mdm.get('/platforms', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.platform.findMany({ where: { tenantId }, include: { fulfillmentModes: true }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/platforms', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; apiType: string; fulfillmentModes?: { code: string; name: string }[] }>();

    const globalEntry = await prisma.globalPlatform.findUnique({ where: { code: body.code.toLowerCase() } });
    if (!globalEntry || !globalEntry.enabled) {
        return c.json({ error: `Platform code '${body.code}' is not available in system registry. Contact system admin.` }, 400);
    }

    const item = await withTenant(tenantId, (tx) =>
        tx.platform.create({
            data: {
                tenantId,
                code: body.code,
                name: body.name,
                apiType: body.apiType,
                globalPlatformCode: globalEntry.code,
                fulfillmentModes: body.fulfillmentModes ? { create: body.fulfillmentModes } : undefined,
            },
            include: { fulfillmentModes: true },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/platforms/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const body = await c.req.json<{ name?: string; apiType?: string }>();
        const item = await withTenant(tenantId, (tx) =>
            tx.platform.update({ where: { id, tenantId }, data: body }),
        );
        return c.json({ item });
    } catch (e: any) {
        console.error(`[API] Failed to update platform ${id}:`, e);
        return c.json({ error: 'Failed to update platform', details: e.message }, 500);
    }
});

mdm.delete('/platforms/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const result = await withTenant(tenantId, (tx) => tx.platform.deleteMany({ where: { id, tenantId } }));
        if (result.count === 0) return c.json({ error: 'Platform not found' }, 404);
        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete platform ${id}:`, e);
        return c.json({ error: 'Failed to delete platform', details: e.message }, 500);
    }
});

// Platform Credentials
mdm.put('/platforms/:id/credentials', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const body = await c.req.json<{ apiCredentials: Record<string, unknown> }>();
        const item = await withTenant(tenantId, (tx) =>
            tx.platform.update({ where: { id, tenantId }, data: { apiCredentials: body.apiCredentials as never, apiStatus: 'disconnected' } }),
        );
        return c.json({ item });
    } catch (e: any) {
        console.error(`[API] Failed to update platform credentials ${id}:`, e);
        return c.json({ error: 'Failed to update credentials', details: e.message }, 500);
    }
});

mdm.post('/platforms/:id/test-connection', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    // TODO: actual API connection test per apiType
    await withTenant(tenantId, (tx) =>
        tx.platform.update({ where: { id, tenantId }, data: { apiStatus: 'connected', lastSyncAt: new Date() } }),
    );
    return c.json({ status: 'connected' });
});

mdm.post('/platforms/:id/sync', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    // TODO: enqueue sync job
    return c.json({ status: 'sync_queued' }, 202);
});

// ══════════════════════════════════════════════════════════
//  Categories  (tree structure)
// ══════════════════════════════════════════════════════════

mdm.get('/categories/catalog/amazon-us', async (c) => {
    return c.json({ items: AMAZON_US_CATALOG, refreshId: 'v4-final-' + Date.now() });
});

mdm.post('/categories/import', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ categories: { code: string; name: string; parentCode?: string }[] }>();

    const results = [];
    const codeToId = new Map<string, string>();

    // Sort to handle parents first (very basic, assuming flat list with parentCode for now)
    // In a real tree import, we'd traverse properly.
    for (const cat of body.categories) {
        let parentId: string | null = null;
        if (cat.parentCode) {
            parentId = codeToId.get(cat.parentCode) ?? null;
            if (!parentId) {
                // If not in current batch, lookup in DB
                const parent = await prisma.category.findUnique({
                    where: { tenantId_code: { tenantId, code: cat.parentCode } }
                });
                parentId = parent?.id ?? null;
            }
        }

        const item = await withTenant(tenantId, (tx) =>
            tx.category.upsert({
                where: { tenantId_code: { tenantId, code: cat.code } },
                update: { name: cat.name, parentId },
                create: { tenantId, code: cat.code, name: cat.name, parentId },
            }),
        );
        codeToId.set(cat.code, item.id);
        results.push(item);
    }

    return c.json({ items: results }, 201);
});

mdm.get('/categories', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const flat = c.req.query('flat') === 'true';
    const items = await withTenant(tenantId, (tx) =>
        tx.category.findMany({
            where: { tenantId, ...(flat ? {} : { parentId: null }) },
            include: { children: { include: { children: true } }, attributeSchemas: true },
            orderBy: { code: 'asc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/categories', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; definition?: string; parentId?: string }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.category.create({
            data: { tenantId, code: body.code, name: body.name, definition: body.definition, parentId: body.parentId },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/categories/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const body = await c.req.json<{ name?: string; definition?: string; parentId?: string | null }>();
        const item = await withTenant(tenantId, (tx) =>
            tx.category.update({ where: { id, tenantId }, data: body }),
        );
        return c.json({ item });
    } catch (e: any) {
        console.error(`[API] Failed to update category ${id}:`, e);
        return c.json({ error: 'Failed to update category', details: e.message }, 500);
    }
});

mdm.delete('/categories/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const item = await prisma.category.findUnique({ where: { id } as any });
        if (!item) {
            return c.json({ error: 'Category not found in database', details: `ID ${id} was not found.` }, 404);
        }
        if (item.tenantId !== tenantId) {
            return c.json({
                error: 'Ownership mismatch',
                details: `Record belongs to tenant ${item.tenantId}, but request sent tenant ${tenantId}`
            }, 403);
        }

        const [childCount, productCount] = await withTenant(tenantId, (tx) => Promise.all([
            tx.category.count({ where: { parentId: id, tenantId } }),
            tx.product.count({ where: { categoryId: id, tenantId } })
        ]));

        console.log(`[API] Category Stats for ${id}: children=${childCount}, products=${productCount}`);

        if (childCount > 0) {
            return c.json({
                error: 'Cannot delete category with subcategories',
                details: `This category has ${childCount} child categories. Delete the subcategories first.`
            }, 409);
        }
        if (productCount > 0) {
            return c.json({
                error: 'Cannot delete category with associated products',
                details: `This category has ${productCount} products assigned to it. Move or delete them first.`
            }, 409);
        }

        const result = await withTenant(tenantId, (tx) => tx.category.deleteMany({ where: { id, tenantId } }));
        console.log(`[API] Deletion result for ${id}:`, result);

        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete category ${id}:`, e);
        return c.json({ error: 'Failed to delete category', details: e.message, prismaCode: e.code }, 500);
    }
});

// ══════════════════════════════════════════════════════════
//  Brands
// ══════════════════════════════════════════════════════════

mdm.get('/brands', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.brand.findMany({ where: { tenantId }, include: { brandCategories: { include: { category: true } } }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/brands', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; description?: string; categoryIds?: string[] }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.brand.create({
            data: {
                tenantId,
                code: body.code,
                name: body.name,
                description: body.description,
                brandCategories: body.categoryIds
                    ? { create: body.categoryIds.map((cid) => ({ categoryId: cid })) }
                    : undefined,
            },
            include: { brandCategories: { include: { category: true } } },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/brands/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const body = await c.req.json<{ name?: string; description?: string }>();
        const item = await withTenant(tenantId, (tx) =>
            tx.brand.update({ where: { id, tenantId }, data: body }),
        );
        return c.json({ item });
    } catch (e: any) {
        console.error(`[API] Failed to update brand ${id}:`, e);
        return c.json({ error: 'Failed to update brand', details: e.message }, 500);
    }
});

mdm.delete('/brands/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const item = await prisma.brand.findUnique({ where: { id } as any });
        if (!item) {
            return c.json({ error: 'Brand not found in database', details: `ID ${id} was not found.` }, 404);
        }
        if (item.tenantId !== tenantId) {
            return c.json({
                error: 'Ownership mismatch',
                details: `Record belongs to tenant ${item.tenantId}, but request sent tenant ${tenantId}`
            }, 403);
        }

        const productCount = await withTenant(tenantId, (tx) =>
            tx.product.count({ where: { brandId: id, tenantId } })
        );
        if (productCount > 0) {
            return c.json({ error: 'Cannot delete brand with associated products', details: `This brand has ${productCount} products.` }, 409);
        }

        const result = await withTenant(tenantId, (tx) => tx.brand.deleteMany({ where: { id, tenantId } }));
        console.log(`[API] Successfully deleted brand ${id}`);
        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete brand ${id}:`, e);
        return c.json({ error: 'Failed to delete brand', details: e.message }, 500);
    }
});

// ══════════════════════════════════════════════════════════
//  Third-Party Logistics (3PL)
// ══════════════════════════════════════════════════════════

mdm.get('/3pl', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.thirdPartyLogistics.findMany({ where: { tenantId }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/3pl', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; provider: string }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.thirdPartyLogistics.create({ data: { tenantId, ...body } }),
    );
    return c.json({ item }, 201);
});

mdm.put('/3pl/:id/credentials', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ apiCredentials: Record<string, unknown> }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.thirdPartyLogistics.update({ where: { id, tenantId }, data: { apiCredentials: body.apiCredentials as never, apiStatus: 'disconnected' } }),
    );
    return c.json({ item });
});

mdm.post('/3pl/:id/test-connection', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    await withTenant(tenantId, (tx) =>
        tx.thirdPartyLogistics.update({ where: { id, tenantId }, data: { apiStatus: 'connected', lastSyncAt: new Date() } }),
    );
    return c.json({ status: 'connected' });
});

// ══════════════════════════════════════════════════════════
//  Warehouses
// ══════════════════════════════════════════════════════════

mdm.get('/warehouses', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.warehouse.findMany({ where: { tenantId }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/warehouses', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; type?: string; country?: string; address?: string; capacity?: number }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.warehouse.create({ data: { tenantId, ...body } }),
    );
    return c.json({ item }, 201);
});

mdm.put('/warehouses/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ name?: string; type?: string; country?: string; address?: string; capacity?: number }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.warehouse.update({ where: { id, tenantId }, data: body }),
    );
    return c.json({ item });
});

mdm.delete('/warehouses/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const result = await withTenant(tenantId, (tx) => tx.warehouse.deleteMany({ where: { id, tenantId } }));
        if (result.count === 0) return c.json({ error: 'Warehouse not found' }, 404);
        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete warehouse ${id}:`, e);
        return c.json({ error: 'Failed to delete warehouse', details: e.message }, 500);
    }
});

mdm.put('/warehouses/:id/credentials', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ apiCredentials: Record<string, unknown> }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.warehouse.update({ where: { id, tenantId }, data: { apiCredentials: body.apiCredentials as never, apiStatus: 'disconnected' } }),
    );
    return c.json({ item });
});

mdm.post('/warehouses/:id/test-connection', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    await withTenant(tenantId, (tx) =>
        tx.warehouse.update({ where: { id, tenantId }, data: { apiStatus: 'connected', lastSyncAt: new Date() } }),
    );
    return c.json({ status: 'connected' });
});

// ══════════════════════════════════════════════════════════
//  Suppliers
// ══════════════════════════════════════════════════════════

mdm.get('/suppliers', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.supplier.findMany({ where: { tenantId }, orderBy: { code: 'asc' } }),
    );
    return c.json({ items });
});

mdm.post('/suppliers', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; contactName?: string; contactEmail?: string; leadTimeDays?: number; moq?: number; currency?: string; country?: string }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.supplier.create({ data: { tenantId, ...body } }),
    );
    return c.json({ item }, 201);
});

mdm.put('/suppliers/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<Partial<{ name: string; contactName: string; contactEmail: string; leadTimeDays: number; moq: number }>>();
    const item = await withTenant(tenantId, (tx) =>
        tx.supplier.update({ where: { id, tenantId }, data: body }),
    );
    return c.json({ item });
});

mdm.delete('/suppliers/:id', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    try {
        const item = await prisma.supplier.findUnique({ where: { id } as any });
        if (!item) {
            return c.json({ error: 'Supplier not found in database', details: `ID ${id} was not found.` }, 404);
        }
        if (item.tenantId !== tenantId) {
            return c.json({
                error: 'Ownership mismatch',
                details: `Record belongs to tenant ${item.tenantId}, but request sent tenant ${tenantId}`
            }, 403);
        }

        const [productCount, commodityCount] = await withTenant(tenantId, (tx) => Promise.all([
            tx.product.count({ where: { supplierId: id, tenantId } }),
            tx.commodity.count({ where: { product: { supplierId: id }, tenantId } })
        ]));

        if (productCount > 0 || commodityCount > 0) {
            return c.json({
                error: 'Cannot delete supplier with associated data',
                details: `This supplier has ${productCount} products and ${commodityCount} commodities. Remove associations first.`
            }, 409);
        }

        const result = await withTenant(tenantId, (tx) => tx.supplier.deleteMany({ where: { id, tenantId } }));
        console.log(`[API] Successfully deleted supplier ${id}`);
        return c.json({ ok: true });
    } catch (e: any) {
        console.error(`[API] Failed to delete supplier ${id}:`, e);
        return c.json({ error: 'Failed to delete supplier', details: e.message }, 500);
    }
});

// ══════════════════════════════════════════════════════════
//  ERP Systems
// ══════════════════════════════════════════════════════════

mdm.get('/erp-systems', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const items = await withTenant(tenantId, (tx) =>
        tx.erpSystem.findMany({ where: { tenantId }, orderBy: { code: 'asc' } }),
    );
    // Strip apiCredentials from response
    return c.json({ items: items.map(({ apiCredentials: _, ...rest }) => rest) });
});

mdm.post('/erp-systems', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const body = await c.req.json<{ code: string; name: string; erpType: string; syncDirection?: string }>();

    const globalEntry = await prisma.globalErpSystem.findUnique({ where: { code: body.erpType.toLowerCase() } });
    if (!globalEntry || !globalEntry.enabled) {
        return c.json({ error: `ERP type '${body.erpType}' is not available in system registry. Contact system admin.` }, 400);
    }

    const item = await withTenant(tenantId, (tx) =>
        tx.erpSystem.create({ data: { tenantId, ...body, globalErpCode: globalEntry.code } }),
    );
    return c.json({ item }, 201);
});

mdm.put('/erp-systems/:id/credentials', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const body = await c.req.json<{ apiCredentials: Record<string, unknown> }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.erpSystem.update({ where: { id, tenantId }, data: { apiCredentials: body.apiCredentials as never, apiStatus: 'disconnected' } }),
    );
    return c.json({ item });
});

mdm.post('/erp-systems/:id/test-connection', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    await withTenant(tenantId, (tx) =>
        tx.erpSystem.update({ where: { id, tenantId }, data: { apiStatus: 'connected', lastSyncAt: new Date() } }),
    );
    return c.json({ status: 'connected' });
});

// ══════════════════════════════════════════════════════════
//  AI Integrations Configuration
// ══════════════════════════════════════════════════════════

mdm.get('/ai-config/status', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const tenantPolicy = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({ where: { tenantId, policyKey: 'ai_integrations' } })
    );
    const tenantConfig = (tenantPolicy?.policyValue as AIConfig) ?? {};

    const platformPolicy = await prisma.policyConfig.findFirst({
        where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
    });
    const platformConfig = (platformPolicy?.policyValue as AIConfig) ?? {};

    let keySource: 'tenant' | 'platform' | 'none' = 'none';
    if (tenantConfig.geminiKey) {
        keySource = 'tenant';
    } else if (platformConfig.geminiKey || process.env.GEMINI_API_KEY) {
        keySource = 'platform';
    }

    return c.json({
        provider: 'google-gemini',
        keySource,
        modelId: tenantConfig.modelId ?? platformConfig.modelId ?? DEFAULT_MODEL_ID,
        connected: keySource !== 'none',
    });
});

mdm.get('/ai-config/work-types', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const tenantPolicy = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({ where: { tenantId, policyKey: 'ai_integrations' } })
    );
    const tenantConfig = (tenantPolicy?.policyValue as AIConfig) ?? {};

    const platformPolicy = await prisma.policyConfig.findFirst({
        where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
    });
    const platformConfig = (platformPolicy?.policyValue as AIConfig) ?? {};

    const items = Object.values(WorkType).map((wt) => {
        const meta = WORK_TYPE_META[wt];
        const tenantModel = tenantConfig.models?.[wt];
        const platformModel = platformConfig.models?.[wt];
        const systemDefault = DEFAULT_MODELS[wt];
        const effectiveModel = tenantModel ?? tenantConfig.modelId ?? platformModel ?? platformConfig.modelId ?? systemDefault;

        return {
            workType: wt,
            label: meta.label,
            description: meta.description,
            available: meta.available,
            tenantModel: tenantModel ?? null,
            systemDefault,
            effectiveModel,
        };
    });

    return c.json({ items });
});

mdm.get('/ai-config', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const role = getAuthRole(c);
    if (!canManageAiConfig(role)) return c.json({ error: 'insufficient permissions' }, 403);

    const config = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({
            where: { tenantId, policyKey: 'ai_integrations' }
        })
    );

    if (!config) return c.json({ geminiKey: '', modelId: DEFAULT_MODEL_ID });

    const val = config.policyValue as { geminiKey?: string; modelId?: string };
    const rawKey = val.geminiKey || '';
    // Mask the key for security: keep first 4 and last 4
    const masked = rawKey.length > 8
        ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
        : rawKey;

    return c.json({ geminiKey: masked, modelId: val.modelId || DEFAULT_MODEL_ID });
});

mdm.get('/ai-config/models', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const role = getAuthRole(c);

    const [config, policyCfg] = await withTenant(tenantId, (tx) => Promise.all([
        tx.policyConfig.findFirst({
            where: { tenantId, policyKey: 'ai_integrations' }
        }),
        tx.policyConfig.findFirst({
            where: { tenantId, policyKey: 'ai_model_policy' }
        }),
    ]));

    const val = (config?.policyValue as { modelId?: string } | null) ?? null;
    const policy = (policyCfg?.policyValue as AiModelPolicy | null) ?? null;
    const items = filterModelsByPolicy(role, policy);
    const currentModelId = val?.modelId || DEFAULT_MODEL_ID;
    const hasCurrent = items.some((item) => item.id === currentModelId);
    const fallbackCurrent = hasCurrent ? currentModelId : (items[0]?.id ?? DEFAULT_MODEL_ID);

    return c.json({
        defaultModelId: DEFAULT_MODEL_ID,
        currentModelId: fallbackCurrent,
        canEditModel: role === 'system_admin' || role === 'tenant_admin',
        policyApplied: Boolean(policyCfg),
        items,
        allItems: role === 'system_admin' || role === 'tenant_admin' ? MODEL_CATALOG : undefined,
    });
});

mdm.get('/ai-config/model-policy', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const config = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({
            where: { tenantId, policyKey: 'ai_model_policy' }
        })
    );

    return c.json({
        policy: (config?.policyValue as AiModelPolicy | null) ?? null,
        items: MODEL_CATALOG,
    });
});

mdm.get('/ai-config/model-policy/audit', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20), 1), 100);
    const eventTypeParam = c.req.query('eventType');
    const allowedEventTypes = ['AI_MODEL_POLICY_UPDATED', 'AI_MODEL_POLICY_CLEARED'] as const;
    const eventType = allowedEventTypes.includes(eventTypeParam as (typeof allowedEventTypes)[number])
        ? eventTypeParam
        : null;
    const items = await withTenant(tenantId, (tx) =>
        tx.securityAuditEvent.findMany({
            where: {
                tenantId,
                eventType: eventType ?? { in: ['AI_MODEL_POLICY_UPDATED', 'AI_MODEL_POLICY_CLEARED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })
    );
    return c.json({ items });
});

mdm.post('/ai-config/model-policy', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const actorRole = getAuthRole(c);
    const actorUserId = getAuthUserId(c);
    const existing = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({ where: { tenantId, policyKey: 'ai_model_policy' } })
    );
    const previousPolicy = (existing?.policyValue as AiModelPolicy | null) ?? null;
    const body = await c.req.json<{ policy?: AiModelPolicy | null }>();
    const incoming = body.policy ?? null;

    if (incoming === null) {
        await withTenant(tenantId, (tx) =>
            tx.policyConfig.deleteMany({
                where: { tenantId, policyKey: 'ai_model_policy' }
            })
        );
        await createPolicyAuditEvent({
            tenantId,
            eventType: 'AI_MODEL_POLICY_CLEARED',
            actorRole,
            actorUserId,
            previousPolicy,
            newPolicy: null,
        });
        return c.json({ success: true, cleared: true });
    }

    const sanitized = sanitizePolicy(incoming);
    if (existing) {
        await withTenant(tenantId, (tx) =>
            tx.policyConfig.update({
                where: { id: existing.id },
                data: { policyValue: sanitized }
            })
        );
    } else {
        await withTenant(tenantId, (tx) =>
            tx.policyConfig.create({
                data: {
                    tenantId,
                    policyKey: 'ai_model_policy',
                    policyValue: sanitized,
                    effectiveFrom: new Date(),
                }
            })
        );
    }

    await createPolicyAuditEvent({
        tenantId,
        eventType: 'AI_MODEL_POLICY_UPDATED',
        actorRole,
        actorUserId,
        previousPolicy,
        newPolicy: sanitized,
    });

    return c.json({ success: true, policy: sanitized });
});

mdm.post('/ai-config', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const role = getAuthRole(c);
    if (!canManageAiConfig(role)) return c.json({ error: 'insufficient permissions' }, 403);
    const body = await c.req.json<{ geminiKey?: string; modelId?: string; models?: Partial<Record<string, string>> }>();
    const modelId = body.modelId || DEFAULT_MODEL_ID;
    const policy = await loadModelPolicy(tenantId);
    const allowedItems = filterModelsByPolicy(role, policy);
    if (!allowedItems.some((item) => item.id === modelId)) {
        return c.json({
            error: 'model not allowed by policy for current role',
            modelId,
            allowedModelIds: allowedItems.map((item) => item.id),
        }, 403);
    }

    const existing = await withTenant(tenantId, (tx) =>
        tx.policyConfig.findFirst({ where: { tenantId, policyKey: 'ai_integrations' } })
    );
    const currentConfig = (existing?.policyValue as AIConfig) ?? {};

    const policyValue: AIConfig = {
        geminiKey: body.geminiKey !== undefined ? body.geminiKey : currentConfig.geminiKey,
        modelId,
    };
    if (body.models !== undefined) {
        policyValue.models = body.models as Partial<Record<WorkType, string>>;
    } else if (currentConfig.models) {
        policyValue.models = currentConfig.models;
    }

    if (existing) {
        await withTenant(tenantId, (tx) =>
            tx.policyConfig.update({
                where: { id: existing.id },
                data: { policyValue: policyValue as any }
            })
        );
    } else {
        await withTenant(tenantId, (tx) =>
            tx.policyConfig.create({
                data: {
                    tenantId,
                    policyKey: 'ai_integrations',
                    policyValue: policyValue as any,
                    effectiveFrom: new Date()
                }
            })
        );
    }

    return c.json({ success: true });
});

mdm.post('/ai-config/test', async (c) => {
    const tenantId = requireTenantId(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const role = getAuthRole(c);
    if (!canManageAiConfig(role)) return c.json({ error: 'insufficient permissions' }, 403);
    const body = await c.req.json<{ geminiKey?: string; modelId?: string; useStoredKey?: boolean }>();

    let keyToTest: string | undefined;
    let modelToTest = body.modelId || DEFAULT_MODEL_ID;

    if (body.useStoredKey === true) {
        const existing = await withTenant(tenantId, (tx) =>
            tx.policyConfig.findFirst({ where: { tenantId, policyKey: 'ai_integrations' } })
        );
        if (existing) {
            const val = existing.policyValue as any;
            keyToTest = val?.geminiKey;
            modelToTest = body.modelId || val?.modelId || modelToTest;
        }
        if (!keyToTest) {
            return c.json({ error: 'No stored API key found for this tenant' }, 400);
        }
    } else {
        if (!body.geminiKey) {
            return c.json({ error: 'geminiKey is required when useStoredKey is not set' }, 400);
        }
        keyToTest = body.geminiKey;
    }

    const policy = await loadModelPolicy(tenantId);
    const allowedItems = filterModelsByPolicy(role, policy);
    if (!allowedItems.some((item) => item.id === modelToTest)) {
        return c.json({
            error: 'model not allowed by policy for current role',
            modelId: modelToTest,
            allowedModelIds: allowedItems.map((item) => item.id),
        }, 403);
    }

    try {
        const rawText = await ModelRouter.probe(keyToTest, modelToTest);
        if (rawText.toLowerCase().includes('ok')) {
            return c.json({ success: true, message: 'Connection verified! Gemini is responding correctly.' });
        } else {
            return c.json({ error: 'Unexpected response from AI', details: rawText }, 500);
        }
    } catch (e: any) {
        console.error('[AI Test Error]', e);
        return c.json({ error: 'Connection failed', details: e.message }, 500);
    }
});

export { mdm as mdmPrimitivesRoutes };
