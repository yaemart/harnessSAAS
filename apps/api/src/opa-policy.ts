/**
 * OPA-style Policy Engine (TypeScript)
 *
 * Follows OPA's Input → Policy → Decision pattern:
 *   Input  : { tenantId, plan, action, currentCount }
 *   Policy : PLAN_QUOTAS[plan][action]
 *   Decision: { allow, reason, limit, plan }
 *
 * PolicyConfig overrides take precedence over plan defaults.
 */

export type TenantPlan = 'starter' | 'pro' | 'enterprise';

export interface OpaInput {
  tenantId: string;
  plan: TenantPlan;
  action: 'ai_op' | 'budget_op';
  currentCount: number;
  customLimit?: number;
}

export interface OpaDecision {
  allow: boolean;
  reason?: string;
  limit: number;
  plan: TenantPlan;
}

interface PlanQuota {
  ai_op: number;
  budget_op: number;
}

export const PLAN_QUOTAS: Record<TenantPlan, PlanQuota> = {
  starter: {
    ai_op: 100,
    budget_op: 5_000,
  },
  pro: {
    ai_op: 1_000,
    budget_op: 50_000,
  },
  enterprise: {
    ai_op: 999_999,
    budget_op: 999_999_999,
  },
};

/**
 * Evaluate OPA policy.
 *
 * Priority:
 *   1. customLimit (from PolicyConfig DB override) — highest
 *   2. PLAN_QUOTAS[plan][action]                  — default
 */
export function evaluatePolicy(input: OpaInput): OpaDecision {
  const planDefault = PLAN_QUOTAS[input.plan][input.action];
  const effectiveLimit = input.customLimit ?? planDefault;

  if (input.currentCount >= effectiveLimit) {
    const source = input.customLimit !== undefined ? 'custom policy' : `plan:${input.plan}`;
    return {
      allow: false,
      reason: `${input.action} limit reached (${input.currentCount}/${effectiveLimit}) [${source}]`,
      limit: effectiveLimit,
      plan: input.plan,
    };
  }

  return {
    allow: true,
    limit: effectiveLimit,
    plan: input.plan,
  };
}
