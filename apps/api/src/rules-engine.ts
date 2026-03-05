import type { PrismaClient } from '@prisma/client';

export type RuleDomain = 'ads' | 'inventory' | 'pricing' | 'seasonality' | 'risk';

type Comparator = '<' | '<=' | '>' | '>=' | '=' | 'between';

type ScopePlatform = 'amazon' | 'walmart' | 'tiktok' | 'meta' | 'all';
type ScopeMarket = 'US' | 'EU' | 'JP' | 'GLOBAL';

export interface RuleScope {
  tenantId?: string;
  platform: ScopePlatform;
  market: ScopeMarket;
  brand?: string;
  category?: string;
  fulfillment?: 'FBA' | 'FBM' | 'ALL';
  listingLifecycle?: 'NEW' | 'GROWTH' | 'MATURE' | 'DECLINING' | 'ALL';
}

export interface ConditionPredicate {
  kind: 'predicate';
  field: string;
  operator: Comparator;
  value: number | string | [number, number];
}

export interface ConditionGroup {
  kind: 'group';
  operator: 'AND' | 'OR';
  children: ConditionNode[];
}

export type ConditionNode = ConditionPredicate | ConditionGroup;

export interface RuleAction {
  type:
    | 'KEEP_OR_REDUCE_BID'
    | 'INCREASE_BID'
    | 'DECREASE_BID'
    | 'PAUSE_ADS'
    | 'RESUME_ADS'
    | 'OVERRIDE_INVENTORY_GUARD'
    | 'RELAX_CONSTRAINTS'
    | 'ENABLE_CONSERVATIVE_MODE';
  params: Record<string, number | string | boolean>;
}

export interface RuleAst {
  ruleId: string;
  domain: RuleDomain;
  priority: number;
  scope: RuleScope;
  when: ConditionNode;
  then: RuleAction;
  reasoning: string;
  sourceText: string;
  confidence: number;
}

export interface RuleDslAst {
  version: '1.0';
  rules: RuleAst[];
}

export interface ParsedRule {
  id: string;
  domain: RuleDomain;
  metric: string;
  operator: Comparator;
  value: number | [number, number];
  action: string;
  priority: number;
  sourceText: string;
  confidence: number;
}

export interface ParseResult {
  rules: ParsedRule[];
  ast: RuleDslAst;
  unparsedSegments: string[];
}

export interface RuleConflict {
  type: 'DIRECT_CONTRADICTION' | 'LOGIC_CONFLICT' | 'RANGE_OVERLAP' | 'PRIORITY_AMBIGUITY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  detail: string;
  involvedRuleIds: string[];
  suggestions: string[];
}

export interface RuleSuggestion {
  suggestionType: string;
  title: string;
  detail: string;
  rationale: Record<string, unknown>;
}

export interface PreviewImpact {
  affectedListings: number;
  totalListings: number;
  estimatedSpendDeltaPct: number;
  estimatedSalesDeltaPct: number;
  estimatedAcosFrom: number;
  estimatedAcosTo: number;
  examples: Array<{
    listingTitle: string;
    current: string;
    projected: string;
  }>;
}

