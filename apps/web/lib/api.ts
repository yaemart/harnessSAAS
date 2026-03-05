export interface ReasoningLog {
  traceId: string;
  observe: {
    snapshot: Record<string, any>;
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
  act: {
    type: string;
    payload: Record<string, any>;
  };
}

export interface ConstitutionResult {
  pass: boolean;
  hardViolations: string[];
  ruleRiskScore: number;
  version: string;
  shadowModeActive?: boolean;
}

export interface GovernanceData {
  reasoningLog: {
    summary?: string;
    observe?: Record<string, unknown>;
    orient?: Record<string, unknown>;
    decide?: Record<string, unknown>;
  } | null;
  constitution: { version: string } | null;
  riskLevel: string | null;
  executionStatus: string | null;
  targetKey: string | null;
  receipt: {
    intentId: string;
    platform: string;
    executionId: string;
    status: string;
    rollbackSupported: boolean;
    createdAt: string;
  } | null;
}

export interface ApprovalItem {
  id: string;
  tenantId: string;
  intentId: string;
  traceId?: string;
  domain: string;
  action: string;
  riskScore: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reviewerId: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  reasoningLog?: ReasoningLog;
  constitution?: ConstitutionResult;
  governance?: GovernanceData;
}

export interface ParsedRule {
  id: string;
  domain: 'ads' | 'inventory' | 'pricing' | 'seasonality' | 'risk';
  metric: string;
  operator: '<' | '<=' | '>' | '>=' | '=' | 'between';
  value: number | [number, number];
  action: string;
  priority: number;
  sourceText: string;
  confidence: number;
}

export interface RuleDslAst {
  version: '1.0';
  rules: Array<{
    ruleId: string;
    domain: 'ads' | 'inventory' | 'pricing' | 'seasonality' | 'risk';
    priority: number;
    scope: {
      platform: 'amazon' | 'walmart' | 'tiktok' | 'meta' | 'all';
      market: 'US' | 'EU' | 'JP' | 'GLOBAL';
      fulfillment: 'FBA' | 'FBM' | 'ALL';
      listingLifecycle: 'NEW' | 'GROWTH' | 'MATURE' | 'DECLINING' | 'ALL';
    };
    when: unknown;
    then: { type: string; params: Record<string, unknown> };
    reasoning: string;
    sourceText: string;
    confidence: number;
  }>;
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

export interface RuleTemplate {
  id: string;
  category: '投放策略' | '库存联动' | '季节策略' | '风险偏好';
  name: string;
  scenario: string;
  description: string;
  defaultText: string;
  params: Array<{ key: string; label: string; defaultValue: number | string }>;
}

export interface RuleSetSummary {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  language: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  activeVersion: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    version: number;
    changeSummary: string | null;
    createdBy: string;
    createdAt: string;
    publishedAt: string | null;
    rules: unknown;
  }>;
}

export interface CompiledIntentDecision {
  approved: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: string[];
  requiresApproval: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

export async function listApprovals(tenantId?: string): Promise<ApprovalItem[]> {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  params.set('governance', 'true');
  const query = `?${params.toString()}`;
  const res = await fetch(`${API_BASE}/approvals${query}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch approvals: ${res.status}`);
  }

  const data = (await res.json()) as { items: ApprovalItem[] };
  return data.items;
}

export async function approveApproval(id: string, tenantId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${id}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({ reviewerId: 'dashboard-operator' }),
  });
  if (!res.ok) {
    throw new Error(`Approve failed: ${res.status}`);
  }
}

export async function rejectApproval(id: string, tenantId: string, reason?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${id}/reject`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      reviewerId: 'dashboard-operator',
      reason: reason ?? 'Rejected from dashboard',
    }),
  });
  if (!res.ok) {
    throw new Error(`Reject failed: ${res.status}`);
  }
}

export function approvalEventsUrl(tenantId?: string): string {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return `${API_BASE}/events/approvals${query}`;
}

export function supportCaseStreamUrl(caseId: string, tenantId: string): string {
  return `${API_BASE}/support/cases/${encodeURIComponent(caseId)}/stream?tenantId=${encodeURIComponent(tenantId)}`;
}

export function eventsStreamUrl(tenantId: string): string {
  return `${API_BASE}/events/stream?tenantId=${encodeURIComponent(tenantId)}`;
}

export async function listRuleTemplates(): Promise<RuleTemplate[]> {
  const res = await fetch(`${API_BASE}/rule-templates`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch templates: ${res.status}`);
  }
  const data = (await res.json()) as { items: RuleTemplate[] };
  return data.items;
}

