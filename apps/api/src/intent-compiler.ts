import crypto from 'node:crypto';
import {
  RUNTIME_FACT_FIELDS,
  type AgentIntent,
  type IntentDomain,
  type IntentTarget,
  type RuntimeFactType,
} from '@repo/shared-types';
import type { ConditionNode, ConditionPredicate, RuleDslAst, RuleScope } from './rules-engine.js';
import type { ResolvedPolicy } from './policy.js';

export interface CompileInput {
  tenantId: string;
  ast: RuleDslAst;
  target: IntentTarget;
  context?: {
    brandId?: string;
    productId?: string;
  };
  runtimeFacts?: Record<string, string | number | boolean | null | undefined>;
}

export interface PolicyDecision {
  approved: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: string[];
  requiresApproval: boolean;
}

export interface ConditionDecision {
  expression: string;
  dependencies: string[];
  matched: boolean;
  missingFields: string[];
}

export interface CompiledIntent {
  intent: AgentIntent;
  decision: PolicyDecision;
  condition: ConditionDecision;
}

const RUNTIME_FACT_WHITELIST: Record<string, RuntimeFactType> = Object.fromEntries(
  RUNTIME_FACT_FIELDS.map((field) => [field.key, field.type]),
) as Record<string, RuntimeFactType>;

export interface RuntimeFactsValidationResult {
  valid: boolean;
  errors: string[];
}

const DOMAIN_MAP: Record<string, IntentDomain> = {
  ads: 'ads',
  inventory: 'inventory',
  pricing: 'pricing',
  seasonality: 'ads',
  risk: 'inventory',
};

