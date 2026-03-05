import PgBoss from 'pg-boss';
import { Prisma, RiskLevel } from '@prisma/client';
import type { AgentIntent } from '@repo/shared-types';
import {
  AmazonAdsRealAdapter,
  MockAmazonAdsAdapter,
  MockWalmartAdsAdapter,
  PlatformAgentRegistry,
  type IPlatformAgent,
  type IPlatformAdsAdapter,
} from '@repo/platform-adapters';
import { env } from './env.js';
import { prisma } from './db.js';
import { resolveParams } from './policy.js';
import { loadActiveConstitution } from './constitution-engine.js';
import { ErrorCode, HarnessError, isRetryable } from './errors.js';
import { emitEvent } from './event-bus.js';
import { checkRateLimit } from './rate-limiter.js';
import { metrics } from './metrics.js';
import { createAuditEntry } from './audit-chain.js';
import { runDailyDecayJob } from './harness-decay-engine.js';
import { runDailyMaturityJob } from './harness-maturity-engine.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function buildAmazonAdapter(): IPlatformAdsAdapter {
  if (env.AMAZON_ADS_MODE === 'real') {
    const clientId = process.env.AMAZON_ADS_CLIENT_ID;
    const clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET;
    const refreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN;
    const profileId = process.env.AMAZON_ADS_PROFILE_ID;
    const apiBaseUrl = process.env.AMAZON_ADS_API_BASE_URL ?? 'https://advertising-api.amazon.com';

    if (!clientId || !clientSecret || !refreshToken || !profileId) {
      throw new Error(
        'AMAZON_ADS_MODE=real requires AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_REFRESH_TOKEN, AMAZON_ADS_PROFILE_ID',
      );
    }

    return new AmazonAdsRealAdapter({
      credentials: { clientId, clientSecret, refreshToken },
      profileId,
      apiBaseUrl,
      tokenUrl: process.env.AMAZON_ADS_TOKEN_URL,
      timeoutMs: Number(process.env.AMAZON_ADS_TIMEOUT_MS ?? 15000),
    });
  }

  return new MockAmazonAdsAdapter({ latencyMs: 500 });
}

function buildPlatformRegistry(): PlatformAgentRegistry {
  const registry = new PlatformAgentRegistry();
  const amazon: IPlatformAgent = {
    platform: 'amazon',
    ads: buildAmazonAdapter(),
  };
  const walmart: IPlatformAgent = {
    platform: 'walmart',
    ads: new MockWalmartAdsAdapter({ latencyMs: 450 }),
  };
  registry.register(amazon);
  registry.register(walmart);
  return registry;
}

const platformRegistry = buildPlatformRegistry();

interface AdsJobPayload {
  tenantId: string;
  intent: AgentIntent;
}

let boss: PgBoss | null = null;

async function withTenant<T>(tenantId: string, fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as typeof prisma);
  });
}

interface PreloadedContext {
  performance: Record<string, unknown> | null;
  listing: Record<string, unknown> | null;
  policy: Record<string, unknown>;
  constitution: Record<string, unknown>;
  experienceCount: number;
}

