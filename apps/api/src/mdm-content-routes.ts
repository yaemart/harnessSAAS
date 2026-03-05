import { Hono } from 'hono';
import { prisma } from './db.js';

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

// ══════════════════════════════════════════════════════════
//  Category Attribute Schema (with inheritance)
// ══════════════════════════════════════════════════════════

/** Walk the category tree from leaf to root, collecting and merging attribute schemas */
async function getEffectiveAttributeSchema(tx: typeof prisma, tenantId: string, categoryId: string) {
    const chain: string[] = [];
    let current: string | null = categoryId;

    // Walk up the tree
    while (current) {
        chain.push(current);
        const cat: { parentId: string | null } | null = await tx.category.findFirst({ where: { id: current, tenantId }, select: { parentId: true } });
        current = cat?.parentId ?? null;
    }

    // Reverse so root is first → child overrides parent on same fieldKey
    chain.reverse();

    const allSchemas = await tx.categoryAttributeSchema.findMany({
        where: { categoryId: { in: chain } },
        orderBy: { sortOrder: 'asc' },
    });

    // Merge: later entries (child) override earlier (parent) for same fieldKey
    const merged = new Map<string, (typeof allSchemas)[0]>();
    for (const schema of allSchemas) {
        merged.set(schema.fieldKey, schema);
    }
    return Array.from(merged.values());
}

mdm.get('/categories/:id/attribute-schema', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const effective = await withTenant(tenantId, (tx) => getEffectiveAttributeSchema(tx, tenantId, id));
    return c.json({ items: effective });
});

mdm.post('/categories/:id/attribute-schema', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const categoryId = c.req.param('id');
    const body = await c.req.json<{
        fieldKey: string; fieldLabel: string; fieldType: string;
        enumValues?: string[]; required?: boolean; aiHint?: string; sortOrder?: number;
    }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.categoryAttributeSchema.create({
            data: { categoryId, fieldKey: body.fieldKey, fieldLabel: body.fieldLabel, fieldType: body.fieldType, enumValues: body.enumValues ?? [], required: body.required ?? false, aiHint: body.aiHint, sortOrder: body.sortOrder ?? 0 },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/category-attributes/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<Partial<{ fieldLabel: string; fieldType: string; enumValues: string[]; required: boolean; aiHint: string; sortOrder: number }>>();
    const item = await prisma.categoryAttributeSchema.update({ where: { id }, data: body });
    return c.json({ item });
});

mdm.delete('/category-attributes/:id', async (c) => {
    const id = c.req.param('id');
    await prisma.categoryAttributeSchema.delete({ where: { id } });
    return c.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  Commodity Media (videos, content for brand portal + AI)
// ══════════════════════════════════════════════════════════

mdm.get('/commodities/:id/media', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const commodityId = c.req.param('id');
    const type = c.req.query('type');
    const items = await withTenant(tenantId, (tx) =>
        tx.commodityMedia.findMany({
            where: { commodityId, type: type || undefined },
            orderBy: { sortOrder: 'asc' },
        }),
    );
    return c.json({ items });
});

mdm.post('/commodities/:id/media', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const commodityId = c.req.param('id');
    const body = await c.req.json<{
        type: string; title: string; url: string;
        platform?: string; language: string; aiSummary?: string;
        duration?: number; sortOrder?: number;
    }>();
    const item = await withTenant(tenantId, (tx) =>
        tx.commodityMedia.create({
            data: {
                commodityId,
                type: body.type,
                title: body.title,
                url: body.url,
                platform: body.platform ?? 'youtube',
                language: body.language,
                aiSummary: body.aiSummary,
                duration: body.duration,
                sortOrder: body.sortOrder ?? 0,
            },
        }),
    );
    return c.json({ item }, 201);
});

mdm.put('/media/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<Partial<{ title: string; url: string; type: string; aiSummary: string; duration: number; sortOrder: number }>>();
    const item = await prisma.commodityMedia.update({ where: { id }, data: body });
    return c.json({ item });
});

mdm.delete('/media/:id', async (c) => {
    const id = c.req.param('id');
    await prisma.commodityMedia.delete({ where: { id } });
    return c.json({ ok: true });
});

mdm.post('/media/:id/generate-summary', async (c) => {
    const id = c.req.param('id');
    // TODO: Fetch YouTube captions via API → LLM summarize → save as aiSummary
    const media = await prisma.commodityMedia.findFirst({ where: { id } });
    if (!media) return c.json({ error: 'not found' }, 404);
    const summary = `[Auto-generated summary for ${media.title}] — This video covers the key features and usage of the product.`;
    const item = await prisma.commodityMedia.update({ where: { id }, data: { aiSummary: summary } });
    return c.json({ item });
});

export { mdm as mdmContentRoutes };