export function validateRuntimeFacts(
  runtimeFacts?: Record<string, string | number | boolean | null | undefined>,
): RuntimeFactsValidationResult {
  if (!runtimeFacts) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  for (const [key, value] of Object.entries(runtimeFacts)) {
    const expectedType = RUNTIME_FACT_WHITELIST[key];
    if (!expectedType) {
      errors.push(`UNKNOWN_RUNTIME_FACT:${key}`);
      continue;
    }
    if (value === null || value === undefined) continue;

    const actualType = typeof value;
    if (actualType !== expectedType) {
      errors.push(`INVALID_RUNTIME_FACT_TYPE:${key}:expected_${expectedType}:got_${actualType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function normalizeScope(tenantId: string, scope: RuleScope): AgentIntent['scope'] {
  return {
    tenantId,
    platform: scope.platform,
    market: scope.market,
    brand: scope.brand,
    category: scope.category,
    fulfillment: scope.fulfillment,
  };
}

function extractBidPercent(actionParams: Record<string, unknown>): number {
  const raw = actionParams.percent;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function calculateDecision(intent: AgentIntent, policy: ResolvedPolicy): PolicyDecision {
  const violations: string[] = [];
  let riskScore = clamp(intent.risk.score, 0, 1);

  if (intent.action === 'INCREASE_BID' || intent.action === 'DECREASE_BID') {
    const pct = extractBidPercent(intent.payload);
    const maxAllowed = policy.values.maxDailyBudgetChangePct * 100;
    if (Math.abs(pct) > maxAllowed) {
      violations.push(`BID_CHANGE_EXCEEDS_POLICY:${pct}>${maxAllowed}`);
      riskScore = Math.max(riskScore, 0.86);
    }
  }

  if (intent.action === 'OVERRIDE_INVENTORY_GUARD') {
    violations.push('INVENTORY_GUARD_OVERRIDE_REQUIRES_APPROVAL');
    riskScore = Math.max(riskScore, 0.78);
  }

  const payloadAcos = intent.payload.targetAcos;
  if (typeof payloadAcos === 'number' && payloadAcos > 0.7) {
    violations.push('TARGET_ACOS_TOO_HIGH');
    riskScore = Math.max(riskScore, 0.74);
  }

  const hardRejected = violations.some((item) => item.startsWith('BID_CHANGE_EXCEEDS_POLICY'));

  const riskLevel: PolicyDecision['riskLevel'] =
    riskScore >= 0.9 ? 'CRITICAL' : riskScore >= 0.7 ? 'HIGH' : riskScore >= 0.4 ? 'MEDIUM' : 'LOW';

  const requiresApproval = !hardRejected && (riskScore >= 0.7 || violations.length > 0);

  return {
    approved: !hardRejected,
    riskScore,
    riskLevel,
    violations,
    requiresApproval,
  };
}

function actionToPayload(actionType: string, params: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { ...params };
  if (actionType === 'INCREASE_BID' || actionType === 'DECREASE_BID') {
    base.bidDeltaPct = extractBidPercent(params);
  }
  return base;
}

function quoteLiteral(value: number | string | [number, number]): string {
  if (Array.isArray(value)) {
    return `[${value[0]}, ${value[1]}]`;
  }
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function compilePredicateExpression(node: ConditionPredicate): string {
  if (node.operator === 'between') {
    if (Array.isArray(node.value) && node.value.length === 2) {
      return `(${node.field} >= ${node.value[0]} && ${node.field} <= ${node.value[1]})`;
    }
    return '(false)';
  }
  const op = node.operator === '=' ? '==' : node.operator;
  return `(${node.field} ${op} ${quoteLiteral(node.value)})`;
}

function compileConditionExpression(node: ConditionNode): { expression: string; dependencies: string[] } {
  if (node.kind === 'predicate') {
    return {
      expression: compilePredicateExpression(node),
      dependencies: [node.field],
    };
  }

  const children = node.children.map((child) => compileConditionExpression(child));
  const operator = node.operator === 'AND' ? '&&' : '||';
  return {
    expression: `(${children.map((child) => child.expression).join(` ${operator} `)})`,
    dependencies: [...new Set(children.flatMap((child) => child.dependencies))],
  };
}

function toNumberLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function evalPredicate(
  predicate: ConditionPredicate,
  facts: Record<string, string | number | boolean | null | undefined>,
): { matched: boolean; missingFields: string[] } {
  const fact = facts[predicate.field];
  if (fact === undefined || fact === null) {
    return { matched: false, missingFields: [predicate.field] };
  }

  if (predicate.operator === '=') {
    return { matched: String(fact) === String(predicate.value), missingFields: [] };
  }

  if (predicate.operator === 'between') {
    if (!Array.isArray(predicate.value) || predicate.value.length !== 2) {
      return { matched: false, missingFields: [] };
    }
    const factNum = toNumberLike(fact);
    if (factNum === null) {
      return { matched: false, missingFields: [] };
    }
    return {
      matched: factNum >= Number(predicate.value[0]) && factNum <= Number(predicate.value[1]),
      missingFields: [],
    };
  }

  const left = toNumberLike(fact);
  const right = toNumberLike(predicate.value);
  if (left === null || right === null) {
    return { matched: false, missingFields: [] };
  }

  if (predicate.operator === '<') return { matched: left < right, missingFields: [] };
  if (predicate.operator === '<=') return { matched: left <= right, missingFields: [] };
  if (predicate.operator === '>') return { matched: left > right, missingFields: [] };
  if (predicate.operator === '>=') return { matched: left >= right, missingFields: [] };
  return { matched: false, missingFields: [] };
}

function evaluateConditionNode(
  node: ConditionNode,
  facts: Record<string, string | number | boolean | null | undefined>,
): { matched: boolean; missingFields: string[] } {
  if (node.kind === 'predicate') {
    return evalPredicate(node, facts);
  }

  const results = node.children.map((child) => evaluateConditionNode(child, facts));
  const missingFields = [...new Set(results.flatMap((result) => result.missingFields))];
  if (node.operator === 'AND') {
    return { matched: results.every((result) => result.matched), missingFields };
  }
  return { matched: results.some((result) => result.matched), missingFields };
}

function evaluateCompiledCondition(
  condition: ConditionNode,
  runtimeFacts?: Record<string, string | number | boolean | null | undefined>,
): ConditionDecision {
  const compiled = compileConditionExpression(condition);
  const facts = runtimeFacts ?? {};
  const evaluated = evaluateConditionNode(condition, facts);

  return {
    expression: compiled.expression,
    dependencies: compiled.dependencies,
    matched: evaluated.matched,
    missingFields: evaluated.missingFields,
  };
}

export function compileAstToIntents(input: CompileInput, policy: ResolvedPolicy): CompiledIntent[] {
  const { tenantId, ast, target, runtimeFacts } = input;

  return ast.rules.map((rule) => {
    const condition = evaluateCompiledCondition(rule.when, runtimeFacts);

    const intent: AgentIntent = {
      intentId: crypto.randomUUID(),
      domain: DOMAIN_MAP[rule.domain] ?? 'ads',
      action: rule.then.type,
      target,
      scope: normalizeScope(tenantId, rule.scope),
      payload: {
        ...actionToPayload(rule.then.type, rule.then.params),
        ruleId: rule.ruleId,
        priority: rule.priority,
        sourceText: rule.sourceText,
        lifecycle: rule.scope.listingLifecycle,
        whenExpression: condition.expression,
        whenDependencies: condition.dependencies,
      },
      risk: {
        score: clamp(rule.priority / 100, 0.05, 0.95),
        level: rule.priority >= 90 ? 'CRITICAL' : rule.priority >= 75 ? 'HIGH' : rule.priority >= 50 ? 'MEDIUM' : 'LOW',
        violations: [],
      },
      reasoning: {
        summary: rule.reasoning,
        evidence: [
          { metric: 'priority', value: rule.priority },
          { metric: 'scope.platform', value: rule.scope.platform },
          { metric: 'scope.market', value: rule.scope.market },
          { metric: 'when.matched', value: condition.matched ? 'true' : 'false' },
        ],
      },
      tenantId: 'system',
      traceId: `trc_${Date.now()}`,
      origin: 'AGENT',
      constitutionVersion: '1.0',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const decision = calculateDecision(intent, policy);
    if (!condition.matched) {
      decision.violations.push('CONDITION_NOT_MATCHED_AT_RUNTIME');
      if (condition.missingFields.length > 0) {
        decision.violations.push(`MISSING_RUNTIME_FACTS:${condition.missingFields.join(',')}`);
      }
    }

    intent.risk = {
      score: decision.riskScore,
      level: decision.riskLevel,
      violations: decision.violations,
    };

    return { intent, decision, condition };
  });
}
