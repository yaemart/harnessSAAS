import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { requireRole } from './auth-middleware.js';
import type { AuthContext } from './auth-middleware.js';
import { emitMdmEvent, type MdmEvent } from './mdm-events.js';

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as typeof prisma);
  });
}

function tid(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }) {
  return c.req.header('x-tenant-id') ?? c.req.query('tenantId') ?? null;
}

function asError(error_code: string, message: string, details?: Record<string, unknown>) {
  return { error_code, message, details: details ?? {} };
}

const mdm = new Hono<{ Variables: { auth: AuthContext } }>();

// Mapping governance is an operational function; keep it within authenticated business roles.
mdm.use('/mappings/*', requireRole('system_admin', 'tenant_admin', 'operator'));
mdm.use('/mappings', requireRole('system_admin', 'tenant_admin', 'operator'));

type MappingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'SOFT_REVOKED';
type EntityType = 'PRODUCT' | 'LISTING' | 'SUPPLIER' | 'WAREHOUSE';

async function appendHistory(input: {
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

function nowIso() {
  return new Date().toISOString();
}

async function publish(event: MdmEvent) {
  await emitMdmEvent(event);
}

mdm.get('/mappings', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const status = c.req.query('status') as MappingStatus | undefined;
  const entityType = c.req.query('entity_type') as EntityType | undefined;
  const sourceSystem = c.req.query('source_system') ?? undefined;
  const q = c.req.query('q')?.trim();
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(c.req.query('page_size') || 20)));
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    status: status || undefined,
    entityType: entityType || undefined,
    sourceSystem,
    ...(q ? { OR: [{ externalId: { contains: q, mode: 'insensitive' as const } }, { externalSubId: { contains: q, mode: 'insensitive' as const } }] } : {}),
  };

  const [total, items] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.externalIdMapping.count({ where }),
      tx.externalIdMapping.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, tenantId: true, entityType: true, globalId: true,
          sourceSystem: true, externalId: true, externalSubId: true,
          status: true, confidenceScore: true, mappingConfidencePassedAt: true,
          effectiveFrom: true, effectiveTo: true,
          createdBy: true, approvedBy: true, approvedAt: true,
          revokedBy: true, revokedAt: true, reason: true,
          version: true, createdAt: true, updatedAt: true,
        },
      }),
    ]),
  );

  return c.json({ total, page, pageSize, items });
});

mdm.get('/mappings/approved', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const entityType = (c.req.query('entity_type') ?? '').trim().toUpperCase();
  const sourceSystem = c.req.query('source_system')?.trim();
  const externalId = c.req.query('external_id')?.trim();
  const globalId = c.req.query('global_id')?.trim();
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 100)));

  const where: Prisma.Sql[] = [Prisma.sql`"tenantId" = ${tenantId}`];
  if (entityType) where.push(Prisma.sql`"entityType" = ${entityType}`);
  if (sourceSystem) where.push(Prisma.sql`"sourceSystem" = ${sourceSystem}`);
  if (externalId) where.push(Prisma.sql`"externalId" = ${externalId}`);
  if (globalId) where.push(Prisma.sql`"globalId" = ${globalId}`);

  const items = await withTenant(tenantId, (tx) =>
    tx.$queryRaw<Array<{
      id: string;
      tenantId: string;
      entityType: EntityType;
      globalId: string;
      sourceSystem: string;
      externalId: string;
      externalSubId: string | null;
      confidenceScore: string | null;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      approvedBy: string | null;
      approvedAt: Date | null;
      updatedAt: Date;
    }>>(
      Prisma.sql`
        SELECT
          "id",
          "tenantId",
          "entityType",
          "globalId",
          "sourceSystem",
          "externalId",
          "externalSubId",
          "confidenceScore",
          "effectiveFrom",
          "effectiveTo",
          "approvedBy",
          "approvedAt",
          "updatedAt"
        FROM "approved_entity_mapping"
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `,
    ),
  );

  return c.json({ items });
});

