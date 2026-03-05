import type {
  CrossChannelKPI,
  CasesBySource,
  IssueTypeEntry,
  ChannelSentiment,
  ProductFeedbackEntry,
  AIInsight,
  WritebackQueueItem,
  A2AActivityLog,
  InsightStreamItem,
} from './support-types';

const now = new Date('2026-03-02T14:35:00Z');
function ago(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export const MOCK_KPIS: CrossChannelKPI = {
  totalCases: 1247,
  autoResolvedPct: 83,
  avgResponseSec: 4.2,
  escalations: 214,
  a2aSessions: 38,
  kbWritebacks: 89,
  trends: {
    totalCases: 0.12,
    autoResolvedPct: 0.06,
    avgResponseSec: 0,
    escalations: -0.08,
    a2aSessions: 0,
    kbWritebacks: 0,
  },
};

export const MOCK_CASES_BY_SOURCE: CasesBySource[] = [
  { channel: 'amazon', channelName: 'Amazon US', icon: '📦', count: 561, pct: 45 },
  { channel: 'portal', channelName: 'Brand Portal', icon: '🌐', count: 299, pct: 24 },
  { channel: 'shopee', channelName: 'Shopee MY', icon: '🛍️', count: 224, pct: 18 },
  { channel: 'tiktok', channelName: 'TikTok Shop', icon: '🎵', count: 125, pct: 10 },
  { channel: 'a2a', channelName: 'A2A Agents', icon: '🤖', count: 38, pct: 3 },
];

export const MOCK_ISSUE_TYPES: IssueTypeEntry[] = [
  { type: 'Product Defect', count: 312 },
  { type: 'How-to / Setup', count: 287 },
  { type: 'Return Request', count: 198 },
  { type: 'Warranty Claim', count: 156 },
  { type: 'Logistics / Delivery', count: 134 },
  { type: 'Compatibility', count: 89 },
  { type: 'Safety Concern', count: 52 },
  { type: 'Other', count: 19 },
];

export const MOCK_SENTIMENTS: ChannelSentiment[] = [
  { channel: 'amazon', channelName: 'Amazon', channelColor: '#FF9900', positivePct: 58, neutralPct: 22, negativePct: 20 },
  { channel: 'portal', channelName: 'Portal', channelColor: 'var(--accent)', positivePct: 72, neutralPct: 18, negativePct: 10 },
  { channel: 'tiktok', channelName: 'TikTok', channelColor: '#010101', positivePct: 64, neutralPct: 15, negativePct: 21 },
  { channel: 'shopee', channelName: 'Shopee', channelColor: '#EE4D2D', positivePct: 45, neutralPct: 25, negativePct: 30 },
];

export const MOCK_PRODUCT_FEEDBACK: ProductFeedbackEntry[] = [
  { productName: 'ChefPro X3', commodityId: 'cmd-001', batchId: 'Heating batch BN-24-09', totalCases: 87, defectPct: 28, status: 'alert_sent', statusLabel: '⚠ Alert Sent' },
  { productName: 'SoundPod Pro', commodityId: 'cmd-011', market: 'All markets', totalCases: 43, defectPct: 8, status: 'normal', statusLabel: '✓ Normal' },
  { productName: 'AirSense 2', commodityId: 'cmd-012', market: 'DE Market', totalCases: 31, defectPct: 16, status: 'rising', statusLabel: '↑ Rising' },
];

export const MOCK_AI_INSIGHTS: AIInsight[] = [
  {
    id: 'ai-01', severity: 'critical', title: 'Batch defect detected', metric: '87 cases',
    description: 'ChefPro X3 batch BN-24-09 showing 28% defect rate in heating element. Recommend pause sales + notify supplier.',
    actionLabel: '→ Alert sourcing team',
  },
  {
    id: 'ai-02', severity: 'pattern', title: 'Shopee MY rising complaints', metric: '+40%',
    description: 'Shopee MY negative sentiment up 40% this month. Primary driver: delivery time expectations vs actual performance.',
    actionLabel: '→ Review logistics partner',
  },
  {
    id: 'ai-03', severity: 'opportunity', title: 'FAQ gap — pairing issues', metric: '56 cases',
    description: '56 "how to pair" cases this month — all resolved by same Agent response. Add to FAQ to reduce future load.',
    actionLabel: '→ Auto-add to FAQ',
  },
  {
    id: 'ai-04', severity: 'a2a', title: 'A2A auto-resolution rate', metric: '79%',
    description: 'Consumer agents resolving 79% of cases without human intervention. Human gates triggered 8 times this month.',
    actionLabel: '→ View A2A audit log',
  },
];

export const MOCK_WRITEBACK_QUEUE: WritebackQueueItem[] = [
  {
    caseId: 'wb-01', caseRef: '#CS-2847', channel: 'amazon', productName: 'ChefPro X3',
    summary: 'Heating element defect — replacement + voucher issued',
    overdueLabel: 'Overdue 2h', promptQuestion: 'Why this decision? Agent needs to learn...',
  },
  {
    caseId: 'wb-02', caseRef: '#CS-2831', channel: 'tiktok', productName: 'AirSense 2',
    summary: 'Smell complaint — safety escalation to QC team',
    overdueLabel: 'Overdue 4h', promptQuestion: 'Why escalated to safety? Agent needs context...',
  },
];

export const MOCK_A2A_LOGS: A2AActivityLog[] = [
  {
    id: 'a2a-log-01', timestamp: ago(5), agentName: 'Claude Agent',
    title: 'Warranty replacement — SoundPod Pro #4521',
    description: 'Agent verified order, confirmed defect via structured analysis, requested replacement. Awaiting resolution selection.',
    statusLabel: '⏳ Awaiting Human Gate — $0 (within auto limit)',
    statusType: 'waiting',
  },
  {
    id: 'a2a-log-02', timestamp: ago(120), agentName: 'GPT Agent',
    title: 'FAQ query — ChefPro X3 cooking times',
    description: 'Agent queried manual via MCP get_manual tool. Returned cooking time data. No human involvement needed.',
    statusLabel: '✓ Auto-resolved · 0.8s',
    statusType: 'auto',
  },
  {
    id: 'a2a-log-03', timestamp: ago(360), agentName: 'Custom Agent',
    title: 'Refund request — $87 — ChefPro X3',
    description: 'Agent submitted refund request. Amount exceeds $50 auto-limit. Human confirmation requested → Consumer confirmed via push notification.',
    statusLabel: '✓ Human confirmed · Refund processed',
    statusType: 'human_confirmed',
  },
  {
    id: 'a2a-log-04', timestamp: ago(1440), agentName: 'Claude Agent',
    title: 'Warranty status check — AirSense 2',
    description: 'Read-only query via check_warranty_status. Returned status + coverage details. No action taken.',
    statusLabel: '✓ Read-only · No human needed',
    statusType: 'read_only',
  },
];

export const MOCK_INSIGHT_STREAM: InsightStreamItem[] = [
  {
    id: 'stream-01', timestamp: ago(120), icon: '🔴', category: 'product',
    title: 'ChefPro X3 — Batch alert escalated to sourcing',
    description: '87 defect reports in 30D exceed 15% threshold. Supplier notified automatically.',
  },
  {
    id: 'stream-02', timestamp: ago(360), icon: '💡', category: 'knowledge',
    title: 'New FAQ entry added',
    description: '"How to pair SoundPod Pro with iPhone" added from 56 repeated cases. Agent auto-resolution rate for this issue now 100%.',
  },
  {
    id: 'stream-03', timestamp: ago(720), icon: '📈', category: 'market',
    title: 'AirSense 2 — DE market complaints rising',
    description: 'Smell complaints up 3x vs last month. Cross-referenced with same batch used in UK market (no reports). DE-specific.',
  },
  {
    id: 'stream-04', timestamp: ago(1440), icon: '🧠', category: 'knowledge',
    title: 'Knowledge base updated',
    description: '12 new writeback entries this week. Agent E3 error code resolution improved from 71% to 94% auto-resolution rate.',
  },
  {
    id: 'stream-05', timestamp: ago(1440), icon: '🤖', category: 'a2a',
    title: 'A2A channel growing',
    description: '38 sessions this month (new). 79% resolved without human. Human gates triggered appropriately 8 times (all payment-related).',
  },
  {
    id: 'stream-06', timestamp: ago(1440), icon: '⭐', category: 'sentiment',
    title: 'Brand Portal sentiment highest across all channels',
    description: '72% positive vs Amazon 58%, Shopee 45%. Portal customers more engaged and loyal post-support.',
  },
];
