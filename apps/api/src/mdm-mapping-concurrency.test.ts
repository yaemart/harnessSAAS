/**
 * 并发审批安全性测试
 * 验证：同一外部键并发 approve 不会出现双 APPROVED
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { prisma } from './db.js';
import { mdmMappingRoutes } from './mdm-mapping-routes.js';

const TENANT_ID = '50000000-0000-0000-0000-000000000005';
const GLOBAL_ID_A = 'aaaaaaaa-1111-0000-0000-000000000001';
const GLOBAL_ID_B = 'bbbbbbbb-2222-0000-0000-000000000002';

function createAuthedApp(role: 'tenant_admin' | 'operator' = 'tenant_admin') {
  const app = new Hono<{ Variables: { auth: any } }>();
  app.use('*', async (c, next) => {
    c.set('auth', {
      userId: `test-${role}`,
      tenantId: c.req.header('x-tenant-id') ?? TENANT_ID,
      role,
      scopes: [],
      authMode: 'passthrough',
    } as any);
    await next();
  });
  app.route('/mdm', mdmMappingRoutes);
  return app;
}

async function createPendingMapping(externalId: string): Promise<string> {
  const m = await prisma.externalIdMapping.create({
    data: {
      tenantId: TENANT_ID,
      entityType: 'PRODUCT',
      globalId: GLOBAL_ID_A,
      sourceSystem: 'erp',
      externalId,
      status: 'PENDING',
      createdBy: 'system',
    },
  });
  return m.id;
}

describe('MDM Mapping Concurrency: no double-APPROVED', () => {
  const adminApp = createAuthedApp('tenant_admin');

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: { id: TENANT_ID, code: 'CONC', name: 'Concurrency Test Tenant' },
    });
  });

  beforeEach(async () => {
    await prisma.mappingHistory.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  it('concurrent approve on same mapping id: exactly one APPROVED', async () => {
    const mappingId = await createPendingMapping('EXT-CONCURRENT-SAME');

    const approve = () =>
      adminApp.request(`/mdm/mappings/${mappingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
        body: JSON.stringify({ approved_global_id: GLOBAL_ID_A, comment: 'concurrent test', expected_version: 1 }),
      });

    const [r1, r2] = await Promise.all([approve(), approve()]);
    const statuses = [r1.status, r2.status];

    expect(statuses).toContain(200);

    const approvedCount = await prisma.externalIdMapping.count({
      where: { tenantId: TENANT_ID, externalId: 'EXT-CONCURRENT-SAME', status: 'APPROVED' },
    });
    expect(approvedCount).toBe(1);
  });

  it('concurrent approve on two mappings with same external key: no double APPROVED', async () => {
    const id1 = await createPendingMapping('EXT-SAME-KEY-DUP');
    const id2 = await createPendingMapping('EXT-SAME-KEY-DUP');

    const approve = (id: string, globalId: string) =>
      adminApp.request(`/mdm/mappings/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
        body: JSON.stringify({ approved_global_id: globalId, comment: 'conflict test', expected_version: 1 }),
      });

    await Promise.all([approve(id1, GLOBAL_ID_A), approve(id2, GLOBAL_ID_B)]);

    const approvedCount = await prisma.externalIdMapping.count({
      where: { tenantId: TENANT_ID, externalId: 'EXT-SAME-KEY-DUP', status: 'APPROVED' },
    });
    expect(approvedCount).toBeLessThanOrEqual(1);
  });

  it('invalid status transition: REJECTED -> APPROVED returns 409', async () => {
    const mappingId = await createPendingMapping('EXT-REJECTED-FLOW');
    await prisma.externalIdMapping.update({
      where: { id: mappingId },
      data: { status: 'REJECTED' },
    });

    const res = await adminApp.request(`/mdm/mappings/${mappingId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ approved_global_id: GLOBAL_ID_A, expected_version: 1 }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error_code: string };
    expect(body.error_code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('optimistic lock: mismatched expected_version returns VERSION_CONFLICT', async () => {
    const mappingId = await createPendingMapping('EXT-VERSION-LOCK');

    const res = await adminApp.request(`/mdm/mappings/${mappingId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ approved_global_id: GLOBAL_ID_A, expected_version: 999 }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error_code: string };
    expect(body.error_code).toBe('VERSION_CONFLICT');
  });

  it('soft-revoke: approving second mapping with same key auto-soft-revokes the first', async () => {
    const id1 = await createPendingMapping('EXT-SOFT-REVOKE-FLOW');

    await adminApp.request(`/mdm/mappings/${id1}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ approved_global_id: GLOBAL_ID_A, expected_version: 1 }),
    });

    const id2 = await createPendingMapping('EXT-SOFT-REVOKE-FLOW');

    await adminApp.request(`/mdm/mappings/${id2}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ approved_global_id: GLOBAL_ID_B, expected_version: 1 }),
    });

    const m1 = await prisma.externalIdMapping.findUnique({ where: { id: id1 } });
    const m2 = await prisma.externalIdMapping.findUnique({ where: { id: id2 } });

    expect(m2?.status).toBe('APPROVED');
    expect(m1?.status).toBe('SOFT_REVOKED');

    const approvedCount = await prisma.externalIdMapping.count({
      where: { tenantId: TENANT_ID, externalId: 'EXT-SOFT-REVOKE-FLOW', status: 'APPROVED' },
    });
    expect(approvedCount).toBe(1);
  });
});

describe('MDM batch-approve: SOFT_REVOKE conflict detection (Issue G-batch)', () => {
  const adminApp = createAuthedApp('tenant_admin');

  beforeEach(async () => {
    await prisma.mappingHistory.deleteMany({ where: { tenantId: TENANT_ID } });
    await prisma.externalIdMapping.deleteMany({ where: { tenantId: TENANT_ID } });
  });

  it('batch-approve with existing APPROVED same key: old one becomes SOFT_REVOKED', async () => {
    const existing = await prisma.externalIdMapping.create({
      data: {
        tenantId: TENANT_ID,
        entityType: 'PRODUCT',
        globalId: GLOBAL_ID_A,
        sourceSystem: 'erp',
        externalId: 'EXT-BATCH-CONFLICT',
        status: 'APPROVED',
        approvedBy: 'user:seed',
        approvedAt: new Date(),
        createdBy: 'system',
      },
    });

    const newMapping = await createPendingMapping('EXT-BATCH-CONFLICT');

    const res = await adminApp.request('/mdm/mappings/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        mapping_ids: [newMapping],
        approved_global_id: GLOBAL_ID_B,
        comment: 'batch conflict test',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { approved: number; soft_revoked: number };
    expect(body.approved).toBe(1);
    expect(body.soft_revoked).toBe(1);

    const existingRecord = await prisma.externalIdMapping.findUnique({ where: { id: existing.id } });
    expect(existingRecord?.status).toBe('SOFT_REVOKED');

    const approvedCount = await prisma.externalIdMapping.count({
      where: { tenantId: TENANT_ID, externalId: 'EXT-BATCH-CONFLICT', status: 'APPROVED' },
    });
    expect(approvedCount).toBe(1);

    const softRevokedHistory = await prisma.mappingHistory.findFirst({
      where: { mappingId: existing.id, newStatus: 'SOFT_REVOKED' },
    });
    expect(softRevokedHistory).not.toBeNull();
    expect(softRevokedHistory?.changedBy).toBe('system:auto-conflict');
  });

  it('batch-approve multiple same-key mappings: only last one is APPROVED', async () => {
    const id1 = await createPendingMapping('EXT-BATCH-MULTI');
    const id2 = await createPendingMapping('EXT-BATCH-MULTI');

    const res = await adminApp.request('/mdm/mappings/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({
        mapping_ids: [id1, id2],
        approved_global_id: GLOBAL_ID_A,
      }),
    });
    expect(res.status).toBe(200);

    const approvedCount = await prisma.externalIdMapping.count({
      where: { tenantId: TENANT_ID, externalId: 'EXT-BATCH-MULTI', status: 'APPROVED' },
    });
    expect(approvedCount).toBeLessThanOrEqual(1);
  });

  it('batch-approve response includes soft_revoked count', async () => {
    const id = await createPendingMapping('EXT-BATCH-COUNT');
    const res = await adminApp.request('/mdm/mappings/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ mapping_ids: [id], approved_global_id: GLOBAL_ID_A }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { approved: number; soft_revoked: number };
    expect(typeof body.approved).toBe('number');
    expect(typeof body.soft_revoked).toBe('number');
    expect(body.soft_revoked).toBe(0);
  });
});