mdm.get('/mappings/:id', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const id = c.req.param('id');
  const mapping = await withTenant(tenantId, (tx) =>
    tx.externalIdMapping.findFirst({
      where: { id, tenantId },
      include: { histories: { orderBy: { createdAt: 'desc' } } },
    }),
  );

  if (!mapping) return c.json(asError('MAPPING_NOT_FOUND', 'mapping not found'), 404);

  const { rawPayload: _raw, candidatePayload, ...safeMapping } = mapping;
  return c.json({
    mapping: safeMapping,
    candidates: candidatePayload ?? {},
    audit_history: mapping.histories,
  });
});

mdm.post('/mappings', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';

  const body = await c.req.json<{
    entity_type: EntityType;
    global_id: string;
    source_system: string;
    external_id: string;
    external_sub_id?: string;
    confidence_score?: number;
    reason?: string;
    candidate_payload?: Record<string, unknown>;
    raw_payload?: Record<string, unknown>;
  }>();

  if (!body.entity_type || !body.global_id || !body.source_system || !body.external_id) {
    return c.json(asError('INVALID_REQUEST', 'entity_type/global_id/source_system/external_id are required'), 400);
  }

  const created = await withTenant(tenantId, async (tx) => {
    const item = await tx.externalIdMapping.create({
      data: {
        tenantId,
        entityType: body.entity_type,
        globalId: body.global_id,
        sourceSystem: body.source_system,
        externalId: body.external_id,
        externalSubId: body.external_sub_id ?? null,
        status: 'PENDING',
        confidenceScore: body.confidence_score ?? null,
        createdBy: actor,
        reason: body.reason ?? null,
        candidatePayload: (body.candidate_payload as never) ?? undefined,
        rawPayload: (body.raw_payload as never) ?? undefined,
      },
    });
    await appendHistory({
      tx,
      mappingId: item.id,
      tenantId,
      action: 'CREATED',
      oldStatus: null,
      newStatus: 'PENDING',
      changedBy: actor,
      reason: body.reason ?? null,
    });
    return item;
  });

  return c.json({ item: created }, 201);
});

