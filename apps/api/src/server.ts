import { Hono } from 'hono';
import crypto from 'node:crypto';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import type { AgentIntent } from '@repo/shared-types';
import { RUNTIME_FACTS_JSON_SCHEMA } from '@repo/shared-types';
import { Prisma, type RuleSetStatus } from '@prisma/client';
import { env } from './env.js';
import { prisma } from './db.js';
import { enqueueAdsRun, startQueue, stopQueue } from './queue.js';
import { resolveParams } from './policy.js';
import {
  syncLifecycleByCommodity,
  syncLifecycleByListing,
  syncLifecycleByProduct,
} from './lifecycle.js';
import {
  approvalEvents,
  startApprovalNotificationListener,
  stopApprovalNotificationListener,
  type ApprovalEvent,
} from './sse.js';
import { RULE_TEMPLATES, renderTemplate } from './rule-templates.js';
import {
  detectRuleConflicts,
  estimateRuleImpact,
  type RuleDslAst,
  generateRuleSuggestions,
  parseNaturalLanguageRules,
} from './rules-engine.js';
import { compileAstToIntents } from './intent-compiler.js';
import { validateRuntimeFacts } from './intent-compiler.js';
import { sanitizeIntent } from './intent-sanitizer.js';
import {
  evaluateConstitution,
  loadActiveConstitution,
  loadConstitutionHistory,
  publishConstitution,
  type ConstitutionRule,
} from './constitution-engine.js';
import { mdmPrimitivesRoutes } from './mdm-primitives-routes.js';
import { mdmAssetRoutes } from './mdm-asset-routes.js';
import { mdmContentRoutes } from './mdm-content-routes.js';
import { mdmMappingRoutes } from './mdm-mapping-routes.js';
import { knowledgeGraphRoutes } from './knowledge-graph-routes.js';
import { portalRoutes } from './portal-routes.js';
import { portalAuthRoutes } from './portal-auth.js';
import { supportRoutes } from './support-routes.js';
import { harnessRoutes } from './harness-routes.js';
import { constitutionRoutes } from './constitution-routes.js';
import { portalConfigRoutes } from './portal-config-routes.js';
import { registerMasterDataHandlers } from './mdm-events.js';
import { MdmIsolationHandler } from './mdm-isolation-handler.js';
import { featureRoutes } from './feature-routes.js';
import { exchangeRateRoutes, syncExchangeRates, calculateMonthlyAvg, purgeOldSnapshots } from './exchange-rate-routes.js';
import { marketComplianceRoutes } from './market-compliance-routes.js';

import { extractUser, requireRole, buildScopeFilter, type AuthContext } from './auth-middleware.js';
import { authRoutes } from './auth-routes.js';
import { filterResponse } from './response-filter.js';
import { validateScope } from './scope-guard.js';
import { metrics } from './metrics.js';
import { verifyChain, type AuditEntry } from './audit-chain.js';
import { sseManager, startSSEEventForwarding } from './sse-manager.js';
import { queryMemory, storeEmbedding } from './memory.js';
import { createRequestLogger } from './logger.js';
import { Pool } from 'pg';
import { invalidateTenantCache } from './rate-limiter.js';
import {
  distillPatterns,
  matchPatterns,
  recordPatternOutcome,
  decayStalePatterns,
  getEvolutionStats,
} from './evolution.js';
import {
  listPublicKnowledge,
  getPublicKnowledge,
  upsertPublicKnowledge,
  queryIndustryBenchmarks,
  contributeToIndustryBenchmark,
  getTenantColdStartConfig,
} from './knowledge.js';

const app = new Hono<{ Variables: { auth: AuthContext } }>();
const adminQueryPool = new Pool({ connectionString: env.DATABASE_ADMIN_URL });

app.use(
  '*',
  cors({
    origin: env.NODE_ENV === 'production'
      ? env.CORS_ORIGIN.split(',')
      : ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3100'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-user-id', 'x-user-role'],
  }),
);

app.use(async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '0');
});

app.route('/auth', authRoutes);

// Portal routes: mounted before extractUser since they use independent auth (portalAuth)
app.route('/portal/auth', portalAuthRoutes);
app.route('/portal', portalRoutes);

app.use(async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const path = c.req.routePath || c.req.path;
  metrics.recordEndpoint(path, duration, c.res.status >= 400);

  if (c.res.status >= 400) {
    const auth = c.get('auth');
    const reqLogger = createRequestLogger(auth?.tenantId, auth?.userId);
    reqLogger.warn('request_error', {
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs: duration,
    });
  }
});

const skipAuthPrefixes = ['/portal', '/auth', '/health'];
app.use(async (c, next) => {
  if (skipAuthPrefixes.some((p) => c.req.path.startsWith(p))) return next();
  return extractUser(c, next);
});
app.use(async (c, next) => {
  if (skipAuthPrefixes.some((p) => c.req.path.startsWith(p))) return next();
  return validateScope(c, next);
});
app.use(async (c, next) => {
  if (skipAuthPrefixes.some((p) => c.req.path.startsWith(p))) return next();
  return filterResponse(c, next);
});

// Mount support routes (ops dashboard)
app.route('/support', supportRoutes);
app.route('/portal-config', portalConfigRoutes);

// Mount Harness — AI Governance Runtime routes
app.route('/harness', harnessRoutes);
app.route('/constitution', constitutionRoutes);

// Mount MDM route groups under /mdm prefix
app.route('/mdm', mdmPrimitivesRoutes);
app.route('/mdm', mdmAssetRoutes);
app.route('/mdm', mdmContentRoutes);
app.route('/mdm', mdmMappingRoutes);
app.route('/mdm', knowledgeGraphRoutes);
app.route('/features', featureRoutes);
app.route('/exchange-rates', exchangeRateRoutes);
app.route('/market-compliance', marketComplianceRoutes);

app.get('/mdm/debug-reload', (c) => c.json({ reloadedAt: new Date().toISOString(), version: 'v4-final' }));

const REPLAY_ALERT_POLICY_KEY = 'securityReplayAlertThreshold';
const DEFAULT_REPLAY_ALERT_THRESHOLD = 5;
let nonceCleanupTimer: NodeJS.Timeout | null = null;

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as typeof prisma);
  });
}

