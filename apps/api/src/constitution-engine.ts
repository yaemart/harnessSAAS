import type { Prisma, PrismaClient } from '@prisma/client';
import type { AgentIntent } from '@repo/shared-types';
import type { ResolvedPolicy } from './policy.js';

export const CONSTITUTION_POLICY_KEY = 'constitutionRules';
export type ConstitutionDbClient = PrismaClient | Prisma.TransactionClient;

type RuleLevel = 'HARD' | 'STRUCTURAL';
type RuleKind =
  | 'ALLOWED_ACTIONS'
  | 'MAX_BID_CHANGE_PCT'
  | 'MIN_BID_GUARD';

export interface RuleScope {
  platforms?: string[];
  markets?: string[];
  categories?: string[];
  lifecycleStages?: string[];
}

interface ConstitutionRuleBase {
  id: string;
  title: string;
  level: RuleLevel;
  enabled: boolean;
  kind: RuleKind;
  scope?: RuleScope;
}

interface AllowedActionsRule extends ConstitutionRuleBase {
  kind: 'ALLOWED_ACTIONS';
  params: { actions: string[] };
}

interface MaxBidChangePctRule extends ConstitutionRuleBase {
  kind: 'MAX_BID_CHANGE_PCT';
  params: { maxPct: number };
}

interface MinBidGuardRule extends ConstitutionRuleBase {
  kind: 'MIN_BID_GUARD';
  params: Record<string, never>;
}

export type ConstitutionRule =
  | AllowedActionsRule
  | MaxBidChangePctRule
  | MinBidGuardRule;

export interface ConstitutionManifest {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeSummary: string;
  rules: ConstitutionRule[];
}

export interface ConstitutionDecision {
  pass: boolean;
  hardViolations: string[];
  structuralViolations: string[];
  requiresApproval: boolean;
}

const DEFAULT_RULES: ConstitutionRule[] = [
  {
    id: 'hard-allowed-actions',
    title: 'Action allowlist',
    level: 'HARD',
    enabled: true,
    kind: 'ALLOWED_ACTIONS',
    params: {
      actions: [
        'AdjustBid',
        'INCREASE_BID',
        'DECREASE_BID',
        'KEEP_OR_REDUCE_BID',
        'PAUSE_ADS',
        'RESUME_ADS',
        'OVERRIDE_INVENTORY_GUARD',
        'RELAX_CONSTRAINTS',
        'ENABLE_CONSERVATIVE_MODE',
      ],
    },
  },
  {
    id: 'struct-max-bid-change',
    title: 'Max bid change guard',
    level: 'STRUCTURAL',
    enabled: true,
    kind: 'MAX_BID_CHANGE_PCT',
    params: { maxPct: 30 },
  },
  {
    id: 'hard-min-bid-guard',
    title: 'Never below min bid',
    level: 'HARD',
    enabled: true,
    kind: 'MIN_BID_GUARD',
    params: {},
  },
];

