import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { prisma } from './db.js';
import { mdmMappingRoutes } from './mdm-mapping-routes.js';

const TENANT_ID = '40000000-0000-0000-0000-000000000004';

function createAuthedApp(role: 'tenant_admin' | 'operator') {
  const authed = new Hono<{ Variables: { auth: any } }>();
  authed.use('*', async (c, next) => {
    c.set('auth', {
      userId: `test-${role}`,
      tenantId: c.req.header('x-tenant-id') ?? TENANT_ID,
      role,
      scopes: [],
      authMode: 'passthrough',
    } as any);
    await next();
  });
  authed.route('/mdm', mdmMappingRoutes);
  return authed;
}

describe('MDM Mapping Approved View API', () => {
  const operatorApp = createAuthedApp('operator');

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, code: 'TTD', name: 'Test Tenant Mapping View' },
    });
  });

  beforeEach(async () => {
    await prisma.mappingHistory.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  it('returns only approved and currently effective mappings from view', async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const thirtySixHoursAgo = new Date(now.getTime() - 36 * 60 * 60 * 1000);

    await prisma.externalIdMapping.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          entityType: 'PRODUCT',
          globalId: 'aaaaaaaa-0000-0000-0000-000000000001',
          sourceSystem: 'erp',
          externalId: 'EXT-APPROVED',
          status: 'APPROVED',
          effectiveFrom: oneDayAgo,
          effectiveTo: oneDayLater,
          createdBy: 'system',
          approvedBy: 'system',
          approvedAt: now,
        },
        {
          tenantId: TENANT_ID,
          entityType: 'PRODUCT',
          globalId: 'bbbbbbbb-0000-0000-0000-000000000002',
          sourceSystem: 'erp',
          externalId: 'EXT-REVOKED',
          status: 'REVOKED',
          effectiveFrom: oneDayAgo,
          effectiveTo: oneDayLater,
          createdBy: 'system',
        },
        {
          tenantId: TENANT_ID,
          entityType: 'PRODUCT',
          globalId: 'cccccccc-0000-0000-0000-000000000003',
          sourceSystem: 'erp',
          externalId: 'EXT-EXPIRED',
          status: 'APPROVED',
          effectiveFrom: twoDaysAgo,
          effectiveTo: thirtySixHoursAgo,
          createdBy: 'system',
          approvedBy: 'system',
          approvedAt: twoDaysAgo,
        },
      ],
    });

    const res = await operatorApp.request(
      `/mdm/mappings/approved?tenantId=${TENANT_ID}&entity_type=PRODUCT&source_system=erp&limit=20`,
      {
        method: 'GET',
        headers: { 'x-tenant-id': TENANT_ID },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(1);
    expect(body.items[0].externalId).toBe('EXT-APPROVED');
    expect(body.items[0].sourceSystem).toBe('erp');
  });
});