export async function applyRuleTemplate(
  id: string,
  values?: Record<string, number | string>,
): Promise<{ generatedRuleText: string; parse: { rules: ParsedRule[]; unparsedSegments: string[] }; conflicts: RuleConflict[] }> {
  const res = await fetch(`${API_BASE}/rule-templates/${id}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`Failed to apply template: ${res.status}`);
  }
  return (await res.json()) as {
    generatedRuleText: string;
    parse: { rules: ParsedRule[]; unparsedSegments: string[] };
    conflicts: RuleConflict[];
  };
}

export async function parseRules(tenantId: string, ruleText: string): Promise<{
  parse: { rules: ParsedRule[]; ast: RuleDslAst; unparsedSegments: string[] };
  conflicts: RuleConflict[];
  suggestions: RuleSuggestion[];
}> {
  const res = await fetch(`${API_BASE}/rules/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId, ruleText }),
  });
  if (!res.ok) {
    throw new Error(`Failed to parse rules: ${res.status}`);
  }
  return (await res.json()) as {
    parse: { rules: ParsedRule[]; ast: RuleDslAst; unparsedSegments: string[] };
    conflicts: RuleConflict[];
    suggestions: RuleSuggestion[];
  };
}

export async function previewRules(tenantId: string, rules: ParsedRule[]): Promise<{
  preview: {
    affectedListings: number;
    totalListings: number;
    estimatedSpendDeltaPct: number;
    estimatedSalesDeltaPct: number;
    estimatedAcosFrom: number;
    estimatedAcosTo: number;
    examples: Array<{ listingTitle: string; current: string; projected: string }>;
  };
}> {
  const res = await fetch(`${API_BASE}/rules/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId, rules }),
  });
  if (!res.ok) {
    throw new Error(`Failed to preview rules: ${res.status}`);
  }
  return (await res.json()) as {
    preview: {
      affectedListings: number;
      totalListings: number;
      estimatedSpendDeltaPct: number;
      estimatedSalesDeltaPct: number;
      estimatedAcosFrom: number;
      estimatedAcosTo: number;
      examples: Array<{ listingTitle: string; current: string; projected: string }>;
    };
  };
}

export async function listRuleSets(tenantId: string): Promise<RuleSetSummary[]> {
  const res = await fetch(`${API_BASE}/rulesets?tenantId=${encodeURIComponent(tenantId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch rule sets: ${res.status}`);
  }
  const data = (await res.json()) as { items: RuleSetSummary[] };
  return data.items;
}

export async function createRuleSet(payload: {
  tenantId: string;
  name: string;
  description?: string;
  language?: string;
  createdBy: string;
  changeSummary?: string;
  ruleText: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}): Promise<{ item: RuleSetSummary }> {
  const res = await fetch(`${API_BASE}/rulesets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create rule set: ${res.status}`);
  }
  return (await res.json()) as { item: RuleSetSummary };
}

export async function updateRuleSet(
  id: string,
  payload: {
    tenantId: string;
    updatedBy: string;
    ruleText: string;
    changeSummary?: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    name?: string;
    description?: string;
  },
): Promise<{ item: RuleSetSummary }> {
  const res = await fetch(`${API_BASE}/rulesets/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to update rule set: ${res.status}`);
  }
  return (await res.json()) as { item: RuleSetSummary };
}

export async function rollbackRuleSet(
  id: string,
  payload: { tenantId: string; toVersion: number; updatedBy: string; changeSummary?: string },
): Promise<{ item: RuleSetSummary }> {
  const res = await fetch(`${API_BASE}/rulesets/${id}/rollback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to rollback rule set: ${res.status}`);
  }
  return (await res.json()) as { item: RuleSetSummary };
}

export async function compileRuleIntents(payload: {
  tenantId: string;
  target: { type: 'listing' | 'campaign' | 'commodity' | 'product'; id: string };
  ast?: RuleDslAst;
  ruleText?: string;
  runtimeFacts?: Record<string, string | number | boolean | null>;
  execute?: boolean;
}): Promise<{
  intents: Array<{
    intent: {
      intentId: string;
      domain: string;
      action: string;
      target: { type: string; id: string };
      scope: Record<string, string | undefined>;
      payload: Record<string, unknown>;
      risk: { score: number; level: string; violations: string[] };
      reasoning: { summary: string; evidence: Array<{ metric: string; value: string | number }> };
      createdAt: string;
    };
    decision: CompiledIntentDecision;
    condition: {
      expression: string;
      dependencies: string[];
      matched: boolean;
      missingFields: string[];
    };
    decisionToken: string | null;
  }>;
  summary: { total: number; approved: number; rejected: number; queued: number };
  rejected: Array<{
    intentId: string;
    action: string;
    violations: string[];
    conditionMatched: boolean;
    missingFields: string[];
  }>;
  queuedJobs: Array<{ intentId: string; jobId: string }>;
}> {
  const res = await fetch(`${API_BASE}/rules/compile-intents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to compile intents: ${res.status}`);
  }
  return (await res.json()) as {
    intents: Array<{
      intent: {
        intentId: string;
        domain: string;
        action: string;
        target: { type: string; id: string };
        scope: Record<string, string | undefined>;
        payload: Record<string, unknown>;
        risk: { score: number; level: string; violations: string[] };
        reasoning: { summary: string; evidence: Array<{ metric: string; value: string | number }> };
        createdAt: string;
      };
      decision: CompiledIntentDecision;
      condition: {
        expression: string;
        dependencies: string[];
        matched: boolean;
        missingFields: string[];
      };
      decisionToken: string | null;
    }>;
    summary: { total: number; approved: number; rejected: number; queued: number };
    rejected: Array<{
      intentId: string;
      action: string;
      violations: string[];
      conditionMatched: boolean;
      missingFields: string[];
    }>;
    queuedJobs: Array<{ intentId: string; jobId: string }>;
  };
}

// --- Support Cases ---

export interface SupportCaseItem {
  id: string;
  tenantId: string;
  consumerId: string | null;
  commodityId: string;
  channel: string;
  issueType: string | null;
  status: string;
  priority: string;
  agentConfidence: number | null;
  assignedTo: string | null;
  knowledgeWriteback: string | null;
  createdAt: string;
  updatedAt: string;
  consumer: { id: string; email: string; name: string | null } | null;
  commodity: {
    id: string;
    title: string;
    product: { name: string; brand: { name: string } | null };
  };
  _count: { messages: number; mediaAnalyses: number };
}

export interface SupportStats {
  total: number;
  open: number;
  escalated: number;
  closed: number;
}

export async function listSupportCases(
  tenantId: string,
  status?: string,
): Promise<{ cases: SupportCaseItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/support/cases${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch support cases: ${res.status}`);
  return (await res.json()) as { cases: SupportCaseItem[]; nextCursor: string | null };
}

export async function getSupportStats(tenantId: string): Promise<SupportStats> {
  const res = await fetch(`${API_BASE}/support/stats`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch support stats: ${res.status}`);
  return (await res.json()) as SupportStats;
}

export async function getSupportCase(tenantId: string, caseId: string): Promise<{ case: SupportCaseItem & { messages: Array<{ id: string; role: string; contentType: string; content: string; metadata: unknown; createdAt: string }> } }> {
  const res = await fetch(`${API_BASE}/support/cases/${caseId}`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch support case: ${res.status}`);
  return (await res.json()) as { case: SupportCaseItem & { messages: Array<{ id: string; role: string; contentType: string; content: string; metadata: unknown; createdAt: string }> } };
}

export async function replySupportCase(
  tenantId: string,
  caseId: string,
  content: string,
  knowledgeWriteback?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/support/cases/${caseId}/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ content, knowledgeWriteback }),
  });
  if (!res.ok) throw new Error(`Failed to reply to case: ${res.status}`);
}