async function preloadAgentContext(
  tenantId: string,
  listingId: string,
  brandId?: string,
  productId?: string,
): Promise<PreloadedContext> {
  return withTenant(tenantId, async (tx) => {
    const [performance, listing, policy, constitution, experienceCount] = await Promise.all([
      listingId
        ? tx.performanceSnapshot.findFirst({
            where: { listingId, tenantId },
            orderBy: { snapshotDate: 'desc' },
          })
        : Promise.resolve(null),
      listingId
        ? tx.listing.findFirst({
            where: { id: listingId, tenantId },
            select: {
              id: true,
              tenantId: true,
              commodityId: true,
              platformId: true,
              externalListingId: true,
              title: true,
              isPrimary: true,
              status: true,
            },
          })
        : Promise.resolve(null),
      resolveParams(tx, { tenantId, brandId: brandId ?? null, productId: productId ?? null }),
      loadActiveConstitution(tx, tenantId),
      tx.agentExperience.count({ where: { tenantId } }),
    ]);
    return {
      performance: performance as unknown as Record<string, unknown> | null,
      listing: listing as unknown as Record<string, unknown> | null,
      policy: policy as unknown as Record<string, unknown>,
      constitution: constitution as unknown as Record<string, unknown>,
      experienceCount,
    };
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRiskLevel(score: number): RiskLevel {
  if (score >= 0.9) return 'CRITICAL';
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  return 'LOW';
}

function resolveCircuitTarget(intent: AgentIntent): string {
  const payload = intent.payload as Record<string, unknown>;
  if (typeof payload.productId === 'string' && payload.productId.length > 0) {
    return payload.productId;
  }
  return intent.target.id;
}

async function isCircuitOpen(tenantId: string, targetKey: string): Promise<boolean> {
  const rows = await prisma.agentExecutionLog.findMany({
    where: { tenantId, targetKey },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { status: true },
  });

  if (rows.length < 3) return false;
  return rows.every((row) => ['FAILED', 'REPORT_TIMEOUT', 'CIRCUIT_OPEN'].includes(row.status));
}

async function writeCircuitOpenLog(payload: AdsJobPayload, targetKey: string): Promise<void> {
  await prisma.agentExecutionLog.upsert({
    where: { intentId: payload.intent.intentId },
    create: {
      tenantId: payload.tenantId,
      intentId: payload.intent.intentId,
      domain: payload.intent.domain,
      action: payload.intent.action,
      targetKey,
      riskLevel: 'HIGH',
      reasoningChain: {
        summary: 'circuit breaker open',
        targetKey,
        intentSnapshot: payload.intent,
      } as unknown as Prisma.JsonObject,
      policySnapshotId: payload.intent.policySnapshotId ?? null,
      status: 'CIRCUIT_OPEN',
      startedAt: new Date(),
      finishedAt: new Date(),
    },
    update: {
      status: 'CIRCUIT_OPEN',
      finishedAt: new Date(),
    },
  });
}

async function writeExecutionReceipt(
  executionLogId: string,
  payload: AdsJobPayload,
  targetKey: string,
  platformCode: string,
  status: string,
  executionMeta: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.executionReceipt.create({
      data: {
        tenantId: payload.tenantId,
        executionLogId,
        intentId: payload.intent.intentId,
        platform: platformCode,
        executionId: String(executionMeta.runId ?? executionMeta.reportId ?? targetKey),
        status: ['COMPLETED', 'RESUMED_COMPLETED'].includes(status) ? 'SUCCESS' : 'FAILED',
        rollbackSupported: false,
        rawResponse: executionMeta as unknown as Prisma.JsonObject,
      },
    });
  } catch (err) {
    console.error('Failed to write ExecutionReceipt', err);
  }
}

async function writeExperienceAsync(
  payload: AdsJobPayload,
  platformCode: string,
  status: string,
  executionMeta: Record<string, unknown>,
): Promise<void> {
  try {
    const reasoning = (payload.intent.reasoning as unknown as Record<string, unknown>) ?? {};
    const scope = payload.intent.scope ?? {};
    const intentPayload = payload.intent.payload as Record<string, unknown> | undefined;

    await prisma.agentExperience.create({
      data: {
        tenantId: payload.tenantId,
        traceId: payload.intent.intentId,
        intentType: payload.intent.action,
        intentDomain: payload.intent.domain,
        platform: platformCode || 'unknown',
        market: String(scope.market ?? 'unknown'),
        categoryId: String(intentPayload?.categoryId ?? scope.category ?? '') || null,
        observeSnapshot: (reasoning.observe ?? {}) as Prisma.JsonObject,
        orientAnalysis: (reasoning.orient ?? {}) as Prisma.JsonObject,
        decideRationale: (reasoning.decide ?? {}) as Prisma.JsonObject,
        actIntent: {
          intentId: payload.intent.intentId,
          domain: payload.intent.domain,
          action: payload.intent.action,
          target: payload.intent.target as unknown as Prisma.JsonObject,
        } as Prisma.JsonObject,
        executionStatus: status,
        executionReceipt: executionMeta as unknown as Prisma.JsonObject,
      },
    });
  } catch (err) {
    console.error('Failed to write AgentExperience', err);
  }
}

async function executeWithRetry(
  payload: AdsJobPayload,
  attempt: number = 0,
): Promise<void> {
  try {
    await handleAdsJob(payload);
  } catch (err) {
    const error = err instanceof HarnessError ? err : new HarnessError(ErrorCode.UNKNOWN, String(err));

    if (isRetryable(error.code) && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[retry] intent=${payload.intent.intentId} attempt=${attempt + 1}/${MAX_RETRIES} delay=${delay}ms code=${error.code}`,
      );
      metrics.recordAgentExecution(payload.tenantId, 'retry');
      emitEvent('intent.retry', payload.tenantId, {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        errorCode: error.code,
        delay,
      }, payload.intent.intentId);
      await sleep(delay);
      return executeWithRetry(payload, attempt + 1);
    }

    metrics.recordAgentExecution(payload.tenantId, 'failed');
    emitEvent('intent.failed', payload.tenantId, {
      errorCode: error.code,
      message: error.message,
      attempts: attempt + 1,
    }, payload.intent.intentId);

    createAuditEntry(payload.tenantId, 'intent.failed', {
      intentId: payload.intent.intentId,
      errorCode: error.code,
      attempts: attempt + 1,
    });

    throw error;
  }
}

async function handleAdsJob(payload: AdsJobPayload): Promise<void> {
  const startedAt = new Date();

  const rateLimitResult = await checkRateLimit(payload.tenantId);
  if (!rateLimitResult.allowed) {
    emitEvent('rate_limit.exceeded', payload.tenantId, {
      reason: rateLimitResult.reason,
      currentOps: rateLimitResult.currentOps,
      maxOps: rateLimitResult.maxOps,
    }, payload.intent.intentId);
    throw new HarnessError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      rateLimitResult.reason ?? 'rate limit exceeded',
    );
  }

  const riskScore = Number(payload.intent.risk?.score ?? 0);
  const resumeApproved = Boolean((payload.intent.payload as Record<string, unknown> | undefined)?.resumeApproved);
  let riskLevel = resolveRiskLevel(riskScore);
  const targetKey = resolveCircuitTarget(payload.intent);
  const platformCode = String(payload.intent.scope?.platform ?? '').toLowerCase();
  const platformAgent = platformRegistry.get(platformCode);

  if (!resumeApproved && (await isCircuitOpen(payload.tenantId, targetKey))) {
    await writeCircuitOpenLog(payload, targetKey);
    console.warn(`Circuit open for target ${targetKey}, skipped intent ${payload.intent.intentId}`);
    return;
  }

  if (riskScore >= 0.7 && !resumeApproved) {
    await prisma.$transaction([
      prisma.approvalQueue.upsert({
        where: { intentId: payload.intent.intentId },
        create: {
          tenantId: payload.tenantId,
          intentId: payload.intent.intentId,
          domain: payload.intent.domain,
          action: payload.intent.action,
          riskScore: new Prisma.Decimal(riskScore),
          reason: payload.intent.reasoning.summary,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {
          status: 'PENDING',
          riskScore: new Prisma.Decimal(riskScore),
          reason: payload.intent.reasoning.summary,
        },
      }),
      prisma.agentExecutionLog.upsert({
        where: { intentId: payload.intent.intentId },
        create: {
          tenantId: payload.tenantId,
          intentId: payload.intent.intentId,
          domain: payload.intent.domain,
          action: payload.intent.action,
          targetKey,
          riskLevel,
          reasoningChain: {
            ...payload.intent.reasoning,
            targetKey,
            intentSnapshot: payload.intent,
          } as unknown as Prisma.JsonObject,
          policySnapshotId: payload.intent.policySnapshotId ?? null,
          status: 'AWAITING_APPROVAL',
          startedAt,
          finishedAt: new Date(),
        },
        update: {
          riskLevel,
          reasoningChain: {
            ...payload.intent.reasoning,
            intentSnapshot: payload.intent,
          } as unknown as Prisma.JsonObject,
          policySnapshotId: payload.intent.policySnapshotId ?? null,
          status: 'AWAITING_APPROVAL',
          finishedAt: new Date(),
        },
      }),
    ]);

    return;
  }

  let status = resumeApproved ? 'RESUMED_COMPLETED' : 'COMPLETED';
  let executionMeta: Record<string, unknown> = {};
  try {
    if (!platformAgent) {
      status = 'FAILED';
      executionMeta = {
        runtime: env.ADS_AGENT_RUNTIME,
        error: 'PLATFORM_NOT_REGISTERED',
        platform: platformCode,
        supportedPlatforms: platformRegistry.platforms(),
      };
      throw new Error(`platform not registered: ${platformCode}`);
    }
    if (env.ADS_AGENT_RUNTIME === 'python') {
      const listingId = payload.intent.target?.id ?? '';
      const intentPayload = payload.intent.payload as Record<string, unknown>;
      const preloaded = await preloadAgentContext(
        payload.tenantId,
        listingId,
        intentPayload.brandId as string | undefined,
        intentPayload.productId as string | undefined,
      );
      const response = await fetch(`${env.AGENT_SERVICE_URL}/run/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: payload.tenantId,
          intent: payload.intent,
          preloaded: {
            performance: preloaded.performance,
            listing: preloaded.listing,
            policy: preloaded.policy,
            constitution: preloaded.constitution,
            experienceCount: preloaded.experienceCount,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`agent-py dispatch failed with status ${response.status}`);
      }
      const responseBody = (await response.json()) as {
        status: string;
        runId: string;
        outcome?: Record<string, unknown>;
      };
      const outcome = responseBody.outcome ?? {};
      const outcomeStatus =
        typeof outcome.status === 'string'
          ? outcome.status
          : typeof responseBody.status === 'string'
            ? responseBody.status
            : 'COMPLETED';
      status = outcomeStatus;
      if (outcome.risk && typeof outcome.risk === 'object') {
        const score = Number((outcome.risk as Record<string, unknown>).score);
        if (!Number.isNaN(score)) {
          riskLevel = resolveRiskLevel(score);
        }
      }
      executionMeta = {
        runtime: 'python',
        platform: platformCode,
        runId: responseBody.runId,
        outcome,
      };
      if (status === 'AWAITING_APPROVAL' && !resumeApproved) {
        await prisma.approvalQueue.upsert({
          where: { intentId: payload.intent.intentId },
          create: {
            tenantId: payload.tenantId,
            intentId: payload.intent.intentId,
            domain: payload.intent.domain,
            action: payload.intent.action,
            riskScore: new Prisma.Decimal(Math.max(riskScore, 0.7)),
            reason: payload.intent.reasoning.summary,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          update: {
            status: 'PENDING',
            riskScore: new Prisma.Decimal(Math.max(riskScore, 0.7)),
            reason: payload.intent.reasoning.summary,
          },
        });
      }
    } else {
      if (Boolean((payload.intent.payload as Record<string, unknown> | undefined)?.forceFailure)) {
        throw new Error('forced failure for circuit-breaker test');
      }

      const adapter = platformAgent.ads;
      const report = await adapter.requestPerformanceReport({
        listingId: payload.intent.target.id,
        commodityId: String(payload.intent.payload.commodityId ?? ''),
        startDate: String(payload.intent.payload.startDate ?? new Date().toISOString().slice(0, 10)),
        endDate: String(payload.intent.payload.endDate ?? new Date().toISOString().slice(0, 10)),
      });

      let reportResult = report;
      for (let i = 0; i < 5; i += 1) {
        if (reportResult.status === 'COMPLETED') break;
        await sleep(300);
        reportResult = await adapter.getPerformanceReport(report.reportId);
      }

      executionMeta = {
        runtime: 'node',
        platform: platformCode,
        reportId: report.reportId,
        reportStatus: reportResult.status,
      };
      if (reportResult.status !== 'COMPLETED') {
        status = 'REPORT_TIMEOUT';
      }
    }
  } catch (execErr) {
    status = 'FAILED';
    executionMeta = {
      ...executionMeta,
      error: execErr instanceof Error ? execErr.message : String(execErr),
    };

    const executionLog = await prisma.agentExecutionLog.upsert({
      where: { intentId: payload.intent.intentId },
      create: {
        tenantId: payload.tenantId,
        intentId: payload.intent.intentId,
        domain: payload.intent.domain,
        action: payload.intent.action,
        targetKey,
        riskLevel,
        reasoningChain: {
          ...payload.intent.reasoning,
          targetKey,
          intentSnapshot: payload.intent,
          executionMeta,
        } as unknown as Prisma.JsonObject,
        policySnapshotId: payload.intent.policySnapshotId ?? null,
        status,
        startedAt,
        finishedAt: new Date(),
      },
      update: {
        riskLevel,
        reasoningChain: {
          ...payload.intent.reasoning,
          targetKey,
          intentSnapshot: payload.intent,
          executionMeta,
        } as unknown as Prisma.JsonObject,
        policySnapshotId: payload.intent.policySnapshotId ?? null,
        status,
        finishedAt: new Date(),
      },
    });

    void writeExecutionReceipt(executionLog.id, payload, targetKey, platformCode, status, executionMeta);
    void writeExperienceAsync(payload, platformCode, status, executionMeta);

    if (execErr instanceof HarnessError) throw execErr;
    throw new HarnessError(ErrorCode.UNKNOWN, execErr instanceof Error ? execErr.message : String(execErr));
  }

  const executionLog = await prisma.agentExecutionLog.upsert({
    where: { intentId: payload.intent.intentId },
    create: {
      tenantId: payload.tenantId,
      intentId: payload.intent.intentId,
      domain: payload.intent.domain,
      action: payload.intent.action,
      targetKey,
      riskLevel,
      reasoningChain: {
        ...payload.intent.reasoning,
        targetKey,
        intentSnapshot: payload.intent,
        executionMeta,
      } as unknown as Prisma.JsonObject,
      policySnapshotId: payload.intent.policySnapshotId ?? null,
      status,
      startedAt,
      finishedAt: new Date(),
    },
    update: {
      riskLevel,
      reasoningChain: {
        ...payload.intent.reasoning,
        targetKey,
        intentSnapshot: payload.intent,
        executionMeta,
      } as unknown as Prisma.JsonObject,
      policySnapshotId: payload.intent.policySnapshotId ?? null,
      status,
      finishedAt: new Date(),
    },
  });

  void writeExecutionReceipt(executionLog.id, payload, targetKey, platformCode, status, executionMeta);
  void writeExperienceAsync(payload, platformCode, status, executionMeta);

  if (['COMPLETED', 'RESUMED_COMPLETED'].includes(status)) {
    metrics.recordAgentExecution(payload.tenantId, 'completed');
    emitEvent('intent.completed', payload.tenantId, {
      status,
      platform: platformCode,
      durationMs: Date.now() - startedAt.getTime(),
    }, payload.intent.intentId);
    createAuditEntry(payload.tenantId, 'intent.completed', {
      intentId: payload.intent.intentId,
      status,
      platform: platformCode,
    });
  } else if (['FAILED', 'REPORT_TIMEOUT'].includes(status)) {
    metrics.recordAgentExecution(payload.tenantId, 'failed');
    emitEvent('intent.failed', payload.tenantId, {
      status,
      platform: platformCode,
    }, payload.intent.intentId);
  }
}

export async function startQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  const queue = new PgBoss({ connectionString: env.DATABASE_URL });
  queue.on('error', (error) => {
    console.error('pg-boss error', error);
  });
  await queue.start();
  await queue.createQueue('ads-agent:run');
  await queue.work<AdsJobPayload>('ads-agent:run', async (jobs) => {
    const list = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of list) {
      await executeWithRetry(job.data);
    }
  });

  await queue.createQueue('harness:decay:daily');
  await queue.schedule('harness:decay:daily', '0 3 * * *', {}, { retryLimit: 1 });
  await queue.work('harness:decay:daily', async () => {
    await runDailyDecayJob();
  });

  await queue.createQueue('harness:maturity:daily');
  await queue.schedule('harness:maturity:daily', '0 2 * * *', {}, { retryLimit: 1 });
  await queue.work('harness:maturity:daily', async () => {
    await runDailyMaturityJob();
  });

  boss = queue;
  return queue;
}

export async function stopQueue(): Promise<void> {
  if (!boss) return;
  await boss.stop({ timeout: 5000 });
  boss = null;
}

export async function enqueueAdsRun(payload: AdsJobPayload): Promise<string> {
  const queue = await startQueue();
  const jobId = await queue.send('ads-agent:run', payload);
  if (!jobId) {
    throw new Error('Failed to enqueue ads-agent:run job');
  }
  return jobId;
}
