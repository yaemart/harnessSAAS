import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { requireRole } from './auth-middleware.js';
import { assertEntityHash, buildEntityHash, isValidGlobalId, type EntityHashType } from './entity-hash.js';

type JsonInput = Prisma.InputJsonValue;

const features = new Hono();

type C = { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } };
function tid(c: C): string | null {
    return c.req.header('x-tenant-id') ?? c.req.query('tenantId') ?? null;
}

features.use('*', requireRole('system_admin', 'tenant_admin', 'operator'));

const DATA_QUALITY_MIN = 0.7;

features.post('/product/:globalId/snapshot', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const productGlobalId = c.req.param('globalId');
    if (!isValidGlobalId(productGlobalId)) {
        return c.json({ error: 'productGlobalId must be a valid UUID. Do not use ASIN, SKU, or ERP Code.' }, 400);
    }

    const body = await c.req.json<{
        snapshotDate: string;
        totalSales?: number;
        totalAdSpend?: number;
        profit?: number;
        inventory?: number;
        acos?: number;
        roas?: number;
        dataQualityScore: number;
        mappingConfidence: number;
        sourceMapping?: string;
        market?: string;
        platform?: string;
        featureJson?: JsonInput;
        writtenBy?: string;
    }>();

    if (typeof body.dataQualityScore !== 'number' || body.dataQualityScore < 0 || body.dataQualityScore > 1) {
        return c.json({ error: 'dataQualityScore must be between 0 and 1' }, 400);
    }

    const snapshotDate = new Date(body.snapshotDate);
    if (isNaN(snapshotDate.getTime())) {
        return c.json({ error: 'invalid snapshotDate' }, 400);
    }

    const snapshot = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const client = tx as typeof prisma;
        const snap = await client.productFeatureSnapshot.upsert({
            where: {
                tenantId_productGlobalId_snapshotDate: { tenantId, productGlobalId, snapshotDate },
            },
            create: {
                tenantId, productGlobalId, snapshotDate,
                totalSales: body.totalSales, totalAdSpend: body.totalAdSpend,
                profit: body.profit, inventory: body.inventory,
                acos: body.acos, roas: body.roas,
                dataQualityScore: body.dataQualityScore,
                mappingConfidence: body.mappingConfidence,
                sourceMapping: body.sourceMapping,
                market: body.market, platform: body.platform,
                featureJson: body.featureJson, writtenBy: body.writtenBy,
            },
            update: {
                totalSales: body.totalSales, totalAdSpend: body.totalAdSpend,
                profit: body.profit, inventory: body.inventory,
                acos: body.acos, roas: body.roas,
                dataQualityScore: body.dataQualityScore,
                mappingConfidence: body.mappingConfidence,
                sourceMapping: body.sourceMapping,
                market: body.market, platform: body.platform,
                featureJson: body.featureJson, writtenBy: body.writtenBy,
            },
        });
        await client.product.updateMany({
            where: { id: productGlobalId, tenantId },
            data: { dataQualityScore: body.dataQualityScore, lastVerifiedAt: new Date() },
        });
        return snap;
    });

    return c.json({ snapshot }, 201);
});

features.get('/product/:globalId/latest', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const productGlobalId = c.req.param('globalId');
    if (!isValidGlobalId(productGlobalId)) {
        return c.json({ error: 'productGlobalId must be a valid UUID. Do not use ASIN, SKU, or ERP Code.' }, 400);
    }

    const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? 30)));
    const market = c.req.query('market');
    const platform = c.req.query('platform');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return (tx as typeof prisma).productFeatureSnapshot.findMany({
            where: {
                tenantId, productGlobalId,
                snapshotDate: { gte: since },
                dataQualityScore: { gte: DATA_QUALITY_MIN },
                ...(market ? { market } : {}),
                ...(platform ? { platform } : {}),
            },
            select: {
                id: true, snapshotDate: true,
                totalSales: true, totalAdSpend: true, profit: true,
                inventory: true, acos: true, roas: true,
                dataQualityScore: true, mappingConfidence: true,
                market: true, platform: true, featureJson: true, writtenBy: true,
                createdAt: true, updatedAt: true,
            },
            orderBy: { snapshotDate: 'desc' },
        });
    });

    return c.json({ productGlobalId, days, market, platform, count: snapshots.length, snapshots });
});

features.post('/decision', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const body = await c.req.json<{
        entityType: EntityHashType;
        globalId: string;
        agentId: string;
        decisionType: string;
        outputAction: JsonInput;
        inputFeatures?: JsonInput;
        confidenceScore?: number;
    }>();

    if (!body.entityType || !body.globalId || !body.agentId || !body.decisionType || !body.outputAction) {
        return c.json({ error: 'entityType, globalId, agentId, decisionType, outputAction are required' }, 400);
    }

    let entityHash: string;
    try {
        entityHash = buildEntityHash(body.entityType, body.globalId);
        assertEntityHash(entityHash);
    } catch (e) {
        return c.json({ error: (e as Error).message }, 400);
    }

    const decision = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return (tx as typeof prisma).decisionLog.create({
            data: {
                tenantId, entityHash, entityType: body.entityType,
                agentId: body.agentId, decisionType: body.decisionType,
                inputFeatures: body.inputFeatures, outputAction: body.outputAction,
                confidenceScore: body.confidenceScore,
            },
        });
    });

    return c.json({ decision }, 201);
});

features.post('/reward', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);

    const body = await c.req.json<{
        entityHash: string;
        rewardType: string;
        rewardValue: number;
        observedAt: string;
        decisionLogId?: string;
        attributionWindowHours?: number;
        rawSignal?: JsonInput;
    }>();

    if (!body.entityHash || !body.rewardType || typeof body.rewardValue !== 'number' || !body.observedAt) {
        return c.json({ error: 'entityHash, rewardType, rewardValue, observedAt are required' }, 400);
    }

    try {
        assertEntityHash(body.entityHash);
    } catch (e) {
        return c.json({ error: (e as Error).message }, 400);
    }

    const observedAt = new Date(body.observedAt);
    if (isNaN(observedAt.getTime())) return c.json({ error: 'invalid observedAt' }, 400);

    const reward = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return (tx as typeof prisma).rewardLog.create({
            data: {
                tenantId, entityHash: body.entityHash,
                rewardType: body.rewardType, rewardValue: body.rewardValue,
                observedAt, decisionLogId: body.decisionLogId,
                attributionWindowHours: body.attributionWindowHours ?? 24,
                rawSignal: body.rawSignal,
            },
        });
    });

    return c.json({ reward }, 201);
});

export { features as featureRoutes };
