import { describe, expect, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { Hono } from 'hono';
import { mdmPrimitivesRoutes } from './mdm-primitives-routes.js';
import { prisma } from './db.js';

const app = new Hono();
app.route('/mdm', mdmPrimitivesRoutes);

describe('MDM Primitives Deletion API', () => {
    const TENANT_A = '10000000-0000-0000-0000-000000000001';
    const TENANT_B = '20000000-0000-0000-0000-000000000002';

    beforeAll(async () => {
        await prisma.tenant.upsert({
            where: { id: TENANT_A },
            update: {},
            create: { id: TENANT_A, name: 'Test Tenant A', code: 'TTA' }
        });
        await prisma.tenant.upsert({
            where: { id: TENANT_B },
            update: {},
            create: { id: TENANT_B, name: 'Test Tenant B', code: 'TTB' }
        });
    });

    describe('Markets Deletion', () => {
        it('should successfully delete a market with no dependencies', async () => {
            const market = await prisma.market.create({
                data: { tenantId: TENANT_A, code: 'TEST-MK-1', name: 'Test Market 1' }
            });
            const res = await app.request(`/mdm/markets/${market.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(200);
            const found = await prisma.market.findUnique({ where: { id: market.id } });
            expect(found).toBeNull();
        });

        it('should fail with 403 if tenantId mismatch (Ownership Check)', async () => {
            const market = await prisma.market.create({
                data: { tenantId: TENANT_A, code: 'TEST-MK-OWN', name: 'Test Ownership Market' }
            });
            const res = await app.request(`/mdm/markets/${market.id}?tenantId=${TENANT_B}`, { method: 'DELETE' });
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error).toBe('Ownership mismatch');
            await prisma.market.delete({ where: { id: market.id } });
        });

        it('should fail with 409 if market has associated commodities (Dependency Check)', async () => {
            const market = await prisma.market.create({ data: { tenantId: TENANT_A, code: 'MK-DEP', name: 'Market with Dep' } });
            const brand = await prisma.brand.create({ data: { tenantId: TENANT_A, code: 'BR-DEP', name: 'Brand' } });
            const category = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-DEP', name: 'Category' } });
            const product = await prisma.product.create({
                data: { tenantId: TENANT_A, sku: 'SKU-DEP', name: 'Product', brandId: brand.id, categoryId: category.id }
            });
            await prisma.commodity.create({
                data: { tenantId: TENANT_A, productId: product.id, marketId: market.id, language: 'EN', title: 'Test Commodity' }
            });

            const res = await app.request(`/mdm/markets/${market.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(409);

            await prisma.commodity.deleteMany({ where: { marketId: market.id } });
            await prisma.product.delete({ where: { id: product.id } });
            await prisma.category.delete({ where: { id: category.id } });
            await prisma.brand.delete({ where: { id: brand.id } });
            await prisma.market.delete({ where: { id: market.id } });
        });

        it('should return 404 if market does not exist', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await app.request(`/mdm/markets/${fakeId}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(404);
        });
    });

    describe('Categories Deletion', () => {
        it('should fail with 409 if category has subcategories', async () => {
            const parent = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-PARENT', name: 'Parent' } });
            const child = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-CHILD', name: 'Child', parentId: parent.id } });
            const res = await app.request(`/mdm/categories/${parent.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(409);
            await prisma.category.delete({ where: { id: child.id } });
            await prisma.category.delete({ where: { id: parent.id } });
        });

        it('should fail with 409 if category has associated products', async () => {
            const category = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-PROD', name: 'Has Products' } });
            const brand = await prisma.brand.create({ data: { tenantId: TENANT_A, code: 'BR-CAT', name: 'Brand' } });
            const product = await prisma.product.create({
                data: { tenantId: TENANT_A, sku: 'SKU-CAT-PROD', name: 'Prod', brandId: brand.id, categoryId: category.id }
            });
            const res = await app.request(`/mdm/categories/${category.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(409);
            await prisma.product.delete({ where: { id: product.id } });
            await prisma.category.delete({ where: { id: category.id } });
            await prisma.brand.delete({ where: { id: brand.id } });
        });
    });

    describe('Brands Deletion', () => {
        it('should fail with 409 if brand has associated products', async () => {
            const brand = await prisma.brand.create({ data: { tenantId: TENANT_A, code: 'BR-FAIL', name: 'Brand' } });
            const category = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-BR', name: 'Cat' } });
            const product = await prisma.product.create({
                data: { tenantId: TENANT_A, sku: 'SKU-BR-DEP', name: 'Prod', brandId: brand.id, categoryId: category.id }
            });
            const res = await app.request(`/mdm/brands/${brand.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(409);
            await prisma.product.delete({ where: { id: product.id } });
            await prisma.brand.delete({ where: { id: brand.id } });
            await prisma.category.delete({ where: { id: category.id } });
        });
    });

    describe('Suppliers Deletion', () => {
        it('should fail with 409 if supplier has associated products', async () => {
            const supplier = await prisma.supplier.create({ data: { tenantId: TENANT_A, code: 'SUP-DEP', name: 'Supplier' } });
            const brand = await prisma.brand.create({ data: { tenantId: TENANT_A, code: 'BR-SUP', name: 'Brand' } });
            const category = await prisma.category.create({ data: { tenantId: TENANT_A, code: 'CAT-SUP', name: 'Category' } });
            const product = await prisma.product.create({
                data: { tenantId: TENANT_A, sku: 'SKU-SUP-DEP', name: 'Prod', brandId: brand.id, categoryId: category.id, supplierId: supplier.id }
            });
            const res = await app.request(`/mdm/suppliers/${supplier.id}?tenantId=${TENANT_A}`, { method: 'DELETE' });
            expect(res.status).toBe(409);
            await prisma.product.delete({ where: { id: product.id } });
            await prisma.supplier.delete({ where: { id: supplier.id } });
            await prisma.brand.delete({ where: { id: brand.id } });
            await prisma.category.delete({ where: { id: category.id } });
        });
    });
});

describe('AI Model Policy API', () => {
    const TENANT_A = '10000000-0000-0000-0000-000000000001';

    function createAuthedApp(role: 'tenant_admin' | 'operator') {
        const authed = new Hono<{ Variables: { auth: any } }>();
        authed.use('*', async (c, next) => {
            c.set('auth', {
                userId: `test-${role}`,
                tenantId: c.req.header('x-tenant-id') ?? TENANT_A,
                role,
                scopes: [],
                authMode: 'passthrough',
            } as any);
            await next();
        });
        authed.route('/mdm', mdmPrimitivesRoutes);
        return authed;
    }

    const tenantAdminApp = createAuthedApp('tenant_admin');
    const operatorApp = createAuthedApp('operator');

    beforeEach(async () => {
        await prisma.policyConfig.deleteMany({
            where: { tenantId: TENANT_A, policyKey: 'ai_model_policy' },
        });
        await prisma.policyConfig.deleteMany({
            where: { tenantId: TENANT_A, policyKey: 'ai_integrations' },
        });
        await prisma.securityAuditEvent.deleteMany({
            where: {
                tenantId: TENANT_A,
                eventType: { in: ['AI_MODEL_POLICY_UPDATED', 'AI_MODEL_POLICY_CLEARED'] }
            },
        });
    });

    it('should deny operator from reading model policy config', async () => {
        const res = await operatorApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'GET',
            headers: { 'x-tenant-id': TENANT_A },
        });
        expect(res.status).toBe(403);
    });

    it('should deny operator from writing ai config', async () => {
        const res = await operatorApp.request(`/mdm/ai-config?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({ geminiKey: 'k', modelId: 'gemini-2.5-flash' }),
        });
        expect(res.status).toBe(403);
    });

    it('should save policy and sanitize unknown model ids', async () => {
        const res = await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash', 'unknown-model'],
                    roleOverrides: {
                        operator: {
                            allowedModelIds: ['gemini-1.5-flash', 'bad-id'],
                            includeLegacy: true,
                        },
                    },
                },
            }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.policy.allowedModelIds).toEqual(['gemini-2.5-flash']);
        expect(body.policy.roleOverrides.operator.allowedModelIds).toEqual(['gemini-1.5-flash']);
    });

    it('should apply policy filtering for operator model catalog', async () => {
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash', 'gemini-3.1-pro'],
                    roleOverrides: {
                        operator: {
                            blockedModelIds: ['gemini-3.1-pro'],
                        },
                    },
                },
            }),
        });

        const res = await operatorApp.request(`/mdm/ai-config/models?tenantId=${TENANT_A}`, {
            method: 'GET',
            headers: { 'x-tenant-id': TENANT_A },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = (body.items as Array<{ id: string }>).map((x) => x.id);
        expect(ids).toEqual(['gemini-2.5-flash']);
        expect(body.policyApplied).toBe(true);
        expect(body.canEditModel).toBe(false);
    });

    it('should block tenant admin from saving disallowed model', async () => {
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash'],
                },
            }),
        });

        const res = await tenantAdminApp.request(`/mdm/ai-config?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({ geminiKey: 'k', modelId: 'gemini-1.5-pro' }),
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('model not allowed');
        expect(body.allowedModelIds).toEqual(['gemini-2.5-flash']);
    });

    it('should write audit event when model policy is updated', async () => {
        const res = await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash'],
                },
            }),
        });
        expect(res.status).toBe(200);

        const events = await prisma.securityAuditEvent.findMany({
            where: { tenantId: TENANT_A, eventType: 'AI_MODEL_POLICY_UPDATED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        expect(events.length).toBe(1);
        const details = (events[0]?.details ?? {}) as any;
        expect(details.actorRole).toBe('tenant_admin');
        expect(details.actorUserId).toBe('test-tenant_admin');
        expect(details.newPolicy.allowedModelIds).toEqual(['gemini-2.5-flash']);
    });

    it('should write audit event when model policy is cleared', async () => {
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash'],
                },
            }),
        });
        const clearRes = await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({ policy: null }),
        });
        expect(clearRes.status).toBe(200);

        const events = await prisma.securityAuditEvent.findMany({
            where: { tenantId: TENANT_A, eventType: 'AI_MODEL_POLICY_CLEARED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        expect(events.length).toBe(1);
        const details = (events[0]?.details ?? {}) as any;
        expect(details.actorRole).toBe('tenant_admin');
        expect(details.newPolicy).toBeNull();
    });

    it('should return audit history via model-policy audit endpoint', async () => {
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: true,
                },
            }),
        });
        const res = await tenantAdminApp.request(`/mdm/ai-config/model-policy/audit?tenantId=${TENANT_A}&limit=5`, {
            method: 'GET',
            headers: { 'x-tenant-id': TENANT_A },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items[0].eventType).toBe('AI_MODEL_POLICY_UPDATED');
    });

    it('should filter audit history by event type', async () => {
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({
                policy: {
                    includeLegacyByDefault: false,
                    allowedModelIds: ['gemini-2.5-flash'],
                },
            }),
        });
        await tenantAdminApp.request(`/mdm/ai-config/model-policy?tenantId=${TENANT_A}`, {
            method: 'POST',
            headers: { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' },
            body: JSON.stringify({ policy: null }),
        });

        const res = await tenantAdminApp.request(
            `/mdm/ai-config/model-policy/audit?tenantId=${TENANT_A}&eventType=AI_MODEL_POLICY_CLEARED&limit=20`,
            {
                method: 'GET',
                headers: { 'x-tenant-id': TENANT_A },
            },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items.every((item: { eventType: string }) => item.eventType === 'AI_MODEL_POLICY_CLEARED')).toBe(true);
    });
});
