import { Hono } from 'hono';
import { prisma } from './db.js';
import { ModelRouter, ModelRouterError, WorkType } from './model-router.js';

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return fn(tx as typeof prisma);
    });
}

function tid(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }) {
    return c.req.header('x-tenant-id') ?? c.req.query('tenantId') ?? null;
}

const kg = new Hono();

// Generate deep Schema.org JSON-LD payloads for Google SGE
kg.get('/products/:id/graph/json-ld', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: {
                brand: true,
                category: true,
            },
        }),
    );

    if (!product) return c.json({ error: 'not found' }, 404);

    // Convert structured features, scenarios, intents into JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: product.name,
        sku: product.sku,
        brand: {
            '@type': 'Brand',
            name: product.brand?.name || '',
        },
        category: product.category?.name || '',
        additionalProperty: Object.entries((product.structuredFeatures as Record<string, any>) || {}).map(([key, val]) => ({
            '@type': 'PropertyValue',
            name: key,
            value: val?.value || val,
            unitText: val?.unit || undefined,
        })),
        audience: {
            '@type': 'Audience',
            audienceType: product.targetIntents || [],
        },
        disambiguatingDescription: product.scenarios?.join(', ') || undefined,
        // Add L5 competitive edges in a custom property or description
        description: `Features: ${Object.keys((product.structuredFeatures as Record<string, any>) || {}).join(', ')}. Scenarios: ${(product.scenarios || []).join(', ')}.`,
    };

    return c.json({ jsonLd });
});

// Generate context strings optimized for Amazon Rufus
kg.get('/products/:id/graph/rufus-context', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: { brand: true },
        }),
    );

    if (!product) return c.json({ error: 'not found' }, 404);

    const contextData = {
        coreIdentity: `${product.brand?.name || 'Unknown'} ${product.name}`,
        semanticFeatures: product.structuredFeatures || {},
        usageScenarios: product.scenarios || [],
        userIntents: product.targetIntents || [],
        competitiveAdvantages: product.competitiveEdges || {},
        triggerKeywords: [
            ...((product.scenarios || []) as string[]),
            ...((product.targetIntents || []) as string[]),
        ].filter(Boolean),
    };

    // Convert to natural language strings for Rufus embedding
    const rufusContext = `
PRODUCT CONTEXT FOR RUFUS
Identity: ${contextData.coreIdentity}
Features: ${JSON.stringify(contextData.semanticFeatures)}
Best For: ${contextData.usageScenarios.join(', ')}
Solves: ${contextData.userIntents.join(', ')}
Why Buy: ${JSON.stringify(contextData.competitiveAdvantages)}
`.trim();

    return c.json({ rufusContext, rawData: contextData });
});

// Standardized outputs for integration with Model Context Protocol (MCP)
kg.get('/products/:id/graph/mcp', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: {
                brand: true,
                category: true,
                commodities: { include: { market: true } },
            },
        }),
    );

    if (!product) return c.json({ error: 'not found' }, 404);

    const mcpPayload = {
        mcpVersion: '1.0',
        entity: {
            id: product.id,
            type: 'Product',
            l1_entity: {
                name: product.name,
                sku: product.sku,
                brand: product.brand?.name,
                category: product.category?.name,
            },
            l2_features: product.structuredFeatures || {},
            l3_scenarios: product.scenarios || [],
            l4_intents: product.targetIntents || [],
            l5_competitive: product.competitiveEdges || {},
            localizations: product.commodities.map((cmd) => ({
                market: cmd.market.code,
                language: cmd.language,
                basePricing: { cost: cmd.localBaseCost, msrp: cmd.localMsrp },
                warranty: cmd.warrantyPeriodMonths,
            })),
        },
    };

    return c.json(mcpPayload);
});