function extractBidDeltaPct(payload: Record<string, unknown>): number | null {
  const candidates = [payload.bidDeltaPct, payload.deltaPct, payload.percent];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function verifyRunSignature(input: {
  body: string;
  timestamp: string | undefined;
  signature: string | undefined;
  tenantId: string | undefined;
  origin: string | undefined;
}): { ok: true } | { ok: false; reason: string } {
  const { body, timestamp, signature, tenantId, origin } = input;
  if (!timestamp || !signature || !tenantId || !origin) {
    return { ok: false, reason: 'missing signature headers' };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid signature timestamp' };
  }
  const skewSeconds = Math.abs(Date.now() / 1000 - ts);
  if (skewSeconds > env.RUN_INTENT_MAX_SKEW_SECONDS) {
    return { ok: false, reason: 'signature timestamp expired' };
  }

  const expected = crypto
    .createHmac('sha256', env.RUN_INTENT_SIGNING_SECRET)
    .update(`${timestamp}.${tenantId}.${origin}.${body}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return { ok: false, reason: 'invalid signature' };
  }
  return { ok: true };
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, 'base64').toString('utf8');
}

function computeIntentFingerprint(intent: AgentIntent): string {
  const payload = {
    intentId: intent.intentId,
    domain: intent.domain,
    action: intent.action,
    target: intent.target,
    scope: intent.scope,
    payload: intent.payload,
    risk: intent.risk,
    policySnapshotId: intent.policySnapshotId ?? null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function signDecisionToken(input: {
  tenantId: string;
  intent: AgentIntent;
  origin: string;
  exp: number;
  jti: string;
}): string {
  const body = base64UrlEncode(
    JSON.stringify({
      jti: input.jti,
      tenantId: input.tenantId,
      intentId: input.intent.intentId,
      fingerprint: computeIntentFingerprint(input.intent),
      origin: input.origin,
      exp: input.exp,
      approved: true,
    }),
  );
  const signature = crypto
    .createHmac('sha256', env.DECISION_TOKEN_SECRET)
    .update(body)
    .digest('hex');
  return `${body}.${signature}`;
}

function verifyDecisionToken(input: {
  token: string | undefined;
  tenantId: string;
  intent: AgentIntent;
  origin: string | undefined;
}): { ok: true; claims: { jti: string } } | { ok: false; reason: string } {
  if (!input.token) return { ok: false, reason: 'missing decision token header' };
  const [body, signature] = input.token.split('.');
  if (!body || !signature) return { ok: false, reason: 'invalid decision token format' };

  const expected = crypto
    .createHmac('sha256', env.DECISION_TOKEN_SECRET)
    .update(body)
    .digest('hex');
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return { ok: false, reason: 'invalid decision token signature' };
  }

  let claims: {
    jti: string;
    tenantId: string;
    intentId: string;
    fingerprint: string;
    origin: string;
    exp: number;
    approved: boolean;
  };
  try {
    claims = JSON.parse(base64UrlDecode(body)) as typeof claims;
  } catch {
    return { ok: false, reason: 'invalid decision token payload' };
  }
  if (!claims.approved) return { ok: false, reason: 'decision token not approved' };
  if (!claims.jti || !/^[0-9a-fA-F-]{16,64}$/.test(claims.jti)) {
    return { ok: false, reason: 'decision token missing jti' };
  }
  if (claims.tenantId !== input.tenantId) return { ok: false, reason: 'decision token tenant mismatch' };
  if (claims.intentId !== input.intent.intentId) return { ok: false, reason: 'decision token intent mismatch' };
  if (claims.origin !== input.origin) return { ok: false, reason: 'decision token origin mismatch' };
  if (!Number.isFinite(claims.exp) || claims.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'decision token expired' };
  }
  if (claims.fingerprint !== computeIntentFingerprint(input.intent)) {
    return { ok: false, reason: 'decision token fingerprint mismatch' };
  }
  return { ok: true, claims: { jti: claims.jti } };
}

async function consumeDecisionTokenJti(tenantId: string, jti: string): Promise<boolean> {
  const nonce = `decision_${jti}`;
  const result = await withTenant(tenantId, (tx) =>
    tx.requestNonce.deleteMany({
      where: {
        tenantId,
        nonce,
      },
    }),
  );
  return result.count === 1;
}

async function logSecurityEvent(input: {
  tenantId: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details?: Record<string, unknown>;
}): Promise<void> {
  await withTenant(input.tenantId, (tx) =>
    tx.securityAuditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: input.eventType,
        severity: input.severity,
        details: (input.details ?? {}) as never,
      },
    }),
  );
}

async function claimRunNonce(params: {
  tenantId: string;
  nonce: string;
}): Promise<{ ok: true } | { ok: false; reason: 'INVALID_NONCE' | 'REPLAYED_NONCE' }> {
  const { tenantId, nonce } = params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    await logSecurityEvent({
      tenantId,
      eventType: 'NONCE_INVALID_BLOCKED',
      severity: 'WARNING',
      details: { nonce },
    });
    return { ok: false, reason: 'INVALID_NONCE' };
  }
  try {
    await withTenant(tenantId, async (tx) => {
      await tx.requestNonce.create({
        data: {
          tenantId,
          nonce,
        },
      });
      await tx.requestNonce.deleteMany({
        where: {
          tenantId,
          createdAt: {
            lt: new Date(Date.now() - env.NONCE_RETENTION_HOURS * 60 * 60 * 1000),
          },
        },
      });
      return Promise.resolve();
    });
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      await logSecurityEvent({
        tenantId,
        eventType: 'NONCE_REPLAY_BLOCKED',
        severity: 'CRITICAL',
        details: { nonce },
      });
      return { ok: false, reason: 'REPLAYED_NONCE' };
    }
    throw error;
  }
}

function startNonceCleanupScheduler(): void {
  if (nonceCleanupTimer) return;
  const intervalMs = Math.max(30, env.NONCE_CLEANUP_INTERVAL_SECONDS) * 1000;
  nonceCleanupTimer = setInterval(() => {
    void prisma.requestNonce
      .deleteMany({
        where: {
          createdAt: {
            lt: new Date(Date.now() - env.NONCE_RETENTION_HOURS * 60 * 60 * 1000),
          },
        },
      })
      .catch((error) => {
        console.error('nonce cleanup failed', error);
      });
  }, intervalMs);
}

function stopNonceCleanupScheduler(): void {
  if (!nonceCleanupTimer) return;
  clearInterval(nonceCleanupTimer);
  nonceCleanupTimer = null;
}

app.get('/health', (c) => c.json({ ok: true, mode: env.AMAZON_ADS_MODE }));

app.get('/events/stream', async (c) => {
  const auth = c.get('auth');
  if (!auth) return c.json({ error: 'unauthorized' }, 401);

  const connId = crypto.randomUUID();
  const tenantId = auth.tenantId;

  return streamSSE(c, async (stream) => {
    const registered = sseManager.register({
      id: connId,
      tenantId,
      send: (event, data) => {
        void stream.writeSSE({ event, data, id: crypto.randomUUID() });
      },
      close: () => stream.close(),
    });

    if (!registered) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: 'connection limit exceeded', maxConnections: 10 }),
        id: crypto.randomUUID(),
      });
      stream.close();
      return;
    }

    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ connId, tenantId }),
      id: crypto.randomUUID(),
    });

    stream.onAbort(() => {
      sseManager.unregister(connId, tenantId);
    });

    while (true) {
      await stream.writeSSE({ event: 'ping', data: '', id: crypto.randomUUID() });
      await stream.sleep(30000);
    }
  });
});

app.get('/metrics', requireRole('system_admin'), async (c) => {
  return c.json({
    endpoints: metrics.getEndpointMetrics(),
    agents: metrics.getAgentMetrics(),
    sse: sseManager.getStats(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/audit/verify', requireRole('system_admin'), async (c) => {
  const body = (await c.req.json()) as { entries: AuditEntry[] };
  const result = verifyChain(body.entries);
  return c.json(result);
});

app.post('/memory/query', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const body = (await c.req.json()) as {
    tenantId?: string;
    domain?: string;
    platform?: string;
    market?: string;
    categoryId?: string;
    embedding?: number[];
    limit?: number;
    daysBack?: number;
  };
  const auth = c.get('auth');
  const tenantId = (auth.role === 'system_admin' && body.tenantId)
    ? body.tenantId
    : auth.tenantId;

  const results = await queryMemory({
    ...body,
    tenantId,
  });
  return c.json({ items: results });
});

app.post('/memory/embed', requireRole('system_admin'), async (c) => {
  const body = (await c.req.json()) as {
    experienceId: string;
    embedding: number[];
    tenantId?: string;
  };
  const result = await storeEmbedding(body.experienceId, body.embedding, body.tenantId);
  return c.json(result);
});

app.post('/evolution/distill', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const body = (await c.req.json()) as {
    intentDomain: string;
    platform?: string;
    market?: string;
    minSamples?: number;
    daysBack?: number;
  };
  const auth = c.get('auth');
  const result = await distillPatterns({
    tenantId: auth.tenantId,
    ...body,
  });
  return c.json(result);
});

app.get('/evolution/patterns', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const auth = c.get('auth');
  const domain = c.req.query('domain') ?? '';
  const platform = c.req.query('platform');
  const market = c.req.query('market');
  const lifecycleStage = c.req.query('lifecycleStage');
  const patterns = await matchPatterns(auth.tenantId, domain, platform ?? undefined, market ?? undefined, lifecycleStage ?? undefined);
  return c.json({ items: patterns });
});

app.post('/evolution/patterns/:id/outcome', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const auth = c.get('auth');
  const patternId = c.req.param('id');
  const body = (await c.req.json()) as { traceId: string; outcome: 'SUCCESS' | 'FAILED' };
  await recordPatternOutcome(auth.tenantId, patternId, body.traceId, body.outcome);
  return c.json({ ok: true });
});

app.post('/evolution/decay', requireRole('system_admin'), async (c) => {
  const body = (await c.req.json()) as { tenantId?: string; staleDays?: number };
  const auth = c.get('auth');
  const tenantId = body.tenantId ?? auth.tenantId;
  const count = await decayStalePatterns(tenantId, body.staleDays);
  return c.json({ decayed: count });
});

app.get('/evolution/stats', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const auth = c.get('auth');
  const daysBack = parseInt(c.req.query('daysBack') ?? '30', 10);
  const stats = await getEvolutionStats(auth.tenantId, daysBack);
  return c.json(stats);
});

app.get('/knowledge/public', requireRole('system_admin', 'tenant_admin', 'operator', 'supplier', 'viewer'), async (c) => {
  const auth = c.get('auth');
  const domain = c.req.query('domain');
  const includeInactive = auth.role === 'system_admin';
  const items = await listPublicKnowledge(domain ?? undefined, includeInactive);
  return c.json({ items });
});

app.get('/knowledge/public/:id', requireRole('system_admin', 'tenant_admin', 'operator', 'supplier', 'viewer'), async (c) => {
  const item = await getPublicKnowledge(c.req.param('id'));
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(item);
});

app.post('/knowledge/public', requireRole('system_admin'), async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json()) as {
    domain: string;
    key: string;
    title: string;
    content: unknown;
  };
  const result = await upsertPublicKnowledge(
    body.domain,
    body.key,
    body.title,
    body.content as import('@prisma/client').Prisma.InputJsonValue,
    auth.userId ?? 'system',
  );
  return c.json(result);
});

app.get('/knowledge/benchmarks', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const category = c.req.query('category') ?? '';
  const metricsParam = c.req.query('metrics');
  const metrics = metricsParam ? metricsParam.split(',') : undefined;
  const daysBack = parseInt(c.req.query('daysBack') ?? '90', 10);
  const items = await queryIndustryBenchmarks(category, metrics, daysBack);
  return c.json({ items });
});

app.post('/knowledge/benchmarks/contribute', requireRole('system_admin'), async (c) => {
  const auth = c.get('auth');
  const body = (await c.req.json()) as {
    tenantId?: string;
    industryCategory: string;
    metricKey: string;
    metricValue: number;
    periodStart: string;
    periodEnd: string;
  };
  const targetTenantId = body.tenantId ?? auth.tenantId;
  const result = await contributeToIndustryBenchmark(
    targetTenantId,
    body.industryCategory,
    body.metricKey,
    body.metricValue,
    new Date(body.periodStart),
    new Date(body.periodEnd),
  );
  return c.json({ ok: true, ...result });
});

app.get('/knowledge/cold-start', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const auth = c.get('auth');
  const config = await getTenantColdStartConfig(auth.tenantId);
  return c.json(config);
});

app.post('/run', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const rawBody = await c.req.text();
  const tenantHeader = c.req.header('x-tenant-id');
  const originHeader = c.req.header('x-intent-origin');
  const decisionToken = c.req.header('x-decision-token');
  const runNonce = c.req.header('x-intent-nonce');
  const signatureCheck = verifyRunSignature({
    body: rawBody,
    timestamp: c.req.header('x-intent-ts'),
    signature: c.req.header('x-intent-signature'),
    tenantId: tenantHeader,
    origin: originHeader,
  });
  if (!signatureCheck.ok) {
    return c.json({ error: 'unauthorized run request', reason: signatureCheck.reason }, 401);
  }
  if (originHeader !== env.TRUSTED_INTENT_ORIGIN) {
    return c.json({ error: 'untrusted run origin' }, 403);
  }

  let body: {
    tenantId: string;
    intent: AgentIntent;
    context?: { brandId?: string; productId?: string };
  };
  try {
    body = (JSON.parse(rawBody) as unknown) as typeof body;
  } catch {
    return c.json({ error: 'invalid json body' }, 400);
  }
  if (!body?.tenantId || !body?.intent?.intentId) {
    return c.json({ error: 'tenantId and intent.intentId are required' }, 400);
  }
  if (!tenantHeader || body.tenantId !== tenantHeader) {
    return c.json({ error: 'tenant context mismatch' }, 403);
  }
  const decisionCheck = verifyDecisionToken({
    token: decisionToken,
    tenantId: tenantHeader,
    intent: body.intent,
    origin: originHeader,
  });
  if (!decisionCheck.ok) {
    return c.json({ error: 'run denied by policy token', reason: decisionCheck.reason }, 403);
  }
  if (!runNonce) {
    await logSecurityEvent({
      tenantId: body.tenantId,
      eventType: 'NONCE_MISSING_BLOCKED',
      severity: 'WARNING',
      details: { intentId: body.intent.intentId },
    });
    return c.json({ error: 'missing x-intent-nonce header' }, 401);
  }
  const nonceAccepted = await claimRunNonce({ tenantId: body.tenantId, nonce: runNonce });
  if (!nonceAccepted.ok) {
    return c.json(
      {
        error: 'replayed or invalid nonce',
        reason: nonceAccepted.reason,
      },
      409,
    );
  }
  if (body.intent.scope?.tenantId !== body.tenantId) {
    return c.json({ error: 'intent.scope.tenantId must match tenantId' }, 400);
  }

  const sanitizeResult = sanitizeIntent(body.intent);
  if (!sanitizeResult.ok) {
    await logSecurityEvent({
      tenantId: body.tenantId,
      eventType: 'INTENT_SANITIZE_BLOCKED',
      severity: 'CRITICAL',
      details: { intentId: body.intent.intentId, violations: sanitizeResult.violations },
    });
    return c.json({ error: 'intent validation failed', violations: sanitizeResult.violations }, 400);
  }

  const { policy, constitution } = await withTenant(body.tenantId, async (tx) => {
    const [p, c] = await Promise.all([
      resolveParams(tx, {
        tenantId: body.tenantId,
        brandId: body.context?.brandId ?? null,
        productId: body.context?.productId ?? null,
      }),
      loadActiveConstitution(tx, body.tenantId),
    ]);
    return { policy: p, constitution: c };
  });
  const constitutionDecision = evaluateConstitution(constitution, {
    intent: body.intent,
  });
  if (!constitutionDecision.pass) {
    await logSecurityEvent({
      tenantId: body.tenantId,
      eventType: 'CONSTITUTION_HARD_REJECTED',
      severity: 'CRITICAL',
      details: {
        intentId: body.intent.intentId,
        action: body.intent.action,
        hardViolations: constitutionDecision.hardViolations,
        constitutionVersion: constitution.version,
      },
    });
    return c.json(
      {
        error: 'intent rejected by constitution',
        hardViolations: constitutionDecision.hardViolations,
      },
      409,
    );
  }

  const snapshot = await withTenant(body.tenantId, (tx) =>
    tx.policySnapshot.create({
      data: {
        tenantId: body.tenantId,
        source: 'resolveParams',
        params: {
          ...policy,
          constitutionVersion: constitution.version,
        } as never,
      },
    }),
  );

  const riskScoreBase = Number(body.intent.risk?.score ?? 0);
  const nextRiskScore = constitutionDecision.requiresApproval
    ? Math.max(riskScoreBase, 0.7)
    : riskScoreBase;
  const intent = {
    ...body.intent,
    risk: {
      ...body.intent.risk,
      score: nextRiskScore,
      level:
        (nextRiskScore >= 0.9
          ? 'CRITICAL'
          : nextRiskScore >= 0.7
            ? 'HIGH'
            : nextRiskScore >= 0.4
              ? 'MEDIUM'
              : 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      violations: [
        ...(body.intent.risk?.violations ?? []),
        ...constitutionDecision.structuralViolations,
      ],
    },
    policySnapshotId: snapshot.id,
    payload: {
      ...body.intent.payload,
      policyParams: policy.values,
      constitutionVersion: constitution.version,
    },
  };

  const consumed = await consumeDecisionTokenJti(tenantHeader, decisionCheck.claims.jti);
  if (!consumed) {
    await logSecurityEvent({
      tenantId: tenantHeader,
      eventType: 'DECISION_TOKEN_REPLAY_BLOCKED',
      severity: 'CRITICAL',
      details: {
        jti: decisionCheck.claims.jti,
        intentId: body.intent.intentId,
      },
    });
    return c.json({ error: 'run denied by policy token', reason: 'decision token replayed or unknown' }, 409);
  }

  const jobId = await enqueueAdsRun({ tenantId: body.tenantId, intent });
  return c.json({ status: 'ACCEPTED', jobId }, 202);
});

app.get('/approvals', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const tenantId = c.req.query('tenantId');
  const status = c.req.query('status');
  const limit = Number(c.req.query('limit') ?? 50);
  const includeGovernance = c.req.query('governance') === 'true';
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  const approvals = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.findMany({
      where: {
        tenantId,
        status: status as never,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    }),
  );

  if (!includeGovernance) {
    return c.json({ items: approvals });
  }

  const intentIds = approvals.map((a) => a.intentId);
  const [logs, receipts] = await withTenant(tenantId, async (tx) => {
    const [l, r] = await Promise.all([
      tx.agentExecutionLog.findMany({
        where: { tenantId, intentId: { in: intentIds } },
        select: {
          intentId: true,
          reasoningChain: true,
          riskLevel: true,
          status: true,
          targetKey: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      tx.executionReceipt.findMany({
        where: { tenantId, intentId: { in: intentIds } },
        select: {
          intentId: true,
          platform: true,
          executionId: true,
          status: true,
          rollbackSupported: true,
          createdAt: true,
        },
      }),
    ]);
    return [l, r] as const;
  });

  const logByIntent = new Map(logs.map((l) => [l.intentId, l]));
  const receiptByIntent = new Map(receipts.map((r) => [r.intentId, r]));

  const items = approvals.map((approval) => {
    const log = logByIntent.get(approval.intentId);
    const receipt = receiptByIntent.get(approval.intentId);
    const chain = log?.reasoningChain as Record<string, unknown> | null;
    return {
      ...approval,
      governance: {
        reasoningLog: chain
          ? { summary: chain.summary, observe: chain.observe, orient: chain.orient, decide: chain.decide }
          : null,
        constitution: chain?.constitutionVersion
          ? { version: chain.constitutionVersion }
          : null,
        riskLevel: log?.riskLevel ?? null,
        executionStatus: log?.status ?? null,
        targetKey: log?.targetKey ?? null,
        receipt: receipt ?? null,
      },
    };
  });

  return c.json({ items });
});

app.get('/listings', async (c) => {
  const tenantId = c.req.query('tenantId');
  const commodityId = c.req.query('commodityId');
  const platformId = c.req.query('platformId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  const auth = c.get('auth');
  const scopeFilter = auth ? buildScopeFilter(auth) : { tenantId };

  const listings = await withTenant(tenantId, (tx) =>
    tx.listing.findMany({
      where: {
        ...scopeFilter,
        commodityId: commodityId || undefined,
        platformId: platformId || undefined,
      },
      orderBy: { createdAt: 'desc' },
    }),
  );
  return c.json({ items: listings });
});

app.post('/listings', async (c) => {
  const body = (await c.req.json()) as {
    tenantId: string;
    commodityId: string;
    platformId: string;
    externalListingId: string;
    title: string;
    isPrimary?: boolean;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  };
  const commodity = await withTenant(body.tenantId, (tx) =>
    tx.commodity.findFirst({
      where: {
        id: body.commodityId,
        tenantId: body.tenantId,
      },
    }),
  );
  if (!commodity) {
    return c.json({ error: 'commodity not found in tenant scope' }, 404);
  }

  const listing = await withTenant(body.tenantId, (tx) =>
    tx.listing.create({
      data: {
        tenantId: body.tenantId,
        commodityId: body.commodityId,
        platformId: body.platformId,
        externalListingId: body.externalListingId,
        title: body.title,
        isPrimary: body.isPrimary ?? false,
        status: body.status ?? 'DRAFT',
        origin: 'system',
        mappingStatus: 'mapped',
      },
    }),
  );

  await withTenant(body.tenantId, (tx) => syncLifecycleByListing(tx, listing.id));
  return c.json({ item: listing }, 201);
});

app.patch('/listings/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    tenantId: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    isPrimary?: boolean;
  };
  if (!body.tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }
  const existing = await withTenant(body.tenantId, (tx) =>
    tx.listing.findFirst({ where: { id, tenantId: body.tenantId } }),
  );
  if (!existing) {
    return c.json({ error: 'listing not found' }, 404);
  }

  const listing = await withTenant(body.tenantId, (tx) =>
    tx.listing.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        isPrimary: body.isPrimary,
      },
    }),
  );

  await withTenant(body.tenantId, (tx) => syncLifecycleByListing(tx, listing.id));
  return c.json({ item: listing });
});

app.post('/lifecycle/sync', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    tenantId: string;
    listingId?: string;
    commodityId?: string;
    productId?: string;
  };
  if (!body.tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  if (body.listingId) {
    const listing = await withTenant(body.tenantId, (tx) =>
      tx.listing.findFirst({ where: { id: body.listingId, tenantId: body.tenantId } }),
    );
    if (!listing) return c.json({ error: 'listing not found' }, 404);
    await withTenant(body.tenantId, (tx) => syncLifecycleByListing(tx, body.listingId as string));
    return c.json({ ok: true, level: 'listing', id: body.listingId });
  }
  if (body.commodityId) {
    const commodity = await withTenant(body.tenantId, (tx) =>
      tx.commodity.findFirst({ where: { id: body.commodityId, tenantId: body.tenantId } }),
    );
    if (!commodity) return c.json({ error: 'commodity not found' }, 404);
    await withTenant(body.tenantId, (tx) => syncLifecycleByCommodity(tx, body.commodityId as string));
    return c.json({ ok: true, level: 'commodity', id: body.commodityId });
  }
  if (body.productId) {
    const product = await withTenant(body.tenantId, (tx) =>
      tx.product.findFirst({ where: { id: body.productId, tenantId: body.tenantId } }),
    );
    if (!product) return c.json({ error: 'product not found' }, 404);
    await withTenant(body.tenantId, (tx) => syncLifecycleByProduct(tx, body.productId as string));
    return c.json({ ok: true, level: 'product', id: body.productId });
  }

  return c.json({ error: 'listingId or commodityId or productId is required' }, 400);
});

app.post('/approvals/:id/approve', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const id = c.req.param('id');
  const tenantId = c.req.header('x-tenant-id');
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as { reviewerId?: string };
  if (!tenantId) {
    return c.json({ error: 'x-tenant-id header is required' }, 401);
  }
  const reviewerId = auth?.userId ?? body.reviewerId ?? 'operator';

  const queueItem = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.findFirst({ where: { id, tenantId } }),
  );
  if (!queueItem) {
    return c.json({ error: 'approval not found' }, 404);
  }
  if (queueItem.status !== 'PENDING') {
    return c.json({ error: `approval is ${queueItem.status}` }, 409);
  }

  const log = await withTenant(tenantId, (tx) =>
    tx.agentExecutionLog.findUnique({ where: { intentId: queueItem.intentId } }),
  );
  const ageMs = Date.now() - new Date(log?.startedAt ?? queueItem.createdAt).getTime();
  const ttlMs = env.APPROVAL_FRESHNESS_TTL_MINUTES * 60 * 1000;
  if (ageMs > ttlMs) {
    const expired = await withTenant(tenantId, (tx) =>
      tx.approvalQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'EXPIRED',
          reviewerId,
          reviewedAt: new Date(),
        },
      }),
    );
    return c.json({ ok: false, id: expired.id, status: expired.status, reason: 'STALE_CONTEXT' }, 409);
  }

  const intentSnapshot = (log?.reasoningChain as Record<string, unknown> | null)?.intentSnapshot as
    | AgentIntent
    | undefined;
  if (!intentSnapshot) {
    return c.json({ error: 'missing intent snapshot for resume' }, 409);
  }

  const item = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.update({
      where: { id: queueItem.id },
      data: {
        status: 'APPROVED',
        reviewerId,
        reviewedAt: new Date(),
      },
    }),
  );

  await enqueueAdsRun({
    tenantId: item.tenantId,
    intent: {
      ...intentSnapshot,
      payload: {
        ...intentSnapshot.payload,
        resumeApproved: true,
      },
    },
  });

  return c.json({ ok: true, id: item.id, status: item.status, resumed: true });
});

app.post('/approvals/:id/reject', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const id = c.req.param('id');
  const tenantId = c.req.header('x-tenant-id');
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as {
    reviewerId?: string;
    reason?: string;
  };
  if (!tenantId) {
    return c.json({ error: 'x-tenant-id header is required' }, 401);
  }
  if (!body.reason) {
    return c.json({ error: 'reason is required for rejection (evolution layer fuel)' }, 400);
  }
  const reviewerId = auth?.userId ?? body.reviewerId ?? 'operator';
  const approval = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.findFirst({ where: { id, tenantId } }),
  );
  if (!approval) {
    return c.json({ error: 'approval not found' }, 404);
  }

  const item = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.update({
      where: { id: approval.id },
      data: {
        status: 'REJECTED',
        reviewerId,
        reason: body.reason,
        reviewedAt: new Date(),
      },
    }),
  );

  return c.json({ ok: true, id: item.id, status: item.status });
});

app.post('/approvals/:id/cancel', requireRole('system_admin', 'tenant_admin', 'operator'), async (c) => {
  const id = c.req.param('id');
  const tenantId = c.req.header('x-tenant-id');
  const auth = c.get('auth');
  const body = (await c.req.json().catch(() => ({}))) as {
    reviewerId?: string;
    reason?: string;
  };
  if (!tenantId) {
    return c.json({ error: 'x-tenant-id header is required' }, 401);
  }
  const reviewerId = auth?.userId ?? body.reviewerId ?? 'operator';
  const approval = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.findFirst({ where: { id, tenantId } }),
  );
  if (!approval) {
    return c.json({ error: 'approval not found' }, 404);
  }

  const item = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.update({
      where: { id: approval.id },
      data: {
        status: 'EXPIRED',
        reviewerId,
        reason: body.reason ?? 'Cancelled by operator',
        reviewedAt: new Date(),
      },
    }),
  );

  return c.json({ ok: true, id: item.id, status: item.status });
});

app.post('/approvals/expire', async (c) => {
  const tenantId = c.req.header('x-tenant-id');
  const body = (await c.req.json().catch(() => ({}))) as { olderThanMinutes?: number };
  if (!tenantId) {
    return c.json({ error: 'x-tenant-id header is required' }, 401);
  }
  const olderThanMinutes = Number(body.olderThanMinutes ?? env.APPROVAL_FRESHNESS_TTL_MINUTES);
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const result = await withTenant(tenantId, (tx) =>
    tx.approvalQueue.updateMany({
      where: {
        tenantId,
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'EXPIRED',
        reviewedAt: new Date(),
        reviewerId: 'system-expirer',
      },
    }),
  );

  return c.json({ ok: true, expired: result.count });
});

app.get('/rule-templates', (c) => {
  const category = c.req.query('category');
  const items = category
    ? RULE_TEMPLATES.filter((template) => template.category === category)
    : RULE_TEMPLATES;
  return c.json({ items });
});

app.post('/rule-templates/:id/apply', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as {
    values?: Record<string, number | string>;
  };

  const template = RULE_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    return c.json({ error: 'template not found' }, 404);
  }

  const text = renderTemplate(template, body.values);
  const parsed = parseNaturalLanguageRules(text);
  const conflicts = detectRuleConflicts(parsed.rules);

  return c.json({
    template,
    generatedRuleText: text,
    parse: parsed,
    conflicts,
  });
});

app.post('/rules/parse', async (c) => {
  const body = (await c.req.json()) as {
    tenantId: string;
    ruleText: string;
  };
  if (!body.tenantId || !body.ruleText) {
    return c.json({ error: 'tenantId and ruleText are required' }, 400);
  }

  const parse = parseNaturalLanguageRules(body.ruleText);
  const conflicts = detectRuleConflicts(parse.rules);
  const suggestions = await withTenant(body.tenantId, (tx) =>
    generateRuleSuggestions(tx, body.tenantId, parse.rules),
  );
  return c.json({ parse, conflicts, suggestions });
});

app.post('/rules/conflicts/check', async (c) => {
  const body = (await c.req.json()) as {
    rules: Array<{
      id: string;
      domain: 'ads' | 'inventory' | 'pricing' | 'seasonality' | 'risk';
      metric: string;
      operator: '<' | '<=' | '>' | '>=' | '=' | 'between';
      value: number | [number, number];
      action: string;
      priority: number;
      sourceText: string;
      confidence: number;
    }>;
  };

  const conflicts = detectRuleConflicts(body.rules ?? []);
  return c.json({ conflicts });
});

app.get('/rules/runtime-facts-schema', (c) => {
  return c.json({
    schema: RUNTIME_FACTS_JSON_SCHEMA,
  });
});

app.get('/security/audit/replay', async (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }
  const hours = Math.min(
    Math.max(Number(c.req.query('hours') ?? 24), 1),
    24 * 30,
  );
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const events = await withTenant(tenantId, (tx) =>
    tx.securityAuditEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: since },
        eventType: {
          in: ['NONCE_REPLAY_BLOCKED', 'NONCE_INVALID_BLOCKED', 'NONCE_MISSING_BLOCKED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  );

  const countsByType = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
    return acc;
  }, {});
  const buckets = events.reduce<Record<string, number>>((acc, event) => {
    const day = event.createdAt.toISOString().slice(0, 10);
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});

  return c.json({
    windowHours: hours,
    since: since.toISOString(),
    totalBlocked: events.length,
    countsByType,
    dailyBuckets: Object.entries(buckets)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recent: events.slice(0, 20).map((event) => ({
      id: event.id,
      eventType: event.eventType,
      severity: event.severity,
      createdAt: event.createdAt,
      details: event.details,
    })),
  });
});

app.get('/security/audit/replay/settings', async (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }
  const now = new Date();
  const row = await withTenant(tenantId, (tx) =>
    tx.policyConfig.findFirst({
      where: {
        tenantId,
        brandId: null,
        productId: null,
        policyKey: REPLAY_ALERT_POLICY_KEY,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    }),
  );

  const raw = row?.policyValue as unknown;
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : typeof raw === 'object' && raw !== null && 'value' in (raw as Record<string, unknown>)
          ? Number((raw as Record<string, unknown>).value)
          : Number.NaN;
  const threshold =
    Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_REPLAY_ALERT_THRESHOLD;

  return c.json({
    tenantId,
    threshold,
    source: row ? 'TENANT' : 'DEFAULT',
    updatedAt: row?.updatedAt ?? null,
  });
});

app.put('/security/audit/replay/settings', async (c) => {
  const body = (await c.req.json()) as {
    tenantId?: string;
    threshold?: number;
  };
  const tenantId = body.tenantId;
  const threshold =
    typeof body.threshold === 'number'
      ? Math.round(body.threshold)
      : Number.NaN;
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 10000) {
    return c.json({ error: 'threshold must be an integer between 1 and 10000' }, 400);
  }

  const now = new Date();
  const row = await withTenant(tenantId, async (tx) => {
    const existing = await tx.policyConfig.findFirst({
      where: {
        tenantId,
        brandId: null,
        productId: null,
        policyKey: REPLAY_ALERT_POLICY_KEY,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (existing) {
      return tx.policyConfig.update({
        where: { id: existing.id },
        data: { policyValue: { value: threshold } },
      });
    }
    return tx.policyConfig.create({
      data: {
        tenantId,
        brandId: null,
        productId: null,
        policyKey: REPLAY_ALERT_POLICY_KEY,
        policyValue: { value: threshold },
        effectiveFrom: now,
      },
    });
  });

  await logSecurityEvent({
    tenantId,
    eventType: 'REPLAY_ALERT_THRESHOLD_UPDATED',
    severity: 'INFO',
    details: { threshold },
  });

  return c.json({
    tenantId,
    threshold,
    source: 'TENANT',
    updatedAt: row.updatedAt,
  });
});

app.post('/rules/preview', async (c) => {
  const body = (await c.req.json()) as {
    tenantId: string;
    rules: Array<{
      id: string;
      domain: 'ads' | 'inventory' | 'pricing' | 'seasonality' | 'risk';
      metric: string;
      operator: '<' | '<=' | '>' | '>=' | '=' | 'between';
      value: number | [number, number];
      action: string;
      priority: number;
      sourceText: string;
      confidence: number;
    }>;
  };

  if (!body.tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  const preview = await withTenant(body.tenantId, (tx) =>
    estimateRuleImpact(tx, body.tenantId, body.rules ?? []),
  );
  return c.json({ preview });
});

app.post('/rules/compile-intents', async (c) => {
  const body = (await c.req.json()) as {
    tenantId: string;
    target: { type: 'listing' | 'campaign' | 'commodity' | 'product'; id: string };
    ruleText?: string;
    ast?: RuleDslAst;
    context?: { brandId?: string; productId?: string };
    runtimeFacts?: Record<string, string | number | boolean | null>;
    execute?: boolean;
  };

  if (!body.tenantId || !body.target?.id || !body.target?.type) {
    return c.json({ error: 'tenantId and target(type/id) are required' }, 400);
  }
  if (!body.ruleText && !body.ast) {
    return c.json({ error: 'ruleText or ast is required' }, 400);
  }
  const runtimeFactsValidation = validateRuntimeFacts(body.runtimeFacts);
  if (!runtimeFactsValidation.valid) {
    return c.json(
      {
        error: 'invalid runtimeFacts',
        details: runtimeFactsValidation.errors,
      },
      400,
    );
  }

  const parse = body.ast
    ? {
      ast: body.ast,
      rules: parseNaturalLanguageRules(
        body.ruleText ?? body.ast.rules.map((rule) => rule.sourceText).join('。'),
      ).rules,
    }
    : parseNaturalLanguageRules(body.ruleText ?? '');

  const policy = await withTenant(body.tenantId, (tx) =>
    resolveParams(tx, {
      tenantId: body.tenantId,
      brandId: body.context?.brandId ?? null,
      productId: body.context?.productId ?? null,
    }),
  );

  const compiled = compileAstToIntents(
    {
      tenantId: body.tenantId,
      ast: parse.ast,
      target: body.target,
      context: body.context,
      runtimeFacts: body.runtimeFacts,
    },
    policy,
  );

  const approved = compiled
    .filter((item) => item.decision.approved && item.condition.matched)
    .map((item) => item.intent);
  const rejected = compiled
    .filter((item) => !item.decision.approved || !item.condition.matched)
    .map((item) => ({
      intentId: item.intent.intentId,
      action: item.intent.action,
      violations: item.decision.violations,
      conditionMatched: item.condition.matched,
      missingFields: item.condition.missingFields,
    }));

  const queuedJobs: Array<{ intentId: string; jobId: string }> = [];
  if (body.execute) {
    for (const intent of approved) {
      const jobId = await enqueueAdsRun({ tenantId: body.tenantId, intent });
      queuedJobs.push({ intentId: intent.intentId, jobId });
    }
  }

  const decisionTokenJtis = compiled
    .filter((item) => item.decision.approved && item.condition.matched)
    .map(() => crypto.randomUUID());

  if (decisionTokenJtis.length > 0) {
    await withTenant(body.tenantId, (tx) =>
      tx.requestNonce.createMany({
        data: decisionTokenJtis.map((jti) => ({
          tenantId: body.tenantId,
          nonce: `decision_${jti}`,
        })),
        skipDuplicates: true,
      }),
    );
  }

  return c.json({
    ast: parse.ast,
    intents: compiled.map((item) => {
      const approvedAndMatched = item.decision.approved && item.condition.matched;
      const jti = approvedAndMatched ? decisionTokenJtis.shift() ?? crypto.randomUUID() : null;
      return {
        intent: item.intent,
        decision: item.decision,
        condition: item.condition,
        decisionToken: approvedAndMatched && jti
          ? signDecisionToken({
            tenantId: body.tenantId,
            intent: item.intent,
            origin: env.TRUSTED_INTENT_ORIGIN,
            exp: Math.floor(Date.now() / 1000) + env.DECISION_TOKEN_TTL_SECONDS,
            jti,
          })
          : null,
      };
    }),
    summary: {
      total: compiled.length,
      approved: approved.length,
      rejected: rejected.length,
      queued: queuedJobs.length,
    },
    rejected,
    queuedJobs,
  });
});

app.get('/rulesets', async (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  const items = await withTenant(tenantId, (tx) =>
    tx.ruleSet.findMany({
      where: { tenantId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  );

  return c.json({ items });
});

app.get('/rulesets/:id', async (c) => {
  const id = c.req.param('id');
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }
  const item = await withTenant(tenantId, (tx) =>
    tx.ruleSet.findFirst({
      where: { id, tenantId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 50,
        },
      },
    }),
  );
  if (!item) {
    return c.json({ error: 'ruleset not found' }, 404);
  }
  return c.json({ item });
});

async function persistRuleDiagnostics(params: {
  tenantId: string;
  ruleSetId: string;
  ruleVersionId: string;
  conflicts: ReturnType<typeof detectRuleConflicts>;
  suggestions: Awaited<ReturnType<typeof generateRuleSuggestions>>;
}): Promise<void> {
  const { tenantId, ruleSetId, ruleVersionId, conflicts, suggestions } = params;
  await prisma.ruleConflictRecord.deleteMany({
    where: {
      tenantId,
      ruleSetId,
      ruleVersionId,
    },
  });

  await prisma.ruleSuggestionRecord.deleteMany({
    where: {
      tenantId,
      ruleSetId,
      ruleVersionId,
    },
  });

  if (conflicts.length > 0) {
    await prisma.ruleConflictRecord.createMany({
      data: conflicts.map((conflict) => ({
        tenantId,
        ruleSetId,
        ruleVersionId,
        conflictType: conflict.type,
        severity: conflict.severity,
        title: conflict.title,
        detail: conflict.detail,
        payload: conflict as never,
      })),
    });
  }

  if (suggestions.length > 0) {
    await prisma.ruleSuggestionRecord.createMany({
      data: suggestions.map((suggestion) => ({
        tenantId,
        ruleSetId,
        ruleVersionId,
        suggestionType: suggestion.suggestionType,
        title: suggestion.title,
        detail: suggestion.detail,
        rationale: suggestion.rationale as never,
      })),
    });
  }
}

app.post('/rulesets', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const body = (await c.req.json()) as {
    tenantId: string;
    name: string;
    description?: string;
    language?: string;
    createdBy: string;
    changeSummary?: string;
    ruleText: string;
    status?: RuleSetStatus;
  };

  if (!body.tenantId || !body.name || !body.createdBy || !body.ruleText) {
    return c.json({ error: 'tenantId, name, createdBy and ruleText are required' }, 400);
  }

  const parse = parseNaturalLanguageRules(body.ruleText);
  const conflicts = detectRuleConflicts(parse.rules);
  const suggestions = await withTenant(body.tenantId, (tx) =>
    generateRuleSuggestions(tx, body.tenantId, parse.rules),
  );

  const created = await withTenant(body.tenantId, async (tx) => {
    const ruleSet = await tx.ruleSet.create({
      data: {
        tenantId: body.tenantId,
        name: body.name,
        description: body.description,
        language: body.language ?? 'zh-CN',
        status: body.status ?? 'DRAFT',
        createdBy: body.createdBy,
      },
    });

    const version = await tx.ruleVersion.create({
      data: {
        ruleSetId: ruleSet.id,
        version: 1,
        changeSummary: body.changeSummary ?? 'Initial version',
        createdBy: body.createdBy,
        rules: {
          ruleText: body.ruleText,
          ast: parse.ast,
          parsed: parse.rules,
          unparsedSegments: parse.unparsedSegments,
        } as never,
        conflicts: conflicts as never,
        suggestions: suggestions as never,
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    await tx.ruleSet.update({
      where: { id: ruleSet.id },
      data: { activeVersion: version.version },
    });

    return { ruleSet, version };
  });

  await persistRuleDiagnostics({
    tenantId: body.tenantId,
    ruleSetId: created.ruleSet.id,
    ruleVersionId: created.version.id,
    conflicts,
    suggestions,
  });

  return c.json({ item: created.ruleSet, version: created.version, conflicts, suggestions }, 201);
});

app.put('/rulesets/:id', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    tenantId: string;
    updatedBy: string;
    ruleText: string;
    changeSummary?: string;
    status?: RuleSetStatus;
    name?: string;
    description?: string;
  };

  if (!body.tenantId || !body.updatedBy || !body.ruleText) {
    return c.json({ error: 'tenantId, updatedBy and ruleText are required' }, 400);
  }
  const ruleSet = await withTenant(body.tenantId, (tx) =>
    tx.ruleSet.findFirst({ where: { id, tenantId: body.tenantId } }),
  );
  if (!ruleSet) {
    return c.json({ error: 'ruleset not found' }, 404);
  }

  const latestVersion = await withTenant(body.tenantId, (tx) =>
    tx.ruleVersion.findFirst({
      where: { ruleSetId: id },
      orderBy: { version: 'desc' },
    }),
  );
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const parse = parseNaturalLanguageRules(body.ruleText);
  const conflicts = detectRuleConflicts(parse.rules);
  const suggestions = await generateRuleSuggestions(prisma, body.tenantId, parse.rules);

  const version = await withTenant(body.tenantId, (tx) =>
    tx.ruleVersion.create({
      data: {
        ruleSetId: id,
        version: nextVersion,
        changeSummary: body.changeSummary ?? `Update v${nextVersion}`,
        createdBy: body.updatedBy,
        rules: {
          ruleText: body.ruleText,
          ast: parse.ast,
          parsed: parse.rules,
          unparsedSegments: parse.unparsedSegments,
        } as never,
        conflicts: conflicts as never,
        suggestions: suggestions as never,
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      },
    }),
  );

  const updatedRuleSet = await withTenant(body.tenantId, (tx) =>
    tx.ruleSet.update({
      where: { id: ruleSet.id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        status: body.status ?? undefined,
        activeVersion: version.version,
      },
    }),
  );

  await persistRuleDiagnostics({
    tenantId: body.tenantId,
    ruleSetId: id,
    ruleVersionId: version.id,
    conflicts,
    suggestions,
  });

  return c.json({ item: updatedRuleSet, version, conflicts, suggestions });
});

app.post('/rulesets/:id/rollback', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    tenantId: string;
    toVersion: number;
    updatedBy: string;
    changeSummary?: string;
  };

  if (!body.tenantId || !body.toVersion || !body.updatedBy) {
    return c.json({ error: 'tenantId, toVersion and updatedBy are required' }, 400);
  }

  const owner = await withTenant(body.tenantId, (tx) =>
    tx.ruleSet.findFirst({ where: { id, tenantId: body.tenantId } }),
  );
  if (!owner) {
    return c.json({ error: 'ruleset not found' }, 404);
  }

  const target = await withTenant(body.tenantId, (tx) =>
    tx.ruleVersion.findFirst({
      where: { ruleSetId: id, version: body.toVersion },
    }),
  );
  if (!target) {
    return c.json({ error: 'target version not found' }, 404);
  }

  const latestVersion = await withTenant(body.tenantId, (tx) =>
    tx.ruleVersion.findFirst({
      where: { ruleSetId: id },
      orderBy: { version: 'desc' },
    }),
  );
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const version = await withTenant(body.tenantId, (tx) =>
    tx.ruleVersion.create({
      data: {
        ruleSetId: id,
        version: nextVersion,
        changeSummary: body.changeSummary ?? `Rollback to v${body.toVersion}`,
        createdBy: body.updatedBy,
        rules: target.rules as never,
        conflicts: target.conflicts as never,
        suggestions: target.suggestions as never,
      },
    }),
  );

  const item = await withTenant(body.tenantId, (tx) =>
    tx.ruleSet.update({
      where: { id: owner.id },
      data: { activeVersion: version.version },
    }),
  );

  return c.json({ item, version });
});

app.get('/events/approvals', (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'tenantId is required' }, 400);
  }

  return streamSSE(c, async (stream) => {
    const onCreated = (event: ApprovalEvent) => {
      if (tenantId && event.tenantId !== tenantId) return;
      void stream.writeSSE({
        event: 'approval.created',
        data: JSON.stringify(event),
      });
    };

    approvalEvents.on('approval.created', onCreated);

    await stream.writeSSE({
      event: 'ready',
      data: JSON.stringify({ connectedAt: new Date().toISOString() }),
    });

    try {
      while (true) {
        await stream.sleep(15000);
        await stream.writeSSE({ event: 'ping', data: JSON.stringify({ ts: Date.now() }) });
      }
    } finally {
      approvalEvents.off('approval.created', onCreated);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Plan / Subscription endpoints
// ─────────────────────────────────────────────────────────────

const PLAN_QUOTAS_API = {
  starter:    { maxDailyOps: 100,     maxDailyBudget: 5_000 },
  pro:        { maxDailyOps: 1_000,   maxDailyBudget: 50_000 },
  enterprise: { maxDailyOps: 999_999, maxDailyBudget: 999_999_999 },
};

// GET /admin/tenants/plans  — system_admin: list all tenants with plan info
app.get('/admin/tenants/plans', requireRole('system_admin'), async (c) => {
  const rows = await adminQueryPool.query<{
    id: string; code: string; name: string; plan: string; status: string; "updatedAt": string;
  }>(`SELECT id, code, name, plan, status, "updatedAt" FROM "Tenant" ORDER BY name`);
  const tenants = rows.rows.map((t) => ({
    ...t,
    quotas: PLAN_QUOTAS_API[t.plan as keyof typeof PLAN_QUOTAS_API] ?? PLAN_QUOTAS_API.starter,
  }));
  return c.json({ tenants });
});

// PATCH /admin/tenants/:id/plan  — system_admin: change any tenant's plan
app.patch('/admin/tenants/:id/plan', requireRole('system_admin'), async (c) => {
  const id = c.req.param('id');
  const { plan } = await c.req.json<{ plan: string }>();
  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return c.json({ error: 'invalid plan' }, 400);
  }
  await adminQueryPool.query(
    `UPDATE "Tenant" SET plan = $1::\"TenantPlan\", "updatedAt" = now() WHERE id = $2`,
    [plan, id],
  );
  invalidateTenantCache(id);
  return c.json({ ok: true, id, plan });
});

