export type IntentDomain = 'ads' | 'listing' | 'pricing' | 'inventory' | 'cs';

export interface IntentTarget {
  type: 'listing' | 'campaign' | 'commodity' | 'product';
  id: string;
}

export interface IntentScope {
  tenantId: string;
  platform: string;
  market: string;
  brand?: string;
  category?: string;
  fulfillment?: string;
}

export interface IntentRisk {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: string[];
}

export interface IntentReasoning {
  summary: string;
  evidence: Array<{ metric: string; value: number | string; note?: string }>;
}

export interface AuditableIntent {
  intentId: string;
  action: string;
  domain: IntentDomain;
  target: IntentTarget;
  scope: IntentScope;
  reasoning: IntentReasoning;
  risk: IntentRisk;
  policySnapshotId?: string;
  tenantId: string;
  traceId: string;
  origin: 'USER' | 'SYSTEM' | 'AGENT';
  constitutionVersion: string;
  timestamp: string; // ISO8601
  type?: string;
  payload: Record<string, unknown>;
  riskHint?: number;
  createdAt?: string;
}

export type AgentIntent = AuditableIntent;

export interface ReasoningLog {
  traceId: string;
  tenantId: string;
  timestamp: string;
  observe: {
    snapshot: Record<string, unknown>;
    fossilized: boolean;
  };
  orient: {
    analysis: string;
    matchedRules: string[];
    ruleRiskScore: number;
  };
  decide: {
    rationale: string;
    alternativesConsidered: string[];
  };
  act: AuditableIntent;
}

export type LifecycleStage = 'LAUNCH' | 'GROWTH' | 'MATURE' | 'DECLINE';
export type ConfidenceLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface ConfidenceFactors {
  sampleAdequacy: number;
  dataFreshness: number;
  signalCompleteness: number;
  signalConsistency: number;
  decisionMagnitudePenalty: number;
  ruleCompliance: number;
}

export interface ConfidenceScore {
  score: number;
  level: ConfidenceLevel;
  factors: ConfidenceFactors;
}

export interface SignalContext {
  platform: string;
  market: string;
  categoryId?: string;
  lifecycleStage?: LifecycleStage;
  profitMarginPct?: number;
  reviewScore?: number;
  reviewCount?: number;
}

export interface Tier2Signals {
  ctr: number;
  cvr: number;
  competitorPriceDelta: number;
  returnRate: number;
  inTransitUnits: number;
  availableUnits: number;
  daysOfSupply: number;
  isPromoPeriod: boolean;
  seasonalityFactor: number;
  fxImpactPct: number;
}

export interface ToolCallRecord {
  toolId: string;
  toolType: 'read' | 'write';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  error?: string;
}

export interface ExecutionReceipt {
  intentId: string;
  platform: 'amazon' | 'walmart' | 'tiktok';
  executionId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  rollbackSupported: boolean;
  rawResponse: Record<string, unknown>;
}

export interface RunResponse {
  status: 'ACCEPTED';
  jobId: string;
}

