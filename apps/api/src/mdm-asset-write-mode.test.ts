/**
 * MAPPING_WRITE_MODE 三态行为测试（Issue C-3）
 * 验证旧路由在不同模式下是否正确写入 external_id_mapping
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { prisma } from './db.js';
import { mdmAssetRoutes } from './mdm-asset-routes.js';
import * as envModule from './env.js';

const TENANT_ID = '60000000-0000-0000-0000-000000000006';
const PRODUCT_ID = 'cccccccc-0000-0000-0000-000000000001';
const PLATFORM_ID = 'dddddddd-0000-0000-0000-000000000002';

const app = new Hono<{ Variables: { auth: any } }>();
app.use('*', async (c, next) => {
  c.set('auth', { userId: 'test-ops', tenantId: TENANT_ID, role: 'operator', scopes: [], authMode: 'passthrough' } as any);
  await next();
});
app.route('/mdm', mdmAssetRoutes);

async function seedListing(extId: string) {
  const commodity = await prisma.commodity.findFirst({ where: { tenantId: TENANT_ID } });
  if (!commodity) throw new Error('No commodity found — check seed data');
  return prisma.listing.create({
    data: {
      tenantId: TENANT_ID,
      platformId: PLATFORM_ID,
      externalListingId: extId,
      title: `Test Listing ${extId}`,
      commodityId: commodity.id,
      mappingStatus: 'pending',
    },
  });
}

describe('MAPPING_WRITE_MODE — listing routes', () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, code: 'WMTEST', name: 'Write Mode Test Tenant' },
    });
  });

  beforeEach(async () => {
    await prisma.mappingHistory.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('MAPPING_WRITE_MODE=legacy: listing map does NOT write external_id_mapping', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'legacy',
    });

    const listing = await seedListing('EXT-LEGACY-001');
    const res = await app.request(`/mdm/listings/${listing.id}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ commodityId: listing.commodityId }),
    });
    expect(res.status).toBe(200);

    const count = await prisma.externalIdMapping.count({ where: { tenantId: TENANT_ID } });
    expect(count).toBe(0);
  });

  it('MAPPING_WRITE_MODE=dual (default): listing map writes external_id_mapping APPROVED', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'dual',
    });

    const listing = await seedListing('EXT-DUAL-001');
    const res = await app.request(`/mdm/listings/${listing.id}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ commodityId: listing.commodityId }),
    });
    expect(res.status).toBe(200);

    const mapping = await prisma.externalIdMapping.findFirst({ where: { tenantId: TENANT_ID, externalId: 'EXT-DUAL-001' } });
    expect(mapping).not.toBeNull();
    expect(mapping?.status).toBe('APPROVED');
  });

  it('MAPPING_WRITE_MODE=new_only: listing map writes external_id_mapping APPROVED', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'new_only',
    });

    const listing = await seedListing('EXT-NEWONLY-001');
    const res = await app.request(`/mdm/listings/${listing.id}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ commodityId: listing.commodityId }),
    });
    expect(res.status).toBe(200);

    const mapping = await prisma.externalIdMapping.findFirst({ where: { tenantId: TENANT_ID, externalId: 'EXT-NEWONLY-001' } });
    expect(mapping).not.toBeNull();
    expect(mapping?.status).toBe('APPROVED');
  });

  it('MAPPING_WRITE_MODE=legacy: listing reject does NOT write external_id_mapping', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'legacy',
    });

    const listing = await seedListing('EXT-LEGACY-REJ-001');
    const res = await app.request(`/mdm/listings/${listing.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ reason: 'test reject' }),
    });
    expect(res.status).toBe(200);

    const count = await prisma.externalIdMapping.count({ where: { tenantId: TENANT_ID } });
    expect(count).toBe(0);
  });

  it('MAPPING_WRITE_MODE=dual: listing reject writes external_id_mapping REJECTED', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'dual',
    });

    const listing = await seedListing('EXT-DUAL-REJ-001');
    const res = await app.request(`/mdm/listings/${listing.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ reason: 'test reject' }),
    });
    expect(res.status).toBe(200);

    const mapping = await prisma.externalIdMapping.findFirst({ where: { tenantId: TENANT_ID, externalId: 'EXT-DUAL-REJ-001' } });
    expect(mapping).not.toBeNull();
    expect(mapping?.status).toBe('REJECTED');
  });
});

describe('MAPPING_WRITE_MODE — SKU mapping routes', () => {
  let skuId: string;

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, code: 'WMTEST', name: 'Write Mode Test Tenant' },
    });
    const sku = await prisma.externalSkuMapping.create({
      data: {
        tenantId: TENANT_ID,
        sourceType: 'amazon',
        sourceId: 'ASIN-SRC-001',
        externalSku: 'SKU-WM-001',
        mappingStatus: 'pending',
      },
    });
    skuId = sku.id;
  });

  beforeEach(async () => {
    await prisma.mappingHistory.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalSkuMapping.update({ where: { id: skuId }, data: { mappingStatus: 'pending', productId: null } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('MAPPING_WRITE_MODE=new_only: sku map does NOT update old table mappingStatus', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'new_only',
    });

    const product = await prisma.product.findFirst({ where: { tenantId: TENANT_ID } });
    if (!product) return;

    await app.request(`/mdm/sku-mappings/${skuId}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ productId: product.id }),
    });

    const sku = await prisma.externalSkuMapping.findUnique({ where: { id: skuId } });
    expect(sku?.mappingStatus).toBe('pending');

    const mapping = await prisma.externalIdMapping.findFirst({ where: { tenantId: TENANT_ID, externalId: 'SKU-WM-001' } });
    expect(mapping).not.toBeNull();
    expect(mapping?.status).toBe('APPROVED');
  });

  it('MAPPING_WRITE_MODE=legacy: sku map updates old table but NOT new table', async () => {
    vi.spyOn(envModule, 'env', 'get').mockReturnValue({
      ...envModule.env,
      MAPPING_WRITE_MODE: 'legacy',
    });

    const product = await prisma.product.findFirst({ where: { tenantId: TENANT_ID } });
    if (!product) return;

    const res = await app.request(`/mdm/sku-mappings/${skuId}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ productId: product.id }),
    });
    expect(res.status).toBe(200);

    const sku = await prisma.externalSkuMapping.findUnique({ where: { id: skuId } });
    expect(sku?.mappingStatus).toBe('mapped');

    const count = await prisma.externalIdMapping.count({ where: { tenantId: TENANT_ID } });
    expect(count).toBe(0);
  });
});