export async function closeSupportCase(
  tenantId: string,
  caseId: string,
  knowledgeWriteback: string,
  writebackCategory?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/support/cases/${caseId}/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ knowledgeWriteback, ...(writebackCategory ? { writebackCategory } : {}) }),
  });
  if (!res.ok) throw new Error(`Failed to close case: ${res.status}`);
}

// --- Replay Audit ---

export interface ReplayAuditDailyBucket {
  date: string;
  count: number;
}

export interface ReplayAuditRecentEvent {
  id: string;
  eventType: 'NONCE_REPLAY_BLOCKED' | 'NONCE_INVALID_BLOCKED' | 'NONCE_MISSING_BLOCKED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
  details: Record<string, unknown> | null;
}

export interface ReplayAuditReport {
  windowHours: number;
  since: string;
  totalBlocked: number;
  countsByType: Record<string, number>;
  dailyBuckets: ReplayAuditDailyBucket[];
  recent: ReplayAuditRecentEvent[];
}

export interface ReplayAuditSettings {
  tenantId: string;
  threshold: number;
  source: 'TENANT' | 'DEFAULT';
  updatedAt: string | null;
}

export async function getReplayAuditReport(
  tenantId: string,
  hours: number,
): Promise<ReplayAuditReport> {
  const query = new URLSearchParams({
    tenantId,
    hours: String(hours),
  });
  const res = await fetch(`${API_BASE}/security/audit/replay?${query.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay audit report: ${res.status}`);
  }
  return (await res.json()) as ReplayAuditReport;
}