mdm.post('/mappings/:id/approve', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';
  const id = c.req.param('id');
  const body = await c.req.json<{ approved_global_id: string; comment?: string; expected_version?: number }>();

  if (!body.approved_global_id) {
    return c.json(asError('INVALID_REQUEST', 'approved_global_id is required'), 400);
  }

  const result = await withTenant(tenantId, async (tx) => {
    const current = await tx.externalIdMapping.findFirst({ where: { id, tenantId } });
    if (!current) return { error: asError('MAPPING_NOT_FOUND', 'mapping not found'), status: 404 as const };

    if (!['PENDING', 'REVOKED', 'SOFT_REVOKED'].includes(current.status)) {
      return { error: asError('INVALID_STATUS_TRANSITION', `cannot approve from ${current.status}`), status: 409 as const };
    }

    if (typeof body.expected_version === 'number' && body.expected_version !== current.version) {
      return { error: asError('VERSION_CONFLICT', 'expected_version mismatch', { expected: body.expected_version, actual: current.version }), status: 409 as const };
    }

    const approvedAt = new Date();
    const approved = await tx.externalIdMapping.update({
      where: { id: current.id },
      data: {
        globalId: body.approved_global_id,
        status: 'APPROVED',
        approvedBy: actor,
        approvedAt,
        reason: body.comment ?? current.reason,
        version: { increment: 1 },
      },
    });

    await appendHistory({
      tx,
      mappingId: approved.id,
      tenantId,
      action: 'APPROVED',
      oldStatus: current.status as MappingStatus,
      newStatus: 'APPROVED',
      changedBy: actor,
      reason: body.comment ?? null,
    });

    const conflicts = await tx.externalIdMapping.findMany({
      where: {
        tenantId,
        entityType: approved.entityType,
        sourceSystem: approved.sourceSystem,
        externalId: approved.externalId,
        externalSubId: approved.externalSubId,
        status: 'APPROVED',
        id: { not: approved.id },
      },
    });

    const softRevokedConflicts: Array<{
      id: string;
      entityType: EntityType;
      globalId: string;
      sourceSystem: string;
      externalId: string;
      externalSubId: string | null;
      revokedBy: string | null;
      revokedAt: Date | null;
      reason: string | null;
    }> = [];

    for (const conflict of conflicts) {
      const softRevoked = await tx.externalIdMapping.update({
        where: { id: conflict.id },
        data: {
          status: 'SOFT_REVOKED',
          revokedBy: 'system:auto-conflict',
          revokedAt: new Date(),
          reason: conflict.reason ?? 'auto soft revoke: approved conflict detected',
          version: { increment: 1 },
        },
      });
      await appendHistory({
        tx,
        mappingId: softRevoked.id,
        tenantId,
        action: 'SOFT_REVOKED',
        oldStatus: 'APPROVED',
        newStatus: 'SOFT_REVOKED',
        changedBy: 'system:auto-conflict',
        reason: 'approved conflict detected',
      });
      softRevokedConflicts.push({
        id: softRevoked.id,
        entityType: softRevoked.entityType as EntityType,
        globalId: softRevoked.globalId,
        sourceSystem: softRevoked.sourceSystem,
        externalId: softRevoked.externalId,
        externalSubId: softRevoked.externalSubId,
        revokedBy: softRevoked.revokedBy,
        revokedAt: softRevoked.revokedAt,
        reason: softRevoked.reason,
      });
    }

    return { item: approved, softRevokedConflicts, status: 200 as const };
  });

  if ('error' in result) return c.json(result.error, result.status);

  await publish({
    type: 'entity.mapping.approved',
    tenantId,
    timestamp: nowIso(),
    source: 'mdm-api',
    payload: {
      mappingId: result.item.id,
      entityType: result.item.entityType as EntityType,
      globalId: result.item.globalId,
      sourceSystem: result.item.sourceSystem,
      externalId: result.item.externalId,
      externalSubId: result.item.externalSubId,
      approvedBy: result.item.approvedBy,
      approvedAt: result.item.approvedAt ? result.item.approvedAt.toISOString() : null,
    },
  });

  await publish({
    type: 'sku-mapping.mapped',
    tenantId,
    timestamp: nowIso(),
    source: 'mdm-api',
    payload: {
      mappingId: result.item.id,
      productId: result.item.globalId,
      externalSku: result.item.externalId,
      sourceType: result.item.sourceSystem,
    },
  });

  for (const conflict of result.softRevokedConflicts) {
    await publish({
      type: 'entity.mapping.revoked',
      tenantId,
      timestamp: nowIso(),
      source: 'mdm-api',
      payload: {
        mappingId: conflict.id,
        entityType: conflict.entityType,
        globalId: conflict.globalId,
        sourceSystem: conflict.sourceSystem,
        externalId: conflict.externalId,
        externalSubId: conflict.externalSubId,
        revokedBy: conflict.revokedBy,
        revokedAt: conflict.revokedAt ? conflict.revokedAt.toISOString() : null,
        reason: conflict.reason,
        mode: 'SOFT_REVOKE',
      },
    });
  }

  return c.json({ status: 'APPROVED', item: result.item });
});