export function defaultConstitutionManifest(now = new Date()): ConstitutionManifest {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    updatedBy: 'system',
    changeSummary: 'default constitution bootstrap',
    rules: DEFAULT_RULES,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractBidDeltaPct(intent: AgentIntent): number | null {
  const payload = intent.payload as Record<string, unknown>;
  return toNumber(payload.bidDeltaPct ?? payload.deltaPct ?? payload.percent);
}

function ruleScopeMatches(scope: RuleScope | undefined, intent: AgentIntent): boolean {
  if (!scope) return true;
  const intentScope = intent.scope;
  if (scope.platforms?.length && !scope.platforms.includes(intentScope?.platform ?? '')) {
    return false;
  }
  if (scope.markets?.length && !scope.markets.includes(intentScope?.market ?? '')) {
    return false;
  }
  if (scope.categories?.length) {
    const cat = intentScope?.category ?? (intent.payload as Record<string, unknown>).categoryId;
    if (!cat || !scope.categories.includes(String(cat))) return false;
  }
  if (scope.lifecycleStages?.length) {
    const lifecycle = (intent.payload as Record<string, unknown>).lifecycleStage;
    if (!lifecycle || !scope.lifecycleStages.includes(String(lifecycle))) return false;
  }
  return true;
}

function evaluateRule(rule: ConstitutionRule, intent: AgentIntent): string | null {
  if (!rule.enabled) return null;
  if (!ruleScopeMatches(rule.scope, intent)) return null;

  if (rule.kind === 'ALLOWED_ACTIONS') {
    if (!rule.params.actions.includes(intent.action)) {
      return `${rule.id}:ACTION_NOT_ALLOWED:${intent.action}`;
    }
    return null;
  }

  if (rule.kind === 'MAX_BID_CHANGE_PCT') {
    const pct = extractBidDeltaPct(intent);
    if (pct === null) return null;
    if (Math.abs(pct) > Math.abs(rule.params.maxPct)) {
      return `${rule.id}:BID_CHANGE_EXCEEDS_LIMIT:${pct}>${rule.params.maxPct}`;
    }
    return null;
  }

  if (rule.kind === 'MIN_BID_GUARD') {
    const payload = intent.payload as Record<string, unknown>;
    const minBid = toNumber(payload.minBid);
    const currentBid = toNumber(payload.currentBid);
    const deltaPct = extractBidDeltaPct(intent);
    if (minBid === null || currentBid === null || deltaPct === null) return null;
    const proposedBid = currentBid * (1 + deltaPct / 100);
    if (proposedBid < minBid) {
      return `${rule.id}:PROPOSED_BID_BELOW_MIN:${proposedBid}<${minBid}`;
    }
    return null;
  }

  return null;
}

export function evaluateConstitution(
  manifest: ConstitutionManifest,
  input: {
    intent: AgentIntent;
    policy?: ResolvedPolicy;
    baseRequiresApproval?: boolean;
  },
): ConstitutionDecision {
  const hardViolations: string[] = [];
  const structuralViolations: string[] = [];

  for (const rule of manifest.rules) {
    const violation = evaluateRule(rule, input.intent);
    if (!violation) continue;
    if (rule.level === 'HARD') hardViolations.push(violation);
    else structuralViolations.push(violation);
  }

  return {
    pass: hardViolations.length === 0,
    hardViolations,
    structuralViolations,
    requiresApproval:
      hardViolations.length === 0 &&
      (Boolean(input.baseRequiresApproval) || structuralViolations.length > 0),
  };
}

function coerceManifest(value: unknown): ConstitutionManifest | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.rules)) return null;

  const rules: ConstitutionRule[] = [];
  for (const rawRule of obj.rules) {
    if (!rawRule || typeof rawRule !== 'object') return null;
    const rule = rawRule as Record<string, unknown>;
    const common = {
      id: String(rule.id ?? ''),
      title: String(rule.title ?? ''),
      level: rule.level === 'HARD' ? ('HARD' as const) : rule.level === 'STRUCTURAL' ? ('STRUCTURAL' as const) : null,
      enabled: Boolean(rule.enabled),
      kind: String(rule.kind ?? '') as RuleKind,
    };
    if (!common.id || !common.title || !common.level) return null;

    if (common.kind === 'ALLOWED_ACTIONS') {
      const actions = Array.isArray((rule.params as Record<string, unknown> | undefined)?.actions)
        ? ((rule.params as Record<string, unknown>).actions as unknown[])
          .filter((item) => typeof item === 'string')
          .map((item) => String(item))
        : [];
      rules.push({ ...common, kind: 'ALLOWED_ACTIONS', level: common.level, params: { actions } });
      continue;
    }

    if (common.kind === 'MAX_BID_CHANGE_PCT') {
      const maxPct = toNumber((rule.params as Record<string, unknown> | undefined)?.maxPct) ?? 30;
      rules.push({ ...common, kind: 'MAX_BID_CHANGE_PCT', level: common.level, params: { maxPct } });
      continue;
    }

    if (common.kind === 'MIN_BID_GUARD') {
      rules.push({ ...common, kind: 'MIN_BID_GUARD', level: common.level, params: {} });
      continue;
    }

    return null;
  }

  return {
    version: Math.max(1, Math.round(toNumber(obj.version) ?? 1)),
    updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
    updatedBy: String(obj.updatedBy ?? 'unknown'),
    changeSummary: String(obj.changeSummary ?? ''),
    rules,
  };
}