export async function getReplayAuditSettings(tenantId: string): Promise<ReplayAuditSettings> {
  const query = new URLSearchParams({ tenantId });
  const res = await fetch(`${API_BASE}/security/audit/replay/settings?${query.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay audit settings: ${res.status}`);
  }
  return (await res.json()) as ReplayAuditSettings;
}

export async function saveReplayAuditSettings(
  tenantId: string,
  threshold: number,
): Promise<ReplayAuditSettings> {
  const res = await fetch(`${API_BASE}/security/audit/replay/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId, threshold }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save replay audit settings: ${res.status}`);
  }
  return (await res.json()) as ReplayAuditSettings;
}

// ─── Portal Config ───

export interface PortalConfig {
  id: string;
  tenantId: string;
  brandId: string;
  customDomain: string | null;
  themeId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
  supportEmail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string; code: string };
}

export interface PortalFAQ {
  id: string;
  tenantId: string;
  brandId: string;
  commodityId: string | null;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string };
  commodity: { id: string; title: string } | null;
}

export interface QRScanStats {
  total: number;
  days: number;
  bySource: Array<{ source: string; count: number }>;
  byCommodity: Array<{ commodityId: string; count: number; title: string; productName: string }>;
}

export interface BrandSummary {
  id: string;
  name: string;
  code: string;
}

export interface PortalCommoditySummary {
  id: string;
  title: string;
  product: { name: string; brand: { id: string; name: string } };
}

/** @deprecated Use PortalCommoditySummary instead */
export type CommoditySummary = PortalCommoditySummary;

export async function listPortalConfigs(tenantId: string): Promise<{ configs: PortalConfig[] }> {
  const res = await fetch(`${API_BASE}/portal-config/configs`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch portal configs: ${res.status}`);
  return res.json();
}

export async function savePortalConfig(
  tenantId: string,
  brandId: string,
  data: Partial<Omit<PortalConfig, 'id' | 'tenantId' | 'brandId' | 'brand' | 'createdAt' | 'updatedAt'>>,
): Promise<{ config: PortalConfig }> {
  const res = await fetch(`${API_BASE}/portal-config/configs/${brandId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save portal config: ${res.status}`);
  return res.json();
}

export async function listPortalFAQs(
  tenantId: string,
  params?: { brandId?: string; commodityId?: string; limit?: number; cursor?: string },
): Promise<{ faqs: PortalFAQ[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params?.brandId) query.set('brandId', params.brandId);
  if (params?.commodityId) query.set('commodityId', params.commodityId);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/portal-config/faqs${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch FAQs: ${res.status}`);
  return res.json();
}

export async function createPortalFAQ(
  tenantId: string,
  data: { brandId: string; commodityId?: string | null; question: string; answer: string; category?: string | null; sortOrder?: number },
): Promise<{ faq: PortalFAQ }> {
  const res = await fetch(`${API_BASE}/portal-config/faqs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create FAQ: ${res.status}`);
  return res.json();
}

export async function updatePortalFAQ(
  tenantId: string,
  faqId: string,
  data: Partial<{ question: string; answer: string; category: string | null; sortOrder: number; isActive: boolean; commodityId: string | null }>,
): Promise<{ faq: PortalFAQ }> {
  const res = await fetch(`${API_BASE}/portal-config/faqs/${faqId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update FAQ: ${res.status}`);
  return res.json();
}

export async function deletePortalFAQ(tenantId: string, faqId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/portal-config/faqs/${faqId}`, {
    method: 'DELETE',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to delete FAQ: ${res.status}`);
}