mdm.post('/mappings/:id/reject', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';
  const id = c.req.param('id');
  const body = await c.req.json<{ reason: string; expected_version?: number }>();

  if (!body.reason?.trim()) return c.json(asError('INVALID_REQUEST', 'reason is required'), 400);

  const result = await withTenant(tenantId, async (tx) => {
    const current = await tx.externalIdMapping.findFirst({ where: { id, tenantId } });
    if (!current) return { error: asError('MAPPING_NOT_FOUND', 'mapping not found'), status: 404 as const };
    if (!['PENDING', 'SOFT_REVOKED', 'REVOKED'].includes(current.status)) {
      return { error: asError('INVALID_STATUS_TRANSITION', `cannot reject from ${current.status}`), status: 409 as const };
    }
    if (typeof body.expected_version === 'number' && body.expected_version !== current.version) {
      return { error: asError('VERSION_CONFLICT', 'expected_version mismatch', { expected: body.expected_version, actual: current.version }), status: 409 as const };
    }
    const item = await tx.externalIdMapping.update({
      where: { id: current.id },
      data: {
        status: 'REJECTED',
        reason: body.reason,
        version: { increment: 1 },
      },
    });
    await appendHistory({
      tx,
      mappingId: item.id,
      tenantId,
      action: 'REJECTED',
      oldStatus: current.status as MappingStatus,
      newStatus: 'REJECTED',
      changedBy: actor,
      reason: body.reason,
    });
    return { item, status: 200 as const };
  });

  if ('error' in result) return c.json(result.error, result.status);
  return c.json({ status: 'REJECTED', item: result.item });
});

mdm.post('/mappings/:id/revoke', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';
  const id = c.req.param('id');
  const body = await c.req.json<{ reason: string; expected_version?: number }>();

  if (!body.reason?.trim()) return c.json(asError('INVALID_REQUEST', 'reason is required'), 400);

  const result = await withTenant(tenantId, async (tx) => {
    const current = await tx.externalIdMapping.findFirst({ where: { id, tenantId } });
    if (!current) return { error: asError('MAPPING_NOT_FOUND', 'mapping not found'), status: 404 as const };
    if (!['APPROVED'].includes(current.status)) {
      return { error: asError('INVALID_STATUS_TRANSITION', `cannot revoke from ${current.status}`), status: 409 as const };
    }
    if (typeof body.expected_version === 'number' && body.expected_version !== current.version) {
      return { error: asError('VERSION_CONFLICT', 'expected_version mismatch', { expected: body.expected_version, actual: current.version }), status: 409 as const };
    }
    const item = await tx.externalIdMapping.update({
      where: { id: current.id },
      data: {
        status: 'REVOKED',
        revokedBy: actor,
        revokedAt: new Date(),
        reason: body.reason,
        version: { increment: 1 },
      },
    });
    await appendHistory({
      tx,
      mappingId: item.id,
      tenantId,
      action: 'REVOKED',
      oldStatus: 'APPROVED',
      newStatus: 'REVOKED',
      changedBy: actor,
      reason: body.reason,
    });
    return { item, status: 200 as const };
  });

  if ('error' in result) return c.json(result.error, result.status);

  await publish({
    type: 'entity.mapping.revoked',
    tenantId,
    timestamp: nowIso(),
    source: 'mdm-api',
    payload: {
      mappingId: result.item.id,
      entityType: result.item.entityType as EntityType,
      globalId: result.item.globalId,
      sourceSystem: result.item.sourceSystem,
      externalId: result.item.externalId,
      externalSubId: result.item.externalSubId,
      revokedBy: result.item.revokedBy,
      revokedAt: result.item.revokedAt ? result.item.revokedAt.toISOString() : null,
      reason: result.item.reason,
      mode: 'MANUAL',
    },
  });

  return c.json({ status: 'REVOKED', item: result.item });
});