// GET /subscription  — tenant_admin: view own plan + live quota usage
app.get('/subscription', requireRole('system_admin', 'tenant_admin'), async (c) => {
  const auth = c.get('auth');
  const tenantId = auth.tenantId;
  const row = await adminQueryPool.query<{ plan: string; name: string }>(
    `SELECT plan, name FROM "Tenant" WHERE id = $1`,
    [tenantId],
  );
  const plan = (row.rows[0]?.plan ?? 'starter') as keyof typeof PLAN_QUOTAS_API;
  const quotas = PLAN_QUOTAS_API[plan] ?? PLAN_QUOTAS_API.starter;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const usedOps = await prisma.agentExecutionLog.count({
    where: { tenantId, createdAt: { gte: todayStart } },
  });

  return c.json({
    tenantId,
    tenantName: row.rows[0]?.name ?? '',
    plan,
    quotas,
    usage: { dailyOps: usedOps, dailyBudget: 0 },
  });
});

// PATCH /subscription  — tenant_admin: self-service plan change
app.patch('/subscription', requireRole('tenant_admin'), async (c) => {
  const auth = c.get('auth');
  const tenantId = auth.tenantId;
  const { plan } = await c.req.json<{ plan: string }>();
  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return c.json({ error: 'invalid plan' }, 400);
  }
  await adminQueryPool.query(
    `UPDATE "Tenant" SET plan = $1::\"TenantPlan\", "updatedAt" = now() WHERE id = $2`,
    [plan, tenantId],
  );
  invalidateTenantCache(tenantId);
  return c.json({ ok: true, plan });
});

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  async () => {
    await startQueue();
    await startApprovalNotificationListener();
    startNonceCleanupScheduler();
    startSSEEventForwarding();
    registerMasterDataHandlers(new MdmIsolationHandler(prisma));
    startExchangeRateCron();
    console.log(`API listening on http://localhost:${env.PORT}`);
  },
);