kg.post('/products/:id/graph/generate', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: { brand: true, category: true },
        }),
    );

    if (!product) return c.json({ error: 'not found' }, 404);

    try {
        const prompt = `
        You are an expert e-commerce catalog taxonomist and AI agent data structurer.
        Generate deep knowledge graph metadata for the following product:
        Name: ${product.name}
        SKU: ${product.sku}
        Brand: ${product.brand?.name || 'Unknown'}
        Category: ${product.category?.name || 'Unknown'}

        Respond EXACTLY with a JSON object (no markdown formatting, no backticks) with these exact 4 keys:
        - "structuredFeatures": A key-value object of technical and semantic features. (e.g. {"material": "steel", "capacity": "1.5L"})
        - "scenarios": An array of strings describing perfect use cases. (e.g. ["Camping", "Quick morning coffee"])
        - "targetIntents": An array of strings representing user search intents. (e.g. ["portable coffee maker", "travel espresso"])
        - "competitiveEdges": A key-value object outlining competitive advantages against generic alternatives. (e.g. {"durability": "military grade plastic"})
        `;

        const rawText = await ModelRouter.call(
            WorkType.KNOWLEDGE_GRAPH_GENERATION,
            tenantId,
            prompt,
        );
        const jsonStr = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const kgData = JSON.parse(jsonStr);

        const updated = await withTenant(tenantId, (tx) =>
            tx.product.update({
                where: { id: product.id },
                data: {
                    structuredFeatures: kgData.structuredFeatures || {},
                    scenarios: kgData.scenarios || [],
                    targetIntents: kgData.targetIntents || [],
                    competitiveEdges: kgData.competitiveEdges || {},
                },
            })
        );

        return c.json({ success: true, item: updated });
    } catch (err) {
        if (err instanceof ModelRouterError) {
            return c.json({ error: err.message }, 500);
        }
        console.error("AI Gen Error:", err);
        return c.json({ error: "Failed to generate AI data." }, 500);
    }
});

kg.post('/products/:id/graph/generate-commodity', async (c) => {
    const tenantId = tid(c);
    if (!tenantId) return c.json({ error: 'tenantId required' }, 400);
    const id = c.req.param('id');
    const { marketId, language } = await c.req.json<{ marketId: string; language: string }>();

    const product = await withTenant(tenantId, (tx) =>
        tx.product.findFirst({
            where: { id, tenantId },
            include: { brand: true, category: true },
        }),
    );

    if (!product) return c.json({ error: 'not found' }, 404);

    const market = await withTenant(tenantId, (tx) =>
        tx.market.findFirst({ where: { id: marketId, tenantId } })
    );
    if (!market) return c.json({ error: 'market not found' }, 404);

    try {
        const prompt = `
            You are a professional e-commerce localization expert.
            Generate a localized product Title and Bullet Points for the following product DNA in the context of the "${market.name}" market and "${language}" language.

            Product DNA:
            Name: ${product.name}
            Brand: ${product.brand?.name || 'Unknown'}
            Category: ${product.category?.name || 'Unknown'}
            Features: ${JSON.stringify(product.structuredFeatures)}
            Scenarios: ${product.scenarios.join(', ')}

            Respond EXACTLY with a JSON object (no markdown, no backticks) with these keys:
            - "title": A localized title (max 200 chars).
            - "bulletPoints": An array of 5 localized bullet points highlighting specific market benefits.
        `;

        const rawText = await ModelRouter.call(
            WorkType.KNOWLEDGE_GRAPH_GENERATION,
            tenantId,
            prompt,
        );
        const jsonStr = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const genData = JSON.parse(jsonStr);

        // Create or Update Commodity
        const commodity = await withTenant(tenantId, (tx) =>
            tx.commodity.upsert({
                where: {
                    productId_marketId_language: {
                        productId: id,
                        marketId: market.id,
                        language
                    }
                },
                update: {
                    title: genData.title,
                    bulletPoints: genData.bulletPoints,
                },
                create: {
                    tenantId,
                    productId: id,
                    marketId: market.id,
                    language,
                    title: genData.title,
                    bulletPoints: genData.bulletPoints,
                },
                include: { market: true }
            })
        );

        return c.json({ success: true, item: commodity });
    } catch (err) {
        if (err instanceof ModelRouterError) {
            return c.json({ error: err.message }, 500);
        }
        console.error("AI Commodity Gen Error:", err);
        return c.json({ error: "Failed to generate localized commodity data." }, 500);
    }
});

export { kg as knowledgeGraphRoutes };