mdm.post('/mappings/:id/create-and-approve', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';
  const id = c.req.param('id');
  const body = await c.req.json<{
    new_entity_data: { name: string; brand_id: string; category_id: string; sku?: string; supplier_id?: string };
    comment?: string;
    expected_version?: number;
  }>();

  const result = await withTenant(tenantId, async (tx) => {
    const current = await tx.externalIdMapping.findFirst({ where: { id, tenantId } });
    if (!current) return { error: asError('MAPPING_NOT_FOUND', 'mapping not found'), status: 404 as const };
    if (current.entityType !== 'PRODUCT') {
      return { error: asError('INVALID_REQUEST', 'create-and-approve currently supports PRODUCT only'), status: 400 as const };
    }
    if (!['PENDING', 'REVOKED', 'SOFT_REVOKED'].includes(current.status)) {
      return { error: asError('INVALID_STATUS_TRANSITION', `cannot create-and-approve from ${current.status}`), status: 409 as const };
    }
    if (typeof body.expected_version === 'number' && body.expected_version !== current.version) {
      return { error: asError('VERSION_CONFLICT', 'expected_version mismatch', { expected: body.expected_version, actual: current.version }), status: 409 as const };
    }

    if (!body.new_entity_data?.name || !body.new_entity_data?.brand_id || !body.new_entity_data?.category_id) {
      return { error: asError('INVALID_REQUEST', 'new_entity_data.name/brand_id/category_id are required'), status: 400 as const };
    }

    const sku = body.new_entity_data.sku || `AUTO-${Date.now()}`;
    const product = await tx.product.create({
      data: {
        tenantId,
        name: body.new_entity_data.name,
        brandId: body.new_entity_data.brand_id,
        categoryId: body.new_entity_data.category_id,
        supplierId: body.new_entity_data.supplier_id || null,
        sku,
      },
    });

    const approved = await tx.externalIdMapping.update({
      where: { id: current.id },
      data: {
        globalId: product.id,
        status: 'APPROVED',
        approvedBy: actor,
        approvedAt: new Date(),
        reason: body.comment ?? current.reason,
        version: { increment: 1 },
      },
    });

    await appendHistory({
      tx,
      mappingId: approved.id,
      tenantId,
      action: 'APPROVED',
      oldStatus: current.status as MappingStatus,
      newStatus: 'APPROVED',
      changedBy: actor,
      reason: body.comment ?? null,
      metadata: { created_product_id: product.id, created_product_sku: sku },
    });

    return { item: approved, product, status: 200 as const };
  });

  if ('error' in result) return c.json(result.error, result.status);

  await publish({
    type: 'entity.mapping.approved',
    tenantId,
    timestamp: nowIso(),
    source: 'mdm-api',
    payload: {
      mappingId: result.item.id,
      entityType: result.item.entityType as EntityType,
      globalId: result.item.globalId,
      sourceSystem: result.item.sourceSystem,
      externalId: result.item.externalId,
      externalSubId: result.item.externalSubId,
      approvedBy: result.item.approvedBy,
      approvedAt: result.item.approvedAt ? result.item.approvedAt.toISOString() : null,
    },
  });

  return c.json({ status: 'APPROVED', item: result.item, product: result.product });
});

