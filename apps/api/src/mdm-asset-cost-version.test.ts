import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { prisma } from './db.js';
import { mdmAssetRoutes } from './mdm-asset-routes.js';
import { onMdmEvent, type MdmEvent } from './mdm-events.js';

const app = new Hono();
app.route('/mdm', mdmAssetRoutes);

describe('MDM Asset CostVersion API', () => {
  const TENANT_ID = '30000000-0000-0000-0000-000000000003';
  const eventBucket: MdmEvent[] = [];

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, code: 'TTC', name: 'Test Tenant CostVersion' },
    });
    onMdmEvent('entity.cost.updated', async (event) => {
      eventBucket.push(event);
    });
  });

  beforeEach(async () => {
    eventBucket.length = 0;
    await prisma.costVersion.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalSkuMapping.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.productChangeLog.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.category.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.brand.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  async function createBaseEntities() {
    const brand = await prisma.brand.create({
      data: {
        tenantId: TENANT_ID,
        code: `BR-CV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: 'Cost Brand',
      },
    });
    const category = await prisma.category.create({
      data: {
        tenantId: TENANT_ID,
        code: `CAT-CV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: 'Cost Category',
      },
    });
    return { brand, category };
  }

  it('creates initial CostVersion on product create with costPrice', async () => {
    const { brand, category } = await createBaseEntities();

    const res = await app.request(`/mdm/products?tenantId=${TENANT_ID}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-a' },
      body: JSON.stringify({
        brandId: brand.id,
        categoryId: category.id,
        sku: `SKU-CV-CREATE-${Date.now()}`,
        name: 'Cost Create Product',
        costPrice: 10.5,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const productId = body.item.id as string;

    const versions = await prisma.costVersion.findMany({
      where: { tenantId: TENANT_ID, productGlobalId: productId },
      orderBy: { createdAt: 'asc' },
    });
    expect(versions.length).toBe(1);
    expect(Number(versions[0].purchaseCost)).toBe(10.5);
    expect(versions[0].status).toBe('ACTIVE');
    expect(versions[0].sourceSystem).toBe('product_create');
    expect(versions[0].changedBy).toBe('tester-a');

    expect(eventBucket.length).toBe(1);
    const first = eventBucket[0];
    if (first.type !== 'entity.cost.updated') throw new Error('unexpected event type');
    expect(first.payload.productGlobalId).toBe(productId);
    expect(first.payload.costVersionId).toBe(versions[0].id);
  });

  it('rotates CostVersion on product costPrice update', async () => {
    const { brand, category } = await createBaseEntities();

    const createRes = await app.request(`/mdm/products?tenantId=${TENANT_ID}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-b' },
      body: JSON.stringify({
        brandId: brand.id,
        categoryId: category.id,
        sku: `SKU-CV-ROTATE-${Date.now()}`,
        name: 'Cost Rotate Product',
        costPrice: 12.0,
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const productId = createBody.item.id as string;

    const updateRes = await app.request(`/mdm/products/${productId}?tenantId=${TENANT_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-c' },
      body: JSON.stringify({ costPrice: 14.25 }),
    });
    expect(updateRes.status).toBe(200);

    const versions = await prisma.costVersion.findMany({
      where: { tenantId: TENANT_ID, productGlobalId: productId },
      orderBy: { effectiveFrom: 'asc' },
    });
    expect(versions.length).toBe(2);
    expect(Number(versions[0].purchaseCost)).toBe(12);
    expect(Number(versions[1].purchaseCost)).toBe(14.25);
    expect(versions[0].effectiveTo).not.toBeNull();
    expect(versions[1].effectiveTo).toBeNull();
    expect(versions[1].sourceSystem).toBe('product_update');
    expect(versions[1].changedBy).toBe('tester-c');

    expect(eventBucket.length).toBe(2);
    const last = eventBucket.at(-1);
    if (!last || last.type !== 'entity.cost.updated') throw new Error('missing cost event');
    expect(last.payload.productGlobalId).toBe(productId);
  });

  it('supports manual create + revoke of CostVersion and emits events', async () => {
    const { brand, category } = await createBaseEntities();

    const createRes = await app.request(`/mdm/products?tenantId=${TENANT_ID}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-d' },
      body: JSON.stringify({
        brandId: brand.id,
        categoryId: category.id,
        sku: `SKU-CV-MANUAL-${Date.now()}`,
        name: 'Cost Manual Product',
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const productId = createBody.item.id as string;

    const manualRes = await app.request(`/mdm/products/${productId}/cost-versions?tenantId=${TENANT_ID}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-e' },
      body: JSON.stringify({
        purchaseCost: 20.5,
        shippingCost: 2.2,
        sourceSystem: 'manual_test',
        reason: 'manual create',
      }),
    });
    expect(manualRes.status).toBe(201);
    const manualBody = await manualRes.json();
    const costVersionId = manualBody.item.id as string;

    const revokeRes = await app.request(
      `/mdm/products/${productId}/cost-versions/${costVersionId}/revoke?tenantId=${TENANT_ID}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-f' },
        body: JSON.stringify({ reason: 'manual revoke' }),
      },
    );
    expect(revokeRes.status).toBe(200);

    const revoked = await prisma.costVersion.findUnique({ where: { id: costVersionId } });
    expect(revoked).not.toBeNull();
    expect(revoked?.status).toBe('INACTIVE');
    expect(revoked?.effectiveTo).not.toBeNull();
    expect(revoked?.changedBy).toBe('tester-f');

    const costEvents = eventBucket.filter((e) => e.type === 'entity.cost.updated' && e.payload.costVersionId === costVersionId);
    expect(costEvents.length).toBe(2);
  });

  it('returns only active rows from approved_cost_version view endpoint', async () => {
    const { brand, category } = await createBaseEntities();

    const createRes = await app.request(`/mdm/products?tenantId=${TENANT_ID}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-g' },
      body: JSON.stringify({
        brandId: brand.id,
        categoryId: category.id,
        sku: `SKU-CV-VIEW-${Date.now()}`,
        name: 'Cost View Product',
        costPrice: 30,
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const productId = createBody.item.id as string;

    const updateRes = await app.request(`/mdm/products/${productId}?tenantId=${TENANT_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-user-id': 'tester-h' },
      body: JSON.stringify({ costPrice: 31 }),
    });
    expect(updateRes.status).toBe(200);

    const approvedRes = await app.request(
      `/mdm/cost-versions/approved?tenantId=${TENANT_ID}&productGlobalId=${productId}&limit=10`,
      { method: 'GET', headers: { 'x-tenant-id': TENANT_ID } },
    );
    expect(approvedRes.status).toBe(200);
    const approvedBody = await approvedRes.json();
    expect(Array.isArray(approvedBody.items)).toBe(true);
    expect(approvedBody.items.length).toBe(1);
    expect(approvedBody.items[0].productGlobalId).toBe(productId);
    expect(Number(approvedBody.items[0].purchaseCost)).toBe(31);
  });
});
