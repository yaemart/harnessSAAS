import { Pool } from 'pg';
import { prisma } from './db.js';
import { env } from './env.js';
import { evaluatePolicy, PLAN_QUOTAS, type TenantPlan } from './opa-policy.js';

// Admin pool — bypasses RLS for internal system reads (tenant metadata)
const adminPool = new Pool({ connectionString: env.DATABASE_ADMIN_URL });

interface TenantLimits {
  maxDailyOps: number;
  maxDailyBudget: number;
  plan: TenantPlan;
}

const DEFAULT_PLAN: TenantPlan = 'starter';

const limitsCache = new Map<string, { limits: TenantLimits; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getTenantLimits(tenantId: string): Promise<TenantLimits> {
  const cached = limitsCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.limits;

  // 1. Read tenant plan from DB (admin pool — bypasses RLS for system metadata)
  const tenantRow = await adminPool.query<{ plan: string }>(
    `SELECT plan FROM "Tenant" WHERE id = $1`,
    [tenantId],
  );
  const plan: TenantPlan = (tenantRow.rows[0]?.plan as TenantPlan | undefined) ?? DEFAULT_PLAN;

  // 2. Derive plan defaults via OPA policy
  const planDefaults = PLAN_QUOTAS[plan];

  // 3. Read PolicyConfig overrides (highest priority)
  const now = new Date();
  const rows = await prisma.policyConfig.findMany({
    where: {
      tenantId,
      brandId: null,
      productId: null,
      policyKey: { in: ['maxDailyOps', 'maxDailyBudget'] },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const configMap = new Map<string, unknown>();
  for (const row of rows) {
    if (!configMap.has(row.policyKey)) {
      const raw = row.policyValue as unknown;
      const val =
        typeof raw === 'object' && raw !== null && 'value' in (raw as Record<string, unknown>)
          ? (raw as Record<string, unknown>).value
          : raw;
      configMap.set(row.policyKey, val);
    }
  }

  // 4. Merge: PolicyConfig overrides > plan defaults
  const limits: TenantLimits = {
    plan,
    maxDailyOps: configMap.has('maxDailyOps')
      ? Number(configMap.get('maxDailyOps'))
      : planDefaults.ai_op,
    maxDailyBudget: configMap.has('maxDailyBudget')
      ? Number(configMap.get('maxDailyBudget'))
      : planDefaults.budget_op,
  };

  limitsCache.set(tenantId, { limits, expiresAt: Date.now() + CACHE_TTL_MS });
  return limits;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  currentOps?: number;
  maxOps?: number;
  plan?: TenantPlan;
}

export async function checkRateLimit(tenantId: string): Promise<RateLimitResult> {
  const limits = await getTenantLimits(tenantId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dailyOps = await prisma.agentExecutionLog.count({
    where: {
      tenantId,
      createdAt: { gte: todayStart },
    },
  });

  // Delegate allow/deny decision to OPA policy engine
  const decision = evaluatePolicy({
    tenantId,
    plan: limits.plan,
    action: 'ai_op',
    currentCount: dailyOps,
    customLimit: limits.maxDailyOps,
  });

  if (!decision.allow) {
    return {
      allowed: false,
      reason: decision.reason,
      currentOps: dailyOps,
      maxOps: decision.limit,
      plan: limits.plan,
    };
  }

  return {
    allowed: true,
    currentOps: dailyOps,
    maxOps: decision.limit,
    plan: limits.plan,
  };
}

export function invalidateTenantCache(tenantId: string): void {
  limitsCache.delete(tenantId);
}