mdm.post('/mappings/batch-approve', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);
  const auth = c.get('auth');
  const actor = auth?.userId ? `user:${auth.userId}` : 'system';
  const body = await c.req.json<{ mapping_ids: string[]; approved_global_id: string; comment?: string }>();
  if (!Array.isArray(body.mapping_ids) || body.mapping_ids.length === 0 || !body.approved_global_id) {
    return c.json(asError('INVALID_REQUEST', 'mapping_ids and approved_global_id are required'), 400);
  }

    const updated = await withTenant(tenantId, async (tx) => {
    const rows = await tx.externalIdMapping.findMany({
      where: { tenantId, id: { in: body.mapping_ids } },
    });
    const pendingRows = rows.filter((r) => ['PENDING', 'REVOKED', 'SOFT_REVOKED'].includes(r.status));
    const approvedItems: typeof pendingRows = [];
    const softRevokedItems: typeof pendingRows = [];

    for (const r of pendingRows) {
      const item = await tx.externalIdMapping.update({
        where: { id: r.id },
        data: {
          globalId: body.approved_global_id,
          status: 'APPROVED',
          approvedBy: actor,
          approvedAt: new Date(),
          reason: body.comment ?? r.reason,
          version: { increment: 1 },
        },
      });
      await appendHistory({
        tx,
        mappingId: item.id,
        tenantId,
        action: 'APPROVED',
        oldStatus: r.status as MappingStatus,
        newStatus: 'APPROVED',
        changedBy: actor,
        reason: body.comment ?? null,
      });

      // 与 single approve 对齐：检测同外部键的其他 APPROVED 并自动 SOFT_REVOKE
      const conflicts = await tx.externalIdMapping.findMany({
        where: {
          tenantId,
          entityType: r.entityType,
          sourceSystem: r.sourceSystem,
          externalId: r.externalId,
          externalSubId: r.externalSubId ?? null,
          status: 'APPROVED',
          id: { not: item.id },
        },
      });
      for (const conflict of conflicts) {
        const softRevokedAt = new Date();
        await tx.externalIdMapping.update({
          where: { id: conflict.id },
          data: {
            status: 'SOFT_REVOKED',
            revokedBy: 'system:auto-conflict',
            revokedAt: softRevokedAt,
            reason: conflict.reason ?? 'auto soft revoke: batch-approve conflict detected',
            version: { increment: 1 },
          },
        });
        await appendHistory({
          tx,
          mappingId: conflict.id,
          tenantId,
          action: 'SOFT_REVOKED',
          oldStatus: 'APPROVED',
          newStatus: 'SOFT_REVOKED',
          changedBy: 'system:auto-conflict',
          reason: 'batch-approve conflict detected',
        });
        softRevokedItems.push({ ...conflict, revokedAt: softRevokedAt });
      }

      approvedItems.push(item);
    }
    return { approvedItems, softRevokedItems };
  });

  for (const item of updated.approvedItems) {
    await publish({
      type: 'entity.mapping.approved',
      tenantId,
      timestamp: nowIso(),
      source: 'mdm-api',
      payload: {
        mappingId: item.id,
        entityType: item.entityType as EntityType,
        globalId: item.globalId,
        sourceSystem: item.sourceSystem,
        externalId: item.externalId,
        externalSubId: item.externalSubId,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
      },
    });
  }
  for (const item of updated.softRevokedItems) {
    await publish({
      type: 'entity.mapping.revoked',
      tenantId,
      timestamp: nowIso(),
      source: 'mdm-api',
      payload: {
        mappingId: item.id,
        entityType: item.entityType as EntityType,
        globalId: item.globalId,
        sourceSystem: item.sourceSystem,
        externalId: item.externalId,
        externalSubId: item.externalSubId ?? null,
        revokedBy: 'system:auto-conflict',
        revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
        reason: 'batch-approve conflict detected',
        mode: 'SOFT_REVOKE' as const,
      },
    });
  }

  return c.json({ approved: updated.approvedItems.length, soft_revoked: updated.softRevokedItems.length });
});

