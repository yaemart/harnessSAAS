import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { requireRole, type AuthContext } from './auth-middleware.js';
import { parsePageSize } from './pagination.js';
import { isValidUUID, clampInt } from './validation.js';
import { appendLedgerFeedback, updateKnowledgeImpact, writeConfidenceLedger, PIPELINE_VERSION } from './harness-ledger-service.js';
import { recalculateWeights, transitionLifecycle, detectDrift, type DriftAlert } from './harness-decay-engine.js';
import { applyTMSUpdate } from './harness-maturity-engine.js';

type Env = { Variables: { auth: AuthContext } };

const app = new Hono<Env>();

const MAX_CONTENT_LENGTH = 10_000;
const MAX_REASON_LENGTH = 2_000;
const VALID_FEEDBACK_TYPES = ['accept', 'reject', 'modify', 'rating', 'resolved'] as const;
const VALID_SOURCE_ROLES = ['operator', 'tenant_admin', 'consumer'] as const;
const VALID_PRIORITY_CLASSES = ['SAFETY', 'EXPERIENCE'] as const;
const VALID_KNOWLEDGE_SOURCES = ['writeback', 'faq', 'manual', 'experience'] as const;
const VALID_KNOWLEDGE_STATUSES = ['ACTIVE', 'DECAYING', 'DORMANT', 'ARCHIVED'] as const;

const RECALC_COOLDOWN_MS = 60_000;
const LEDGER_RATE_LIMIT_MS = 2_000;
const MS_PER_DAY = 86_400_000;
const CAUSAL_CHAIN_LIMIT = 50;
const MAX_LEDGER_STRING_LEN = 500;
const MAX_LEDGER_ARRAY_LEN = 200;
const recalcLastRun = new Map<string, number>();

const VALID_AGENT_DOMAINS = ['portal', 'ads'] as const;
const VALID_RULE_RESULTS = ['pass', 'soft_warning', 'hard_rejected'] as const;
const VALID_AUTHORITY_LEVELS = ['auto', 'confirm', 'block'] as const;
const VALID_EXECUTION_RESULTS = ['success', 'failed', 'escalated', 'rejected'] as const;
const VALID_AUTONOMY_LEVELS = ['GUIDED', 'ASSISTED', 'SUPERVISED', 'AUTONOMOUS'] as const;

function checkCooldown(key: string): boolean {
  const last = recalcLastRun.get(key) ?? 0;
  if (Date.now() - last < RECALC_COOLDOWN_MS) return false;
  recalcLastRun.set(key, Date.now());
  return true;
}

function evictRecalcLastRun(): void {
  const cutoff = Date.now() - RECALC_COOLDOWN_MS;
  for (const [k, ts] of recalcLastRun.entries()) {
    if (ts < cutoff) recalcLastRun.delete(k);
  }
}

const CONFIDENCE_DELTAS: Record<string, number> = {
  accept: 0.05,
  reject: -0.10,
  modify: -0.03,
};

const KNOWLEDGE_IMPACT_DELTAS: Record<string, number> = {
  accept: 0.1,
  reject: -0.15,
  modify: -0.05,
};

// ─── Feedback Signal ──────────────────────────────────

const feedbackRoutes = new Hono<Env>();
feedbackRoutes.use('*', requireRole('system_admin', 'tenant_admin', 'operator'));

feedbackRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    type: string;
    sourceRole: string;
    priorityClass?: string;
    caseId?: string;
    intentId?: string;
    agentAction: string;
    reason?: string;
    correction?: string;
    rating?: number;
    metadata?: Record<string, unknown>;
  }>();

  if (!body.type || !VALID_FEEDBACK_TYPES.includes(body.type as typeof VALID_FEEDBACK_TYPES[number])) {
    return c.json({ error: `type must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}` }, 400);
  }
  if (!body.sourceRole || !VALID_SOURCE_ROLES.includes(body.sourceRole as typeof VALID_SOURCE_ROLES[number])) {
    return c.json({ error: `sourceRole must be one of: ${VALID_SOURCE_ROLES.join(', ')}` }, 400);
  }
  if (!body.agentAction || body.agentAction.length < 1) {
    return c.json({ error: 'agentAction is required' }, 400);
  }
  if (body.caseId && !isValidUUID(body.caseId)) {
    return c.json({ error: 'Invalid caseId' }, 400);
  }
  if (body.reason && body.reason.length > MAX_REASON_LENGTH) {
    return c.json({ error: 'reason too long' }, 400);
  }
  if (body.correction && body.correction.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: 'correction too long' }, 400);
  }
  if (body.rating !== undefined) {
    body.rating = clampInt(body.rating, 1, 5, 3);
  }

  const priorityClass = body.priorityClass && VALID_PRIORITY_CLASSES.includes(body.priorityClass as typeof VALID_PRIORITY_CLASSES[number])
    ? body.priorityClass as 'SAFETY' | 'EXPERIENCE'
    : 'EXPERIENCE';

  const signal = await prisma.feedbackSignal.create({
    data: {
      tenantId: auth.tenantId,
      type: body.type,
      sourceRole: body.sourceRole,
      priorityClass,
      caseId: body.caseId ?? null,
      intentId: body.intentId ?? null,
      agentAction: body.agentAction,
      reason: body.reason ?? null,
      correction: body.correction ?? null,
      rating: body.rating ?? null,
      metadata: (body.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  if (body.caseId) {
    const delta = CONFIDENCE_DELTAS[body.type];

    if (delta !== undefined) {
      const recentLedger = await prisma.confidenceLedger.findFirst({
        where: { caseId: body.caseId, tenantId: auth.tenantId, feedbackType: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, knowledgeUsed: true },
      });

      if (recentLedger) {
        void appendLedgerFeedback(
          recentLedger.id,
          auth.tenantId,
          body.type,
          body.reason ?? null,
          body.sourceRole,
          delta,
        );

        const impactDelta = KNOWLEDGE_IMPACT_DELTAS[body.type];
        if (recentLedger.knowledgeUsed.length > 0 && impactDelta !== undefined) {
          void updateKnowledgeImpact(auth.tenantId, recentLedger.knowledgeUsed, impactDelta);
        }
      }
    }
  }

  return c.json({ signal }, 201);
});

feedbackRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const type = c.req.query('type');
  const caseId = c.req.query('caseId');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  if (caseId && !isValidUUID(caseId)) {
    return c.json({ error: 'Invalid caseId' }, 400);
  }

  const signals = await prisma.feedbackSignal.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(type ? { type } : {}),
      ...(caseId ? { caseId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = signals.length > limit;
  const items = hasMore ? signals.slice(0, limit) : signals;

  return c.json({
    signals: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

feedbackRoutes.get('/stats', async (c) => {
  const auth = c.get('auth');

  const groups = await prisma.feedbackSignal.groupBy({
    by: ['type'],
    where: { tenantId: auth.tenantId },
    _count: true,
  });

  const stats: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    stats[g.type] = g._count;
    total += g._count;
  }

  return c.json({ total, byType: stats });
});

// ─── Knowledge Entry ──────────────────────────────────

const knowledgeRoutes = new Hono<Env>();
knowledgeRoutes.use('*', requireRole('system_admin', 'tenant_admin', 'operator'));

knowledgeRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    source: string;
    category: string;
    content: string;
    sourceRef?: string;
  }>();

  if (!body.source || !VALID_KNOWLEDGE_SOURCES.includes(body.source as typeof VALID_KNOWLEDGE_SOURCES[number])) {
    return c.json({ error: `source must be one of: ${VALID_KNOWLEDGE_SOURCES.join(', ')}` }, 400);
  }
  if (!body.category || body.category.length < 1) {
    return c.json({ error: 'category is required' }, 400);
  }
  if (!body.content || body.content.length < 1) {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_CONTENT_LENGTH) {
    return c.json({ error: 'content too long' }, 400);
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      tenantId: auth.tenantId,
      source: body.source,
      category: body.category,
      content: body.content,
      sourceRef: body.sourceRef ?? null,
    },
  });

  return c.json({ entry }, 201);
});

knowledgeRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const status = c.req.query('status');
  const category = c.req.query('category');
  const source = c.req.query('source');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  if (status && !VALID_KNOWLEDGE_STATUSES.includes(status as typeof VALID_KNOWLEDGE_STATUSES[number])) {
    return c.json({ error: `status must be one of: ${VALID_KNOWLEDGE_STATUSES.join(', ')}` }, 400);
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(status ? { status: status as 'ACTIVE' | 'DECAYING' | 'DORMANT' | 'ARCHIVED' } : {}),
      ...(category ? { category } : {}),
      ...(source ? { source } : {}),
    },
    orderBy: { effectiveWeight: 'desc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;

  return c.json({
    entries: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

knowledgeRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid id' }, 400);

  const entry = await prisma.knowledgeEntry.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!entry) return c.json({ error: 'Not found' }, 404);

  return c.json({ entry });
});

knowledgeRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid id' }, 400);

  const existing = await prisma.knowledgeEntry.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{
    category?: string;
    content?: string;
    status?: string;
    supersededBy?: string;
  }>();

  const data: Record<string, unknown> = {};
  if (body.category) data.category = body.category;
  if (body.content) {
    if (body.content.length > MAX_CONTENT_LENGTH) return c.json({ error: 'content too long' }, 400);
    data.content = body.content;
  }
  if (body.status && VALID_KNOWLEDGE_STATUSES.includes(body.status as typeof VALID_KNOWLEDGE_STATUSES[number])) {
    data.status = body.status;
    if (body.status === 'ARCHIVED') data.effectiveWeight = 0;
  }
  if (body.supersededBy) {
    if (!isValidUUID(body.supersededBy)) return c.json({ error: 'Invalid supersededBy' }, 400);
    data.supersededBy = body.supersededBy;
    data.status = 'ARCHIVED';
    data.effectiveWeight = 0;
  }

  data.lastReviewedAt = new Date();

  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data,
  });

  return c.json({ entry });
});