function normalizeSegments(text: string): string[] {
  return text
    .split(/[\n。；;.!?]/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function inferPriority(segment: string): number {
  const lower = segment.toLowerCase();
  if (/(p0|critical|最高|绝对|必须|红线)/i.test(lower)) return 95;
  if (/(p1|high|高优先|紧急|风险优先)/i.test(lower)) return 85;
  if (/(p2|medium|中优先)/i.test(lower)) return 70;
  if (/(p3|low|低优先|可选)/i.test(lower)) return 55;
  return 65;
}

function inferScope(segment: string): RuleScope {
  const lower = segment.toLowerCase();

  const platform: ScopePlatform =
    lower.includes('walmart')
      ? 'walmart'
      : lower.includes('tiktok')
        ? 'tiktok'
        : lower.includes('meta')
          ? 'meta'
          : lower.includes('amazon')
            ? 'amazon'
            : 'all';

  const market: ScopeMarket =
    /\b(us|美国)\b/i.test(lower)
      ? 'US'
      : /\b(eu|欧洲)\b/i.test(lower)
        ? 'EU'
        : /\b(jp|日本)\b/i.test(lower)
          ? 'JP'
          : 'GLOBAL';

  const fulfillment: RuleScope['fulfillment'] =
    lower.includes('fba') ? 'FBA' : lower.includes('fbm') ? 'FBM' : 'ALL';

  const listingLifecycle: RuleScope['listingLifecycle'] =
    /(新品|new)/i.test(lower)
      ? 'NEW'
      : /(增长|growth)/i.test(lower)
        ? 'GROWTH'
        : /(成熟|mature)/i.test(lower)
          ? 'MATURE'
          : /(衰退|declin)/i.test(lower)
            ? 'DECLINING'
            : 'ALL';

  return {
    platform,
    market,
    fulfillment,
    listingLifecycle,
  };
}

function extractPredicates(segment: string): ConditionPredicate[] {
  const predicates: ConditionPredicate[] = [];

  const acosMatch = segment.match(/(?:acos|a\s*cos|广告花费比|投产比)[^\d]*(\d{1,2}(?:\.\d+)?)\s*%?/i);
  if (acosMatch) {
    predicates.push({
      kind: 'predicate',
      field: 'acos',
      operator: '<=',
      value: Number(acosMatch[1]),
    });
  }

  const inventoryPause = segment.match(/(?:库存|inventory)[^\d]*(?:<|低于|不足)\s*(\d{1,3})\s*(?:天|day|days)/i);
  if (inventoryPause) {
    predicates.push({
      kind: 'predicate',
      field: 'inventory_days',
      operator: '<',
      value: Number(inventoryPause[1]),
    });
  }

  const newWindow = segment.match(/(?:新品|new product|new listing).*(\d{1,3})\s*(?:天|day|days)/i);
  if (newWindow) {
    predicates.push({
      kind: 'predicate',
      field: 'new_product_days',
      operator: '<=',
      value: Number(newWindow[1]),
    });
  }

  const bidDelta = segment.match(/(?:出价|bid)[^\d+-]*([+-]?\d{1,2})\s*%/i);
  if (bidDelta) {
    predicates.push({
      kind: 'predicate',
      field: 'bid_change_pct',
      operator: '=',
      value: Number(bidDelta[1]),
    });
  }

  if (/(prime\s*day|旺季|黑五|q4)/i.test(segment)) {
    predicates.push({
      kind: 'predicate',
      field: 'season_window',
      operator: '=',
      value: 'PROMOTION',
    });
  }

  if (/(风险|risk|高价值|保守)/i.test(segment)) {
    predicates.push({
      kind: 'predicate',
      field: 'risk_profile',
      operator: '=',
      value: 'CONSERVATIVE',
    });
  }

  return predicates;
}

function composeConditionTree(predicates: ConditionPredicate[], segment: string): ConditionNode | null {
  if (predicates.length === 0) return null;
  if (predicates.length === 1) return predicates[0];

  const isOr = /(或者|或|or)/i.test(segment);
  return {
    kind: 'group',
    operator: isOr ? 'OR' : 'AND',
    children: predicates,
  };
}

function inferDomain(predicates: ConditionPredicate[], segment: string): RuleDomain {
  if (predicates.some((predicate) => predicate.field === 'inventory_days' || predicate.field === 'new_product_days')) {
    return 'inventory';
  }
  if (predicates.some((predicate) => predicate.field === 'risk_profile')) {
    return 'risk';
  }
  if (predicates.some((predicate) => predicate.field === 'season_window')) {
    return 'seasonality';
  }
  if (/(价格|price|降价|涨价)/i.test(segment)) {
    return 'pricing';
  }
  return 'ads';
}

function inferAction(predicates: ConditionPredicate[], segment: string): RuleAction {
  const lower = segment.toLowerCase();
  const bidPredicate = predicates.find((predicate) => predicate.field === 'bid_change_pct');
  const hasInventory = predicates.some((predicate) => predicate.field === 'inventory_days');
  const hasNewWindow = predicates.some((predicate) => predicate.field === 'new_product_days');

  if (hasInventory && /(停|暂停|停止|pause|stop)/i.test(lower)) {
    return { type: 'PAUSE_ADS', params: {} };
  }

  if (hasNewWindow && /(放宽|override|不受库存限制|ignore inventory)/i.test(lower)) {
    return {
      type: 'OVERRIDE_INVENTORY_GUARD',
      params: {
        enabled: true,
      },
    };
  }

  if (bidPredicate && typeof bidPredicate.value === 'number') {
    if (bidPredicate.value > 0) {
      return { type: 'INCREASE_BID', params: { percent: bidPredicate.value } };
    }
    if (bidPredicate.value < 0) {
      return { type: 'DECREASE_BID', params: { percent: Math.abs(bidPredicate.value) } };
    }
  }

  if (/(保守|conservative|risk)/i.test(lower)) {
    return { type: 'ENABLE_CONSERVATIVE_MODE', params: {} };
  }

  if (/(旺季|prime day|q4|黑五)/i.test(lower)) {
    return { type: 'RELAX_CONSTRAINTS', params: {} };
  }

  return { type: 'KEEP_OR_REDUCE_BID', params: {} };
}

function astActionToLegacy(action: RuleAction): string {
  switch (action.type) {
    case 'INCREASE_BID':
      return 'increase_bid';
    case 'DECREASE_BID':
      return 'decrease_bid';
    case 'PAUSE_ADS':
      return 'pause_ads';
    case 'OVERRIDE_INVENTORY_GUARD':
      return 'inventory_override';
    case 'RELAX_CONSTRAINTS':
      return 'relax_constraints';
    case 'ENABLE_CONSERVATIVE_MODE':
      return 'conservative_mode';
    case 'RESUME_ADS':
      return 'resume_ads';
    default:
      return 'keep_or_reduce_bid';
  }
}

function pickPrimaryPredicate(condition: ConditionNode): ConditionPredicate {
  if (condition.kind === 'predicate') return condition;

  const fieldOrder = ['inventory_days', 'new_product_days', 'acos', 'bid_change_pct', 'risk_profile', 'season_window'];
  for (const field of fieldOrder) {
    const match = condition.children.find((child) => child.kind === 'predicate' && child.field === field);
    if (match && match.kind === 'predicate') return match;
  }

  const first = condition.children.find((child) => child.kind === 'predicate');
  if (first && first.kind === 'predicate') return first;

  return {
    kind: 'predicate',
    field: 'custom',
    operator: '=',
    value: 1,
  };
}

function normalizeLegacyValue(value: ConditionPredicate['value']): number | [number, number] {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value;
  return 1;
}

export function parseNaturalLanguageRules(text: string): ParseResult {
  const segments = normalizeSegments(text);
  const unparsedSegments: string[] = [];
  const astRules: RuleAst[] = [];

  for (const segment of segments) {
    const predicates = extractPredicates(segment);
    const when = composeConditionTree(predicates, segment);
    if (!when) {
      unparsedSegments.push(segment);
      continue;
    }

    const ruleId = `rule-${astRules.length + 1}`;
    astRules.push({
      ruleId,
      domain: inferDomain(predicates, segment),
      priority: inferPriority(segment),
      scope: inferScope(segment),
      when,
      then: inferAction(predicates, segment),
      reasoning: `Derived from natural language segment: ${segment}`,
      sourceText: segment,
      confidence: Math.min(0.96, 0.72 + predicates.length * 0.08),
    });
  }

  const ast: RuleDslAst = {
    version: '1.0',
    rules: astRules,
  };

  const rules: ParsedRule[] = ast.rules.map((rule) => {
    const predicate = pickPrimaryPredicate(rule.when);
    return {
      id: rule.ruleId,
      domain: rule.domain,
      metric: predicate.field,
      operator: predicate.operator,
      value: normalizeLegacyValue(predicate.value),
      action: astActionToLegacy(rule.then),
      priority: rule.priority,
      sourceText: rule.sourceText,
      confidence: rule.confidence,
    };
  });

  return {
    rules,
    ast,
    unparsedSegments,
  };
}

export function detectRuleConflicts(rules: ParsedRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];

  const inventoryStopRule = rules.find(
    (rule) => rule.metric === 'inventory_days' && rule.action === 'pause_ads',
  );
  const newProductRule = rules.find(
    (rule) => rule.metric === 'new_product_days' && rule.action === 'inventory_override',
  );

  if (inventoryStopRule && newProductRule) {
    conflicts.push({
      type: 'DIRECT_CONTRADICTION',
      severity: 'CRITICAL',
      title: '新品库存规则与库存停投规则存在直接矛盾',
      detail:
        '当新品库存低于阈值时，一条规则要求暂停投放，另一条规则允许忽略库存限制继续投放。',
      involvedRuleIds: [inventoryStopRule.id, newProductRule.id],
      suggestions: [
        '将新品规则改为“库存阈值放宽但不完全忽略”，例如 7 天改为 3 天。',
        '明确优先级：库存保护优先于新品拉新。',
      ],
    });
  }

  const acosRules = rules.filter((rule) => rule.metric === 'acos');
  const bidRules = rules.filter((rule) => rule.metric === 'bid_change_pct');
  if (acosRules.length > 0 && bidRules.length > 1) {
    conflicts.push({
      type: 'LOGIC_CONFLICT',
      severity: 'WARNING',
      title: '同一条件可能触发多重惩罚动作',
      detail: '检测到 ACoS 规则与多个出价动作并存，可能在同一窗口重复调整导致系统震荡。',
      involvedRuleIds: [acosRules[0].id, ...bidRules.map((rule) => rule.id)],
      suggestions: ['保留单一主动作（降价或降出价二选一）并增加冷却时间。'],
    });
  }

  const absLargeBid = bidRules.find((rule) => typeof rule.value === 'number' && Math.abs(rule.value) > 30);
  if (absLargeBid) {
    conflicts.push({
      type: 'RANGE_OVERLAP',
      severity: 'WARNING',
      title: '单次出价变动超过安全阈值',
      detail: `当前规则设置单次出价变动为 ${absLargeBid.value}% ，超过建议的 ±30% 安全阈值。`,
      involvedRuleIds: [absLargeBid.id],
      suggestions: ['将单次变动控制在 ±10% 到 ±15%，并分批执行。'],
    });
  }

  const hasSeasonality = rules.some((rule) => rule.domain === 'seasonality');
  const hasConservativeRisk = rules.some((rule) => rule.action === 'conservative_mode');
  if (hasSeasonality && hasConservativeRisk) {
    conflicts.push({
      type: 'PRIORITY_AMBIGUITY',
      severity: 'INFO',
      title: '旺季放宽与保守风控优先级未定义',
      detail: '系统检测到季节放宽策略与保守风控策略并存，需要声明优先级。',
      involvedRuleIds: rules
        .filter((rule) => rule.domain === 'seasonality' || rule.action === 'conservative_mode')
        .map((rule) => rule.id),
      suggestions: ['建议优先级：风险域 > 季节增长域。'],
    });
  }

  return conflicts;
}

export async function generateRuleSuggestions(
  prisma: PrismaClient,
  tenantId: string,
  rules: ParsedRule[],
): Promise<RuleSuggestion[]> {
  const suggestions: RuleSuggestion[] = [];

  const hasInventoryRule = rules.some((rule) => rule.metric === 'inventory_days');
  if (!hasInventoryRule) {
    suggestions.push({
      suggestionType: 'MISSING_RULE',
      title: '建议增加库存保护规则',
      detail: '当前规则集中未检测到库存联动保护，建议在库存低于阈值时自动降档或暂停。',
      rationale: { reason: 'missing_inventory_guard' },
    });
  }

  const acosRule = rules.find((rule) => rule.metric === 'acos');
  if (acosRule && typeof acosRule.value === 'number' && acosRule.value < 20) {
    suggestions.push({
      suggestionType: 'THRESHOLD_OPTIMIZATION',
      title: 'ACoS 目标可能过于保守',
      detail: '当前 ACoS 目标较低，可能限制增长，建议结合毛利和生命周期放宽 3-8%。',
      rationale: { currentAcosTarget: acosRule.value },
    });
  }

  const latest = await prisma.performanceSnapshot.aggregate({
    where: { tenantId },
    _avg: { spend: true, sales: true, normalizedRoas: true },
  });

  if (latest._avg.sales && latest._avg.spend) {
    const sales = Number(latest._avg.sales);
    const spend = Number(latest._avg.spend);
    if (sales > 0) {
      const acos = (spend / sales) * 100;
      suggestions.push({
        suggestionType: 'HISTORICAL_REFERENCE',
        title: '基于历史数据的 ACoS 参考',
        detail: `过去窗口平均 ACoS 约为 ${acos.toFixed(1)}%，可作为当前规则阈值校准参考。`,
        rationale: { avgSpend: spend, avgSales: sales, impliedAcos: Number(acos.toFixed(2)) },
      });
    }
  }

  return suggestions;
}

export async function estimateRuleImpact(
  prisma: PrismaClient,
  tenantId: string,
  rules: ParsedRule[],
): Promise<PreviewImpact> {
  const listings = await prisma.listing.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const sample = await prisma.performanceSnapshot.findMany({
    where: { tenantId },
    orderBy: { snapshotDate: 'desc' },
    take: 500,
    include: { listing: true },
  });

  const totalListings = listings.length;
  const hasAggressiveBid = rules.some(
    (rule) => rule.metric === 'bid_change_pct' && typeof rule.value === 'number' && rule.value > 0,
  );
  const hasInventoryPause = rules.some((rule) => rule.action === 'pause_ads');

  const affectedListings = Math.min(
    totalListings,
    Math.max(1, Math.floor(totalListings * (hasAggressiveBid ? 0.36 : 0.22))),
  );

  const spendDelta = hasAggressiveBid ? 18 : hasInventoryPause ? -8 : 5;
  const salesDelta = hasAggressiveBid ? 12 : hasInventoryPause ? -5 : 4;

  const currentAcos = sample.length
    ? sample.reduce((acc, item) => acc + Number(item.spend) / Math.max(Number(item.sales), 1), 0) /
      sample.length
    : 0.3;

  const projectedAcos = Math.max(0.05, currentAcos * (1 + spendDelta / 100 - salesDelta / 120));

  const examples = sample.slice(0, 5).map((entry) => ({
    listingTitle: entry.listing.title,
    current: `ACoS ${(Number(entry.spend) / Math.max(Number(entry.sales), 1) * 100).toFixed(1)}%, spend $${Number(entry.spend).toFixed(0)}`,
    projected: hasInventoryPause
      ? '触发库存保护，预计暂停投放'
      : `预计出价调整后 ACoS ${(Number(entry.spend) / Math.max(Number(entry.sales), 1) * 1.07 * 100).toFixed(1)}%`,
  }));

  return {
    affectedListings,
    totalListings,
    estimatedSpendDeltaPct: spendDelta,
    estimatedSalesDeltaPct: salesDelta,
    estimatedAcosFrom: Number((currentAcos * 100).toFixed(2)),
    estimatedAcosTo: Number((projectedAcos * 100).toFixed(2)),
    examples,
  };
}