// POST /mappings/reconcile/dry-run
// 双写期对账预览（只读）：返回新旧表的数量差异与状态错配样本
mdm.post('/mappings/reconcile/dry-run', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const [
    totalNewMappings,
    approvedCount,
    pendingCount,
    rejectedCount,
    revokedCount,
    softRevokedCount,
    doubleApprovedConflicts,
  ] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.externalIdMapping.count({ where: { tenantId } }),
      tx.externalIdMapping.count({ where: { tenantId, status: 'APPROVED' } }),
      tx.externalIdMapping.count({ where: { tenantId, status: 'PENDING' } }),
      tx.externalIdMapping.count({ where: { tenantId, status: 'REJECTED' } }),
      tx.externalIdMapping.count({ where: { tenantId, status: 'REVOKED' } }),
      tx.externalIdMapping.count({ where: { tenantId, status: 'SOFT_REVOKED' } }),
      // 检查同外部键是否存在多个 APPROVED（P0 冲突）
      tx.$queryRaw<{ entity_type: string; source_system: string; external_id: string; cnt: bigint }[]>`
        SELECT entity_type, source_system, external_id, COALESCE(external_sub_id,'') AS external_sub_id, COUNT(*) AS cnt
        FROM external_id_mapping
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'APPROVED'
        GROUP BY entity_type, source_system, external_id, COALESCE(external_sub_id,'')
        HAVING COUNT(*) > 1
        LIMIT 20
      `,
    ]),
  );

  const p0Conflicts = (doubleApprovedConflicts as { cnt: bigint }[]).length;

  return c.json({
    summary: {
      total_new_mappings: totalNewMappings,
      approved: approvedCount,
      pending: pendingCount,
      rejected: rejectedCount,
      revoked: revokedCount,
      soft_revoked: softRevokedCount,
    },
    p0_double_approved_conflicts: p0Conflicts,
    p0_conflict_samples: doubleApprovedConflicts,
    go_no_go: p0Conflicts === 0 ? 'GO' : 'NO-GO',
    generated_at: new Date().toISOString(),
  });
});

mdm.post('/mappings/:id/rollback', async (c) => {
  const tenantId = tid(c);
  if (!tenantId) return c.json(asError('INVALID_REQUEST', 'tenantId required'), 400);

  const auth = c.get('auth');
  if (auth?.role !== 'tenant_admin' && auth?.role !== 'system_admin') {
    return c.json(asError('FORBIDDEN', 'only tenant_admin can perform rollback'), 403);
  }
  const actor = `user:${auth.userId}`;
  const id = c.req.param('id');
  const body = await c.req.json<{ reason: string }>().catch(() => ({ reason: '' }));

  if (!body.reason?.trim()) return c.json(asError('INVALID_REQUEST', 'reason is required'), 400);

  const result = await withTenant(tenantId, async (tx) => {
    const current = await tx.externalIdMapping.findFirst({ where: { id, tenantId } });
    if (!current) return { error: asError('MAPPING_NOT_FOUND', 'mapping not found'), status: 404 as const };

    const lastApproved = await tx.mappingHistory.findFirst({
      where: { mappingId: id, tenantId, oldStatus: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastApproved) {
      return { error: asError('NO_ROLLBACK_TARGET', 'no previous APPROVED state found in history'), status: 409 as const };
    }

    const item = await tx.externalIdMapping.update({
      where: { id: current.id },
      data: {
        status: 'REVOKED',
        revokedBy: actor,
        revokedAt: new Date(),
        reason: `[rollback] ${body.reason}`,
        version: { increment: 1 },
      },
    });

    await tx.mappingHistory.create({
      data: {
        mappingId: item.id,
        tenantId,
        action: 'ROLLBACK',
        oldStatus: current.status as MappingStatus,
        newStatus: 'REVOKED',
        changedBy: actor,
        reason: body.reason,
        metadata: { rolledBackTo: lastApproved.id },
      },
    });

    return { item, globalId: current.globalId, status: 200 as const };
  });

  if ('error' in result) return c.json(result.error, result.status);

  await publish({
    type: 'entity.mapping.revoked',
    tenantId,
    timestamp: nowIso(),
    source: 'mdm-api',
    payload: {
      mappingId: result.item.id,
      entityType: result.item.entityType as EntityType,
      globalId: result.item.globalId,
      sourceSystem: result.item.sourceSystem,
      externalId: result.item.externalId,
      externalSubId: result.item.externalSubId,
      revokedBy: result.item.revokedBy,
      revokedAt: result.item.revokedAt ? result.item.revokedAt.toISOString() : null,
      reason: result.item.reason,
      mode: 'MANUAL',
    },
  });

  return c.json({
    status: 'REVOKED',
    item: result.item,
    affectedGlobalId: result.globalId,
  });
});

export { mdm as mdmMappingRoutes };