export interface ApprovalItem {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  tenantId: string;
  intentId: string;
  domain: IntentDomain;
  action: string;
  createdAt: string;
}

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface ListingItem {
  id: string;
  tenantId: string;
  commodityId: string | null;
  platformId: string;
  externalListingId: string;
  title: string;
  isPrimary: boolean;
  status: ListingStatus;
  origin: 'system' | 'platform_import' | 'manual_entry';
  mappingStatus: 'unmapped' | 'ai_suggested' | 'mapped' | 'rejected';
  rawPlatformData?: Record<string, unknown>;
  mappedBy?: string;
  mappedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── MDM Shared Types ────────────────────────────────────

export interface MdmMarket {
  id: string; code: string; name: string; currency: string; timezone: string;
  languages?: { id: string; language: string; isDefault: boolean }[];
}

export interface MdmPlatform {
  id: string; code: string; name: string; apiType: string;
  apiStatus: 'connected' | 'disconnected' | 'error'; lastSyncAt?: string;
  fulfillmentModes?: { id: string; code: string; name: string }[];
}

export interface MdmCategory {
  id: string; code: string; name: string; definition?: string; parentId?: string;
  children?: MdmCategory[];
}

export interface MdmBrand {
  id: string; code: string; name: string; description?: string;
  brandCategories?: { id: string; category: MdmCategory }[];
}

export interface MdmSupplier {
  id: string; code: string; name: string; contactName?: string; contactEmail?: string;
  leadTimeDays?: number; moq?: number; currency: string; country: string;
}

export interface MdmWarehouse {
  id: string; code: string; name: string; type: string; country: string;
  address?: string; capacity?: number;
  apiStatus: 'connected' | 'disconnected' | 'error'; lastSyncAt?: string;
}

export interface Mdm3PL {
  id: string; code: string; name: string; provider: string;
  apiStatus: 'connected' | 'disconnected' | 'error'; lastSyncAt?: string;
}

export interface MdmErpSystem {
  id: string; code: string; name: string; erpType: string;
  apiStatus: 'connected' | 'disconnected' | 'error'; lastSyncAt?: string;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
}

export interface MdmProduct {
  id: string; sku: string; name: string; lifecycleStage: string;
  brandId: string; categoryId: string; supplierId?: string;
  upc?: string; asin?: string; costPrice?: number; msrp?: number;
  weight?: number; dimensions?: Record<string, unknown>;
  tags: string[]; imageUrls: string[]; attributes?: Record<string, unknown>;
  brand?: MdmBrand; category?: MdmCategory; supplier?: MdmSupplier;
}

export interface MdmCommodity {
  id: string; productId: string; marketId: string; language: string;
  title: string; bulletPoints?: unknown; lifecycleStage: string;
  market?: MdmMarket; media?: MdmCommodityMedia[];
}

export interface MdmCommodityMedia {
  id: string; commodityId: string; type: string; title: string;
  url: string; platform: string; language: string;
  aiSummary?: string; duration?: number; sortOrder: number;
}

export interface MdmExternalSkuMapping {
  id: string; productId?: string; sourceType: string; sourceId: string;
  externalSku: string; externalName?: string;
  mappingStatus: 'unmapped' | 'ai_suggested' | 'mapped' | 'rejected';
  mappedBy?: string; mappedAt?: string;
}

export interface MdmChangeLogEntry {
  id: string; productId: string; field: string;
  oldValue: unknown; newValue: unknown;
  changedBy: string; source: string; createdAt: string;
}

export type RuntimeFactPrimitive = string | number | boolean | null | undefined;
export type RuntimeFactType = 'number' | 'string' | 'boolean';
export type RuntimeFactGroup = 'ads' | 'inventory' | 'risk' | 'context';
export type RuntimeFactLevel = 'required' | 'recommended' | 'optional';

export interface RuntimeFactFieldSpec {
  key: string;
  type: RuntimeFactType;
  group: RuntimeFactGroup;
  level: RuntimeFactLevel;
  description: string;
  example: number | string | boolean;
}

export const RUNTIME_FACT_FIELDS: RuntimeFactFieldSpec[] = [
  { key: 'acos', type: 'number', group: 'ads', level: 'required', description: '当前 ACoS（百分比数值）', example: 31 },
  { key: 'target_acos', type: 'number', group: 'ads', level: 'recommended', description: '目标 ACoS（百分比数值）', example: 35 },
  { key: 'roas', type: 'number', group: 'ads', level: 'recommended', description: '当前 ROAS', example: 3.2 },
  { key: 'bid_change_pct', type: 'number', group: 'ads', level: 'required', description: '计划出价变动百分比', example: -10 },
  { key: 'ctr', type: 'number', group: 'ads', level: 'optional', description: '点击率（百分比或小数）', example: 1.8 },
  { key: 'cvr', type: 'number', group: 'ads', level: 'optional', description: '转化率（百分比或小数）', example: 7.2 },
  { key: 'inventory_days', type: 'number', group: 'inventory', level: 'required', description: '当前库存可售天数', example: 8 },
  { key: 'new_product_days', type: 'number', group: 'inventory', level: 'recommended', description: '新品上架天数', example: 15 },
  { key: 'is_new_product', type: 'boolean', group: 'inventory', level: 'recommended', description: '是否新品', example: true },
  { key: 'price', type: 'number', group: 'risk', level: 'optional', description: '当前售价', example: 29.99 },
  { key: 'profit_margin', type: 'number', group: 'risk', level: 'recommended', description: '毛利率（百分比）', example: 45 },
  { key: 'risk_profile', type: 'string', group: 'risk', level: 'required', description: '风险偏好标签', example: 'CONSERVATIVE' },
  { key: 'season_window', type: 'string', group: 'context', level: 'recommended', description: '季节窗口标签', example: 'PROMOTION' },
  { key: 'platform', type: 'string', group: 'context', level: 'required', description: '平台名', example: 'amazon' },
  { key: 'market', type: 'string', group: 'context', level: 'required', description: '市场标识', example: 'US' },
  { key: 'lifecycle', type: 'string', group: 'context', level: 'recommended', description: '生命周期阶段', example: 'NEW' },
  { key: 'is_promotion', type: 'boolean', group: 'context', level: 'optional', description: '是否处于促销期', example: true },
  { key: 'review_score', type: 'number', group: 'context', level: 'recommended', description: '评论评分（1-5）', example: 4.3 },
  { key: 'review_count', type: 'number', group: 'context', level: 'recommended', description: '评论总数', example: 156 },
  { key: 'days_since_launch', type: 'number', group: 'inventory', level: 'recommended', description: '上架天数', example: 45 },
  { key: 'sales_slope_30d', type: 'number', group: 'ads', level: 'recommended', description: '30天销量斜率', example: 0.05 },
  { key: 'return_rate', type: 'number', group: 'risk', level: 'recommended', description: '退货率', example: 0.03 },
  { key: 'cost_price', type: 'number', group: 'risk', level: 'recommended', description: '采购成本', example: 8.5 },
  { key: 'referral_fee_rate', type: 'number', group: 'risk', level: 'optional', description: '平台佣金率', example: 0.15 },
  { key: 'fba_fee_per_unit', type: 'number', group: 'risk', level: 'optional', description: 'FBA配送费/件', example: 5.0 },
  { key: 'confidence_score', type: 'number', group: 'context', level: 'recommended', description: 'Agent置信度（0-1）', example: 0.78 },
  { key: 'ctr', type: 'number', group: 'ads', level: 'recommended', description: '点击率', example: 0.018 },
  { key: 'cvr', type: 'number', group: 'ads', level: 'recommended', description: '转化率', example: 0.072 },
  { key: 'competitor_avg_price', type: 'number', group: 'risk', level: 'optional', description: '竞品平均价格', example: 25.99 },
  { key: 'competitor_price_delta', type: 'number', group: 'risk', level: 'recommended', description: '竞品价格差异比例', example: 0.05 },
  { key: 'in_transit_units', type: 'number', group: 'inventory', level: 'optional', description: '在途库存数量', example: 500 },
  { key: 'available_units', type: 'number', group: 'inventory', level: 'optional', description: '可用库存数量', example: 1200 },
  { key: 'days_of_supply', type: 'number', group: 'inventory', level: 'recommended', description: '库存可售天数', example: 30 },
  { key: 'is_promo_period', type: 'boolean', group: 'context', level: 'optional', description: '是否促销期', example: false },
  { key: 'seasonality_factor', type: 'number', group: 'context', level: 'optional', description: '季节性系数', example: 1.2 },
  { key: 'fx_rate', type: 'number', group: 'risk', level: 'optional', description: '当前汇率', example: 7.25 },
  { key: 'fx_impact_pct', type: 'number', group: 'risk', level: 'optional', description: '汇率影响百分比', example: 0.02 },
];

const runtimeFactsProperties = Object.fromEntries(
  RUNTIME_FACT_FIELDS.map((field) => [
    field.key,
    {
      type: field.type,
      description: field.description,
      examples: [field.example],
    },
  ]),
);

export const RUNTIME_FACTS_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://codex-ai-ecom/schemas/runtime-facts.schema.json',
  title: 'RuntimeFacts',
  type: 'object',
  additionalProperties: false,
  properties: runtimeFactsProperties,
} as const;