knowledgeRoutes.post('/:id/cite', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid id' }, 400);

  const entry = await prisma.knowledgeEntry.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, usageCount: true },
  });
  if (!entry) return c.json({ error: 'Not found' }, 404);

  const updated = await prisma.knowledgeEntry.update({
    where: { id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return c.json({ entry: updated });
});

knowledgeRoutes.get('/stats/summary', async (c) => {
  const auth = c.get('auth');

  const [byStatus, bySource, totalCount] = await Promise.all([
    prisma.knowledgeEntry.groupBy({
      by: ['status'],
      where: { tenantId: auth.tenantId },
      _count: true,
    }),
    prisma.knowledgeEntry.groupBy({
      by: ['source'],
      where: { tenantId: auth.tenantId },
      _count: true,
    }),
    prisma.knowledgeEntry.count({
      where: { tenantId: auth.tenantId },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const g of byStatus) statusMap[g.status] = g._count;

  const sourceMap: Record<string, number> = {};
  for (const g of bySource) sourceMap[g.source] = g._count;

  return c.json({ total: totalCount, byStatus: statusMap, bySource: sourceMap });
});

knowledgeRoutes.post('/recalculate', async (c) => {
  const auth = c.get('auth');
  if (auth.role !== 'system_admin') {
    return c.json({ error: 'Only system admins can trigger recalculation' }, 403);
  }
  evictRecalcLastRun();
  if (!checkCooldown(`knowledge:${auth.tenantId}`)) {
    return c.json({ error: 'Recalculation already ran recently. Try again in 60s.' }, 429);
  }

  const weightStats = await recalculateWeights(auth.tenantId);
  const lifecycleStats = await transitionLifecycle(auth.tenantId);

  return c.json({
    weights: weightStats,
    lifecycle: lifecycleStats,
  });
});

// ─── Confidence Ledger ───────────────────────────────

const ledgerRoutes = new Hono<Env>();
ledgerRoutes.use('*', requireRole('system_admin', 'tenant_admin'));

ledgerRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');
  const caseId = c.req.query('caseId');

  if (caseId && !isValidUUID(caseId)) {
    return c.json({ error: 'Invalid caseId' }, 400);
  }

  const entries = await prisma.confidenceLedger.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(caseId ? { caseId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;

  return c.json({
    entries: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

ledgerRoutes.get('/stats', async (c) => {
  const auth = c.get('auth');

  const [total, byResult, avgConfidence] = await Promise.all([
    prisma.confidenceLedger.count({ where: { tenantId: auth.tenantId } }),
    prisma.confidenceLedger.groupBy({
      by: ['executionResult'],
      where: { tenantId: auth.tenantId },
      _count: true,
    }),
    prisma.confidenceLedger.aggregate({
      where: { tenantId: auth.tenantId },
      _avg: { confidenceBefore: true, confidenceAfter: true },
    }),
  ]);

  const resultMap: Record<string, number> = {};
  for (const g of byResult) resultMap[g.executionResult] = g._count;

  return c.json({
    total,
    byResult: resultMap,
    avgConfidenceBefore: avgConfidence._avg.confidenceBefore ?? 0,
    avgConfidenceAfter: avgConfidence._avg.confidenceAfter ?? 0,
  });
});

const ledgerRateLimit = new Map<string, number>();
const ledgerIdempotency = new Map<string, { id: string; ts: number }>();
const IDEMPOTENCY_TTL_MS = 60_000;

function evictLedgerMaps(): void {
  const now = Date.now();
  for (const [k, ts] of ledgerRateLimit.entries()) {
    if (now - ts > LEDGER_RATE_LIMIT_MS) ledgerRateLimit.delete(k);
  }
  for (const [k, v] of ledgerIdempotency.entries()) {
    if (now - v.ts > IDEMPOTENCY_TTL_MS) ledgerIdempotency.delete(k);
  }
}

function clampConfidence(v: number): number {
  return Math.max(0, Math.min(1, Number(v)));
}

ledgerRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    idempotencyKey?: string;
    agentDomain?: string;
    intentId?: string;
    caseId?: string;
    agentAction: string;
    confidenceBefore: number;
    confidenceAfter?: number;
    knowledgeUsed?: string[];
    knowledgeWeights?: number[];
    ruleTriggered?: string[];
    ruleResult: string;
    authorityLevel: string;
    executionResult: string;
    executionLatencyMs?: number;
    tenantMaturityScore?: number;
    agentAutonomyLevel?: string;
  }>();

  if (!body.agentAction || !body.ruleResult || !body.authorityLevel || !body.executionResult) {
    return c.json({ error: 'Missing required fields: agentAction, ruleResult, authorityLevel, executionResult' }, 400);
  }
  const agentDomain = body.agentDomain === undefined || body.agentDomain === null || body.agentDomain === ''
    ? 'portal'
    : body.agentDomain;
  if (!VALID_AGENT_DOMAINS.includes(agentDomain as typeof VALID_AGENT_DOMAINS[number])) {
    return c.json({ error: `agentDomain must be one of: ${VALID_AGENT_DOMAINS.join(', ')}` }, 400);
  }
  if (typeof body.confidenceBefore !== 'number' || !Number.isFinite(body.confidenceBefore)) {
    return c.json({ error: 'confidenceBefore must be a finite number' }, 400);
  }
  const confidenceBefore = clampConfidence(body.confidenceBefore);
  const confidenceAfter = body.confidenceAfter !== undefined && body.confidenceAfter !== null && Number.isFinite(body.confidenceAfter)
    ? clampConfidence(body.confidenceAfter)
    : confidenceBefore;
  if (body.caseId && !isValidUUID(body.caseId)) {
    return c.json({ error: 'Invalid caseId' }, 400);
  }
  if (body.intentId != null && body.intentId !== '' && body.intentId.length > MAX_LEDGER_STRING_LEN) {
    return c.json({ error: 'intentId too long' }, 400);
  }
  if (body.agentAction.length > MAX_LEDGER_STRING_LEN) {
    return c.json({ error: 'agentAction too long' }, 400);
  }
  if (!VALID_RULE_RESULTS.includes(body.ruleResult as typeof VALID_RULE_RESULTS[number])) {
    return c.json({ error: `ruleResult must be one of: ${VALID_RULE_RESULTS.join(', ')}` }, 400);
  }
  if (!VALID_AUTHORITY_LEVELS.includes(body.authorityLevel as typeof VALID_AUTHORITY_LEVELS[number])) {
    return c.json({ error: `authorityLevel must be one of: ${VALID_AUTHORITY_LEVELS.join(', ')}` }, 400);
  }
  if (!VALID_EXECUTION_RESULTS.includes(body.executionResult as typeof VALID_EXECUTION_RESULTS[number])) {
    return c.json({ error: `executionResult must be one of: ${VALID_EXECUTION_RESULTS.join(', ')}` }, 400);
  }
  if (body.agentAutonomyLevel != null && body.agentAutonomyLevel !== ''
    && !VALID_AUTONOMY_LEVELS.includes(body.agentAutonomyLevel as typeof VALID_AUTONOMY_LEVELS[number])) {
    return c.json({ error: `agentAutonomyLevel must be one of: ${VALID_AUTONOMY_LEVELS.join(', ')}` }, 400);
  }
  const knowledgeUsed = body.knowledgeUsed ?? [];
  if (knowledgeUsed.length > MAX_LEDGER_ARRAY_LEN) {
    return c.json({ error: 'knowledgeUsed array too long' }, 400);
  }
  for (const id of knowledgeUsed) {
    if (typeof id !== 'string' || !isValidUUID(id)) {
      return c.json({ error: 'Each knowledgeUsed element must be a valid UUID' }, 400);
    }
  }
  const ruleTriggered = body.ruleTriggered ?? [];
  if (ruleTriggered.length > MAX_LEDGER_ARRAY_LEN) {
    return c.json({ error: 'ruleTriggered array too long' }, 400);
  }

  const ledgerKey = `ledger:${auth.tenantId}`;
  const lastLedger = ledgerRateLimit.get(ledgerKey) ?? 0;
  if (Date.now() - lastLedger < LEDGER_RATE_LIMIT_MS) {
    return c.json({ error: 'Too many ledger writes. Try again shortly.' }, 429);
  }
  ledgerRateLimit.set(ledgerKey, Date.now());
  evictLedgerMaps();

  const idempotencyKey = body.idempotencyKey != null && String(body.idempotencyKey).trim() !== ''
    ? `${auth.tenantId}:${String(body.idempotencyKey).trim()}`
    : null;
  if (idempotencyKey) {
    const existing = ledgerIdempotency.get(idempotencyKey);
    if (existing) {
      return c.json({ id: existing.id }, 201);
    }
  }

  const id = await writeConfidenceLedger({
    tenantId: auth.tenantId,
    agentDomain: agentDomain as 'portal' | 'ads',
    intentId: body.intentId ?? undefined,
    caseId: body.caseId,
    agentAction: body.agentAction,
    confidenceBefore,
    confidenceAfter,
    knowledgeUsed,
    knowledgeWeights: (body.knowledgeWeights ?? []).slice(0, knowledgeUsed.length),
    ruleTriggered,
    ruleResult: body.ruleResult,
    authorityLevel: body.authorityLevel,
    executionResult: body.executionResult,
    executionLatencyMs: body.executionLatencyMs ?? 0,
    pipelineVersion: PIPELINE_VERSION,
    tenantMaturityScore: body.tenantMaturityScore ?? 0,
    agentAutonomyLevel: body.agentAutonomyLevel ?? 'GUIDED',
  });

  if (!id) return c.json({ error: 'Failed to write ledger entry' }, 500);
  if (idempotencyKey) {
    ledgerIdempotency.set(idempotencyKey, { id, ts: Date.now() });
  }
  return c.json({ id }, 201);
});

// ─── Tenant Maturity ──────────────────────────────────

const maturityRoutes = new Hono<Env>();
maturityRoutes.use('*', requireRole('system_admin', 'tenant_admin'));

maturityRoutes.get('/', async (c) => {
  const auth = c.get('auth');

  const maturity = await prisma.tenantMaturity.findUnique({
    where: { tenantId: auth.tenantId },
  });

  if (!maturity) {
    return c.json({
      maturity: {
        tenantId: auth.tenantId,
        maturityScore: 0,
        autonomyLevel: 'GUIDED',
        knowledgeScore: 0,
        feedbackScore: 0,
        historyScore: 0,
        ruleScore: 0,
        escalationThreshold: 0.9,
        autoExecuteLimit: 0,
        autonomyOverride: null,
        lastCalculatedAt: null,
      },
    });
  }

  return c.json({ maturity });
});

maturityRoutes.patch('/', async (c) => {
  const auth = c.get('auth');
  if (auth.role !== 'system_admin' && auth.role !== 'tenant_admin') {
    return c.json({ error: 'Only system admins or tenant admins can override maturity settings' }, 403);
  }

  const body = await c.req.json<{
    autonomyOverride?: string | null;
  }>();

  const data: Record<string, unknown> = {};
  const validLevels = ['GUIDED', 'ASSISTED', 'SUPERVISED', 'AUTONOMOUS'];
  if (body.autonomyOverride !== undefined) {
    if (body.autonomyOverride === null) {
      data.autonomyOverride = null;
    } else if (typeof body.autonomyOverride === 'string' && validLevels.includes(body.autonomyOverride)) {
      data.autonomyOverride = body.autonomyOverride;
    } else {
      return c.json({ error: `autonomyOverride must be one of: ${validLevels.join(', ')}` }, 400);
    }
  }

  const maturity = await prisma.tenantMaturity.upsert({
    where: { tenantId: auth.tenantId },
    update: data,
    create: { tenantId: auth.tenantId, ...data },
  });

  return c.json({ maturity });
});

maturityRoutes.post('/recalculate', async (c) => {
  const auth = c.get('auth');
  if (auth.role !== 'system_admin') {
    return c.json({ error: 'Only system admins can trigger TMS recalculation' }, 403);
  }
  evictRecalcLastRun();
  if (!checkCooldown(`maturity:${auth.tenantId}`)) {
    return c.json({ error: 'Recalculation already ran recently. Try again in 60s.' }, 429);
  }

  const result = await applyTMSUpdate(auth.tenantId);
  return c.json({
    tms: result.tms,
    aal: result.aal,
    changed: result.changed,
  });
});

// ─── Dashboard Stats (L2) ─────────────────────────────

const statsRoutes = new Hono<Env>();
statsRoutes.use('*', requireRole('system_admin', 'tenant_admin'));

statsRoutes.get('/dashboard', async (c) => {
  const auth = c.get('auth');
  const daysParam = parseInt(c.req.query('days') ?? '7', 10);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 7;
  const periodStart = new Date(Date.now() - days * MS_PER_DAY);

  const [
    [kbWritebacks, totalCases, closedNonEscalated, totalClosed, recentWritebackImpact],
    [constitutionHits, totalLedger, csatRatings, recentAccepts, recentRejects],
  ] = await Promise.all([
    Promise.all([
      prisma.knowledgeEntry.count({
        where: { tenantId: auth.tenantId, source: 'writeback', createdAt: { gte: periodStart } },
      }),
      prisma.supportCase.count({
        where: { tenantId: auth.tenantId },
      }),
      prisma.supportCase.count({
        where: { tenantId: auth.tenantId, status: 'closed', assignedTo: null },
      }),
      prisma.supportCase.count({
        where: { tenantId: auth.tenantId, status: 'closed' },
      }),
      prisma.knowledgeEntry.aggregate({
        where: {
          tenantId: auth.tenantId,
          source: 'writeback',
          lastUsedAt: { gte: periodStart },
        },
        _avg: { impactScore: true },
      }),
    ]),
    Promise.all([
      prisma.confidenceLedger.count({
        where: {
          tenantId: auth.tenantId,
          NOT: { ruleTriggered: { equals: [] } },
        },
      }),
      prisma.confidenceLedger.count({
        where: { tenantId: auth.tenantId },
      }),
      prisma.feedbackSignal.aggregate({
        where: { tenantId: auth.tenantId, type: 'rating', rating: { not: null } },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.feedbackSignal.count({
        where: { tenantId: auth.tenantId, type: 'accept', createdAt: { gte: periodStart } },
      }),
      prisma.feedbackSignal.count({
        where: { tenantId: auth.tenantId, type: 'reject', createdAt: { gte: periodStart } },
      }),
    ]),
  ]);

  const autoResolutionRate = totalClosed > 0 ? Math.round((closedNonEscalated / totalClosed) * 100) : 0;
  const writebackImpactScore = recentWritebackImpact._avg.impactScore ?? 0;
  const constitutionHitRate = totalLedger > 0 ? Math.round((constitutionHits / totalLedger) * 100) : 0;
  const totalFeedbackActions = recentAccepts + recentRejects;
  const feedbackAcceptRate = totalFeedbackActions > 0
    ? Math.round((recentAccepts / totalFeedbackActions) * 100)
    : 0;
  const csatAvg = csatRatings._avg.rating ?? 0;

  return c.json({
    kbWritebacks,
    autoResolutionRate,
    writebackImpactScore: Math.round(writebackImpactScore * 100) / 100,
    constitutionHitRate,
    feedbackAcceptRate,
    csatTrend: { avg: Math.round(csatAvg * 10) / 10, count: csatRatings._count },
    totalCases,
    escalations: totalClosed - closedNonEscalated,
  });
});

// ─── Causal Chain (L3) ────────────────────────────────

const causalRoutes = new Hono<Env>();
causalRoutes.use('*', requireRole('system_admin', 'tenant_admin'));

causalRoutes.get('/chain', async (c) => {
  const auth = c.get('auth');
  const knowledgeId = c.req.query('knowledgeId');
  if (!knowledgeId || !isValidUUID(knowledgeId)) {
    return c.json({ error: 'knowledgeId is required and must be a valid UUID' }, 400);
  }

  const entry = await prisma.knowledgeEntry.findFirst({
    where: { id: knowledgeId, tenantId: auth.tenantId },
  });
  if (!entry) return c.json({ error: 'Knowledge entry not found' }, 404);

  const ledgerEntries = await prisma.confidenceLedger.findMany({
    where: {
      tenantId: auth.tenantId,
      knowledgeUsed: { has: knowledgeId },
    },
    orderBy: { createdAt: 'desc' },
    take: CAUSAL_CHAIN_LIMIT,
    select: {
      id: true,
      caseId: true,
      agentAction: true,
      confidenceBefore: true,
      confidenceAfter: true,
      executionResult: true,
      feedbackType: true,
      createdAt: true,
    },
  });

  const caseIds = [...new Set(ledgerEntries.map((l) => l.caseId).filter(Boolean))] as string[];
  const cases = caseIds.length > 0
    ? await prisma.supportCase.findMany({
        where: { id: { in: caseIds }, tenantId: auth.tenantId },
        select: { id: true, status: true, issueType: true, closedAt: true },
      })
    : [];

  const caseMap = new Map(cases.map((cs) => [cs.id, cs]));
  const resolvedCount = cases.filter((cs) => cs.status === 'closed').length;
  const escalatedCount = ledgerEntries.filter((l) => l.executionResult === 'escalated').length;

  return c.json({
    knowledge: entry,
    ledgerEntries: ledgerEntries.map((l) => ({
      ...l,
      case: l.caseId ? caseMap.get(l.caseId) ?? null : null,
    })),
    impact: {
      totalReferences: ledgerEntries.length,
      casesResolved: resolvedCount,
      casesEscalated: escalatedCount,
      resolutionRate: ledgerEntries.length > 0
        ? Math.round((resolvedCount / ledgerEntries.length) * 100)
        : 0,
    },
  });
});

causalRoutes.get('/insight-stream', async (c) => {
  const auth = c.get('auth');
  const limit = parsePageSize(c.req.query('limit'), 10);

  const [recentKnowledge, recentFeedback, recentLedger] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, source: true, category: true, content: true, impactScore: true, createdAt: true },
    }),
    prisma.feedbackSignal.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, agentAction: true, reason: true, createdAt: true },
    }),
    prisma.confidenceLedger.findMany({
      where: { tenantId: auth.tenantId, executionResult: { in: ['escalated', 'success'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, agentAction: true, executionResult: true, confidenceBefore: true, createdAt: true },
    }),
  ]);

  type StreamItem = { id: string; timestamp: string; icon: string; category: string; title: string; description: string };
  const items: StreamItem[] = [];

  for (const k of recentKnowledge) {
    items.push({
      id: `ke-${k.id.slice(0, 8)}`,
      timestamp: k.createdAt.toISOString(),
      icon: k.source === 'writeback' ? '📝' : '📚',
      category: 'knowledge',
      title: `${k.source === 'writeback' ? 'Writeback' : 'Knowledge'}: ${k.category}`,
      description: k.content.slice(0, 120) + (k.content.length > 120 ? '...' : ''),
    });
  }

  const FEEDBACK_ICON: Record<string, string> = { accept: '✅', reject: '❌', resolved: '👍', rating: '⭐', modify: '✏️' };
  for (const f of recentFeedback) {
    const icon = FEEDBACK_ICON[f.type] ?? '💬';
    items.push({
      id: `fb-${f.id.slice(0, 8)}`,
      timestamp: f.createdAt.toISOString(),
      icon,
      category: f.type === 'resolved' ? 'sentiment' : 'market',
      title: `${f.type.charAt(0).toUpperCase() + f.type.slice(1)}: ${f.agentAction}`,
      description: f.reason?.slice(0, 120) ?? 'No reason provided',
    });
  }

  for (const l of recentLedger) {
    items.push({
      id: `cl-${l.id.slice(0, 8)}`,
      timestamp: l.createdAt.toISOString(),
      icon: l.executionResult === 'escalated' ? '🚨' : '🤖',
      category: l.executionResult === 'escalated' ? 'market' : 'product',
      title: `Agent: ${l.agentAction}`,
      description: `Confidence: ${((l.confidenceBefore ?? 0) * 100).toFixed(0)}% → ${l.executionResult}`,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return c.json({ items: items.slice(0, limit) });
});

// ─── Drift Detection ──────────────────────────────────

const DRIFT_COOLDOWN_MS = 5 * 60_000;
const driftCache = new Map<string, { alerts: DriftAlert[]; ts: number }>();

function evictDriftCache(): void {
  const cutoff = Date.now() - DRIFT_COOLDOWN_MS;
  for (const [k, v] of driftCache.entries()) {
    if (v.ts < cutoff) driftCache.delete(k);
  }
}

const driftRoutes = new Hono<Env>();
driftRoutes.use('*', requireRole('system_admin', 'tenant_admin'));

driftRoutes.get('/alerts', async (c) => {
  const auth = c.get('auth');
  evictDriftCache();
  const cached = driftCache.get(auth.tenantId);
  if (cached && Date.now() - cached.ts < DRIFT_COOLDOWN_MS) {
    return c.json({ alerts: cached.alerts, detectedAt: new Date(cached.ts).toISOString(), cached: true });
  }

  const alerts = await detectDrift(auth.tenantId);
  driftCache.set(auth.tenantId, { alerts, ts: Date.now() });
  return c.json({ alerts, detectedAt: new Date().toISOString(), cached: false });
});

// ─── Mount all sub-routes ─────────────────────────────

app.route('/feedback', feedbackRoutes);
app.route('/knowledge', knowledgeRoutes);
app.route('/ledger', ledgerRoutes);
app.route('/maturity', maturityRoutes);
app.route('/stats', statsRoutes);
app.route('/causal', causalRoutes);
app.route('/drift', driftRoutes);

export { app as harnessRoutes };