export async function getQRScanStats(
  tenantId: string,
  params?: { commodityId?: string; days?: number },
): Promise<QRScanStats> {
  const query = new URLSearchParams();
  if (params?.commodityId) query.set('commodityId', params.commodityId);
  if (params?.days) query.set('days', String(params.days));
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/portal-config/qr-stats${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch QR stats: ${res.status}`);
  return res.json();
}

export async function listBrands(tenantId: string): Promise<{ brands: BrandSummary[] }> {
  const res = await fetch(`${API_BASE}/portal-config/brands`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.status}`);
  return res.json();
}

export async function listCommodities(
  tenantId: string,
  brandId?: string,
): Promise<{ commodities: CommoditySummary[] }> {
  const query = brandId ? `?brandId=${brandId}` : '';
  const res = await fetch(`${API_BASE}/portal-config/commodities${query}`, {
    cache: 'no-store',
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch commodities: ${res.status}`);
  return res.json();
}

// ─── Harness — AI Governance Runtime ──────────────────

export interface FeedbackSignalPayload {
  type: 'accept' | 'reject' | 'modify' | 'rating' | 'resolved';
  sourceRole: 'operator' | 'tenant_admin' | 'consumer';
  priorityClass?: 'SAFETY' | 'EXPERIENCE';
  caseId?: string;
  intentId?: string;
  agentAction: string;
  reason?: string;
  correction?: string;
  rating?: number;
  metadata?: Record<string, unknown>;
}

export async function createFeedbackSignal(
  tenantId: string,
  payload: FeedbackSignalPayload,
): Promise<{ signal: { id: string } }> {
  const res = await fetch(`${API_BASE}/harness/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create feedback signal: ${res.status}`);
  return res.json();
}

export interface KnowledgeEntryPayload {
  source: 'writeback' | 'faq' | 'manual' | 'experience';
  category: string;
  content: string;
  sourceRef?: string;
}

export async function createKnowledgeEntry(
  tenantId: string,
  payload: KnowledgeEntryPayload,
): Promise<{ entry: { id: string } }> {
  const res = await fetch(`${API_BASE}/harness/knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create knowledge entry: ${res.status}`);
  return res.json();
}

export interface TenantMaturityData {
  maturity: {
    maturityScore: number;
    autonomyLevel: string;
    escalationThreshold: number;
    knowledgeScore: number;
    feedbackScore: number;
  };
}

export async function fetchTenantMaturity(tenantId: string): Promise<TenantMaturityData> {
  const res = await fetch(`${API_BASE}/harness/maturity`, {
    headers: { 'x-tenant-id': tenantId },
  });
  if (!res.ok) throw new Error(`Failed to fetch maturity: ${res.status}`);
  return res.json();
}

// ─── L2 Dashboard Stats ──────────────────────────────

export interface DashboardStats {
  kbWritebacks: number;
  autoResolutionRate: number;
  writebackImpactScore: number;
  constitutionHitRate: number;
  feedbackAcceptRate: number;
  csatTrend: { avg: number; count: number };
  totalCases: number;
  escalations: number;
}

export async function fetchDashboardStats(tenantId: string, days = 7): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/harness/stats/dashboard?days=${days}`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch dashboard stats: ${res.status}`);
  return res.json();
}

// ─── L3 Causal Chain ─────────────────────────────────

export interface CausalChainData {
  knowledge: { id: string; content: string; category: string; effectiveWeight: number; impactScore: number; status: string };
  ledgerEntries: {
    id: string;
    caseId: string | null;
    agentAction: string;
    confidenceBefore: number | null;
    confidenceAfter: number | null;
    executionResult: string;
    feedbackType: string | null;
    createdAt: string;
    case: { id: string; status: string; issueType: string | null } | null;
  }[];
  impact: { totalReferences: number; casesResolved: number; casesEscalated: number; resolutionRate: number };
}

/** TODO: Wire to L3 detail page when implemented */
export async function fetchCausalChain(tenantId: string, knowledgeId: string): Promise<CausalChainData> {
  const res = await fetch(`${API_BASE}/harness/causal/chain?knowledgeId=${encodeURIComponent(knowledgeId)}`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch causal chain: ${res.status}`);
  return res.json();
}

// ─── Insight Stream ──────────────────────────────────

export interface InsightStreamData {
  items: {
    id: string;
    timestamp: string;
    icon: string;
    category: string;
    title: string;
    description: string;
  }[];
}

export async function fetchInsightStream(tenantId: string, limit = 10): Promise<InsightStreamData> {
  const res = await fetch(`${API_BASE}/harness/causal/insight-stream?limit=${limit}`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch insight stream: ${res.status}`);
  return res.json();
}

// ─── Drift Detection ──────────────────────────────────

export interface DriftAlert {
  tenantId: string;
  category: string;
  currentAvgImpact: number;
  previousAvgImpact: number;
  driftPct: number;
  entryCount: number;
  detectedAt: string;
}

export async function fetchDriftAlerts(tenantId: string): Promise<{ alerts: DriftAlert[]; detectedAt: string }> {
  const res = await fetch(`${API_BASE}/harness/drift/alerts`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch drift alerts: ${res.status}`);
  return res.json();
}

// ─── Constitution ─────────────────────────────────────

export interface ConstitutionRuleScope {
  platforms?: string[];
}

export interface ConstitutionRule {
  id: string;
  title: string;
  level: 'HARD' | 'STRUCTURAL';
  enabled: boolean;
  kind: 'ALLOWED_ACTIONS' | 'MAX_BID_CHANGE_PCT' | 'MIN_BID_GUARD';
  scope?: ConstitutionRuleScope;
  params: Record<string, unknown>;
}

export interface ConstitutionManifest {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeSummary: string;
  rules: ConstitutionRule[];
}

export interface ConstitutionHistoryEntry {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeSummary: string;
}

export interface ConstitutionSuggestion {
  type: 'new_rule' | 'restrict_action';
  action: string;
  rejectCount: number;
  reason: string;
}

export async function fetchConstitution(tenantId: string): Promise<{ constitution: ConstitutionManifest }> {
  const res = await fetch(`${API_BASE}/constitution`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch constitution: ${res.status}`);
  return res.json();
}

export async function fetchConstitutionHistory(tenantId: string, limit = 20): Promise<{ history: ConstitutionHistoryEntry[] }> {
  const res = await fetch(`${API_BASE}/constitution/history?limit=${limit}`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch constitution history: ${res.status}`);
  return res.json();
}

export async function publishConstitutionRules(
  tenantId: string,
  changeSummary: string,
  rules: ConstitutionRule[],
): Promise<{ constitution: ConstitutionManifest }> {
  const res = await fetch(`${API_BASE}/constitution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ changeSummary, rules }),
  });
  if (!res.ok) throw new Error(`Failed to publish constitution: ${res.status}`);
  return res.json();
}

export async function fetchConstitutionSuggestions(tenantId: string): Promise<{
  suggestions: ConstitutionSuggestion[];
}> {
  const res = await fetch(`${API_BASE}/constitution/suggestions`, {
    headers: { 'x-tenant-id': tenantId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch suggestions: ${res.status}`);
  return res.json();
}

export async function patchTenantMaturity(
  tenantId: string,
  data: { autonomyOverride?: string | null },
): Promise<{ maturity: TenantMaturityData['maturity'] }> {
  const res = await fetch(`${API_BASE}/harness/maturity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update maturity: ${res.status}`);
  return res.json();
}
