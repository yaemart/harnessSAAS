import { describe, expect, it } from 'vitest';
import type { RuleDslAst } from './rules-engine.js';
import type { ResolvedPolicy } from './policy.js';
import { compileAstToIntents, validateRuntimeFacts } from './intent-compiler.js';

const policy: ResolvedPolicy = {
  resolvedAt: new Date().toISOString(),
  values: {
    targetAcos: 0.35,
    minBid: 0.2,
    maxDailyBudgetChangePct: 0.3,
    freshnessTtlMinutes: 30,
  },
  source: {
    targetAcos: 'SYSTEM',
    minBid: 'SYSTEM',
    maxDailyBudgetChangePct: 'SYSTEM',
    freshnessTtlMinutes: 'SYSTEM',
  },
};

function buildAst(ruleWhen: RuleDslAst['rules'][number]['when']): RuleDslAst {
  return {
    version: '1.0',
    rules: [
      {
        ruleId: 'rule-1',
        domain: 'ads',
        priority: 70,
        scope: {
          platform: 'amazon',
          market: 'US',
          fulfillment: 'FBA',
          listingLifecycle: 'NEW',
        },
        when: ruleWhen,
        then: {
          type: 'DECREASE_BID',
          params: { percent: 10 },
        },
        reasoning: 'test reasoning',
        sourceText: 'test source',
        confidence: 0.9,
      },
    ],
  };
}

describe('validateRuntimeFacts', () => {
  it('rejects unknown fields and invalid type', () => {
    const result = validateRuntimeFacts({
      acos: '31',
      foo: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('UNKNOWN_RUNTIME_FACT:foo');
    expect(result.errors).toContain('INVALID_RUNTIME_FACT_TYPE:acos:expected_number:got_string');
  });

  it('accepts whitelisted fields with valid types', () => {
    const result = validateRuntimeFacts({
      acos: 31,
      inventory_days: 5,
      season_window: 'PROMOTION',
      is_promotion: true,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('compileAstToIntents condition matching', () => {
  it('marks missing field and not matched', () => {
    const ast = buildAst({
      kind: 'predicate',
      field: 'acos',
      operator: '<=',
      value: 35,
    });

    const [compiled] = compileAstToIntents(
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        ast,
        target: { type: 'listing', id: 'LISTING-1' },
        runtimeFacts: {},
      },
      policy,
    );

    expect(compiled.condition.matched).toBe(false);
    expect(compiled.condition.missingFields).toContain('acos');
    expect(compiled.decision.violations).toContain('CONDITION_NOT_MATCHED_AT_RUNTIME');
    expect(compiled.decision.violations.some((v) => v.startsWith('MISSING_RUNTIME_FACTS:'))).toBe(true);
  });

  it('supports boundary value for <=', () => {
    const ast = buildAst({
      kind: 'predicate',
      field: 'acos',
      operator: '<=',
      value: 35,
    });

    const [compiled] = compileAstToIntents(
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        ast,
        target: { type: 'listing', id: 'LISTING-1' },
        runtimeFacts: { acos: 35 },
      },
      policy,
    );

    expect(compiled.condition.matched).toBe(true);
    expect(compiled.condition.missingFields).toEqual([]);
  });

  it('supports between operator', () => {
    const ast = buildAst({
      kind: 'predicate',
      field: 'inventory_days',
      operator: 'between',
      value: [7, 14],
    });

    const [match] = compileAstToIntents(
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        ast,
        target: { type: 'listing', id: 'LISTING-1' },
        runtimeFacts: { inventory_days: 10 },
      },
      policy,
    );

    const [notMatch] = compileAstToIntents(
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        ast,
        target: { type: 'listing', id: 'LISTING-1' },
        runtimeFacts: { inventory_days: 20 },
      },
      policy,
    );

    expect(match.condition.matched).toBe(true);
    expect(notMatch.condition.matched).toBe(false);
  });
});