let _exchangeRateCronDailyTimer: NodeJS.Timeout | null = null;
let _exchangeRateCronMonthlyTimer: NodeJS.Timeout | null = null;

function startExchangeRateCron(): void {
  const runDaily = async () => {
    try {
      const result = await syncExchangeRates();
      if (result.inserted > 0) {
        await purgeOldSnapshots();
      }
    } catch (err) {
      console.error('[exchange-rate-cron] daily error:', err);
    }
  };

  const runMonthly = async () => {
    try {
      const now = new Date();
      const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
      const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
      const count = await calculateMonthlyAvg(prevYear, prevMonth);
      console.log(`[exchange-rate-cron] monthly avg calculated: ${count} pairs for ${prevYear}-${String(prevMonth).padStart(2, '0')}`);
    } catch (err) {
      console.error('[exchange-rate-cron] monthly error:', err);
    }
  };

  const msUntil = (utcHour: number, utcMinute: number, dayOfMonth?: number): number => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(utcHour, utcMinute, 0, 0);
    if (dayOfMonth !== undefined) {
      next.setUTCDate(dayOfMonth);
      if (next.getUTCMonth() === now.getUTCMonth() && next <= now) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
    } else if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return Math.max(next.getTime() - now.getTime(), 0);
  };

  _exchangeRateCronDailyTimer = setTimeout(() => {
    void runDaily();
    _exchangeRateCronDailyTimer = setInterval(runDaily, 24 * 60 * 60 * 1000);
  }, msUntil(0, 5));

  _exchangeRateCronMonthlyTimer = setTimeout(() => {
    void runMonthly();
    _exchangeRateCronMonthlyTimer = setInterval(runMonthly, 30 * 24 * 60 * 60 * 1000);
  }, msUntil(0, 30, 2));

  console.log('[exchange-rate-cron] daily sync at 00:05 UTC, monthly avg on 2nd at 00:30 UTC');
}

async function shutdown(): Promise<void> {
  stopNonceCleanupScheduler();
  if (_exchangeRateCronDailyTimer) {
    clearTimeout(_exchangeRateCronDailyTimer);
    clearInterval(_exchangeRateCronDailyTimer);
    _exchangeRateCronDailyTimer = null;
  }
  if (_exchangeRateCronMonthlyTimer) {
    clearTimeout(_exchangeRateCronMonthlyTimer);
    clearInterval(_exchangeRateCronMonthlyTimer);
    _exchangeRateCronMonthlyTimer = null;
  }
  await stopQueue();
  await stopApprovalNotificationListener();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
// Build timestamp: Fri Feb 27 13:09:55 JST 2026
