// Shared types for Support Ops and Intelligence modules

export type ChannelCode = 'portal' | 'amazon' | 'tiktok' | 'shopee' | 'walmart' | 'a2a';

export interface ChannelConfig {
  code: ChannelCode;
  name: string;
  color: string;
  icon: string;
  connected: boolean;
  lastSyncAt: string;
}

export interface UnifiedTicket {
  id: string;
  channel: ChannelCode;
  externalId?: string;
  consumer: { name: string; email: string; avatar?: string };
  commodity?: { id: string; title: string; productName: string };
  issueType: string;
  status: 'open' | 'human_escalated' | 'pending' | 'closed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  agentConfidence: number | null;
  agentSuggestion?: string;
  knowledgeWriteback?: string;
  a2aDetails?: A2ADetails;
  messages: UnifiedMessage[];
  mediaAnalyses: MediaAnalysisResult[];
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedMessage {
  id: string;
  role: 'consumer' | 'agent' | 'system' | 'operator';
  contentType: 'text' | 'image' | 'video' | 'media_ref';
  content: string;
  confidence?: number;
  createdAt: string;
}

export interface A2ADetails {
  agentName: string;
  scope: string[];
  operationChain: { action: string; timestamp: string; result: string }[];
  humanConfirmationRequired: boolean;
}

export interface MediaAnalysisResult {
  id: string;
  sourceType: string;
  analysisResult: {
    damageType?: string;
    location?: string;
    severity?: string;
    observations?: string[];
    recommendation?: string;
  };
  confidence: number;
  originalDeleted: boolean;
}

export interface CrossChannelKPI {
  totalCases: number;
  autoResolvedPct: number;
  avgResponseSec: number;
  escalations: number;
  a2aSessions: number;
  kbWritebacks: number;
  trends: {
    totalCases: number;
    autoResolvedPct: number;
    avgResponseSec: number;
    escalations: number;
    a2aSessions: number;
    kbWritebacks: number;
  };
}

export interface CasesBySource {
  channel: ChannelCode;
  channelName: string;
  icon: string;
  count: number;
  pct: number;
}

export interface IssueTypeEntry {
  type: string;
  count: number;
}

export interface ChannelSentiment {
  channel: ChannelCode;
  channelName: string;
  channelColor: string;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}

export interface ProductFeedbackEntry {
  productName: string;
  commodityId: string;
  batchId?: string;
  market?: string;
  totalCases: number;
  defectPct: number;
  status: 'alert_sent' | 'normal' | 'rising';
  statusLabel: string;
}

export interface A2AActivityLog {
  id: string;
  timestamp: string;
  agentName: string;
  title: string;
  description: string;
  statusLabel: string;
  statusType: 'waiting' | 'auto' | 'human_confirmed' | 'read_only';
}

export interface WritebackQueueItem {
  caseId: string;
  caseRef: string;
  channel: ChannelCode;
  productName: string;
  summary: string;
  overdueLabel: string;
  promptQuestion: string;
}

export interface AIInsight {
  id: string;
  severity: 'critical' | 'pattern' | 'opportunity' | 'a2a';
  title: string;
  metric: string;
  description: string;
  actionLabel: string;
}

export interface InsightStreamItem {
  id: string;
  timestamp: string;
  icon: string;
  category: 'product' | 'market' | 'knowledge' | 'a2a' | 'sentiment';
  title: string;
  description: string;
}

export interface TicketFilters {
  status?: 'all' | UnifiedTicket['status'];
  channels?: ChannelCode[];
}

export interface TicketCounts {
  all: number;
  open: number;
  human_escalated: number;
  pending: number;
  closed: number;
}