export async function loadActiveConstitution(
  prisma: ConstitutionDbClient,
  tenantId: string,
): Promise<ConstitutionManifest> {
  const now = new Date();
  const row = await prisma.policyConfig.findFirst({
    where: {
      tenantId,
      brandId: null,
      productId: null,
      policyKey: CONSTITUTION_POLICY_KEY,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const parsed = coerceManifest(row?.policyValue);
  if (parsed) return parsed;
  return defaultConstitutionManifest(now);
}

export async function loadConstitutionHistory(
  prisma: ConstitutionDbClient,
  tenantId: string,
  limit = 20,
): Promise<Array<{ version: number; updatedAt: string; updatedBy: string; changeSummary: string }>> {
  const rows = await prisma.policyConfig.findMany({
    where: {
      tenantId,
      brandId: null,
      productId: null,
      policyKey: CONSTITUTION_POLICY_KEY,
    },
    orderBy: { effectiveFrom: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows
    .map((row) => coerceManifest(row.policyValue))
    .filter((item): item is ConstitutionManifest => Boolean(item))
    .map((item) => ({
      version: item.version,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
      changeSummary: item.changeSummary,
    }));
}

export async function publishConstitution(
  prisma: ConstitutionDbClient,
  input: {
    tenantId: string;
    updatedBy: string;
    changeSummary: string;
    rules: ConstitutionRule[];
  },
): Promise<ConstitutionManifest> {
  const now = new Date();

  const operations = async (tx: Prisma.TransactionClient) => {
    const active = await loadActiveConstitution(tx, input.tenantId);
    const next: ConstitutionManifest = {
      version: active.version + 1,
      updatedAt: now.toISOString(),
      updatedBy: input.updatedBy,
      changeSummary: input.changeSummary,
      rules: input.rules,
    };

    await tx.policyConfig.updateMany({
      where: {
        tenantId: input.tenantId,
        brandId: null,
        productId: null,
        policyKey: CONSTITUTION_POLICY_KEY,
        effectiveTo: null,
      },
      data: {
        effectiveTo: now,
      },
    });

    await tx.policyConfig.create({
      data: {
        tenantId: input.tenantId,
        brandId: null,
        productId: null,
        policyKey: CONSTITUTION_POLICY_KEY,
        policyValue: next as unknown as Prisma.InputJsonValue,
        effectiveFrom: now,
      },
    });

    return next;
  };

  if ('$transaction' in prisma) {
    return prisma.$transaction(operations);
  }
  return operations(prisma);
}

export interface ConstitutionSuggestion {
  type: 'new_rule' | 'restrict_action';
  action: string;
  rejectCount: number;
  reason: string;
}

const SUGGESTION_MIN_REJECTS = 3;
const SUGGESTION_PERIOD_DAYS = 30;
const SUGGESTION_LIMIT = 10;

export async function generateConstitutionSuggestions(
  prisma: ConstitutionDbClient,
  tenantId: string,
): Promise<{ suggestions: ConstitutionSuggestion[] }> {
  const periodStart = new Date(Date.now() - SUGGESTION_PERIOD_DAYS * 86_400_000);

  const [rejectPatterns, currentConstitution] = await Promise.all([
    (prisma as PrismaClient).feedbackSignal.groupBy({
      by: ['agentAction'],
      where: {
        tenantId,
        type: 'reject',
        createdAt: { gte: periodStart },
      },
      _count: true,
      orderBy: { _count: { agentAction: 'desc' } },
      take: SUGGESTION_LIMIT,
    }),
    loadActiveConstitution(prisma, tenantId),
  ]);

  const existingRuleActions = new Set(
    currentConstitution.rules
      .filter((r): r is ConstitutionRule & { kind: 'ALLOWED_ACTIONS' } => r.kind === 'ALLOWED_ACTIONS')
      .flatMap((r) => r.params.actions),
  );

  const suggestions: ConstitutionSuggestion[] = [];

  for (const pattern of rejectPatterns) {
    if (pattern._count < SUGGESTION_MIN_REJECTS) continue;
    const action = pattern.agentAction;

    if (existingRuleActions.has(action)) {
      suggestions.push({
        type: 'restrict_action',
        action,
        rejectCount: pattern._count,
        reason: `Rejected ${pattern._count}× in 30d despite being allowed. Consider a STRUCTURAL guard.`,
      });
    } else {
      suggestions.push({
        type: 'new_rule',
        action,
        rejectCount: pattern._count,
        reason: `Rejected ${pattern._count}× in 30d. Consider adding to ALLOWED_ACTIONS with a review gate.`,
      });
    }
  }

  return { suggestions };
}
