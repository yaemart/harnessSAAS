import {
  listSupportCases,
  getSupportCase,
  type SupportCaseItem,
} from './api';

export type {
  ChannelCode,
  ChannelConfig,
  UnifiedTicket,
  UnifiedMessage,
  A2ADetails,
  MediaAnalysisResult,
  CrossChannelKPI,
  ChannelSentiment,
  ProductFeedbackEntry,
  A2AActivityLog,
  WritebackQueueItem,
  InsightStreamItem,
  TicketFilters,
  TicketCounts,
} from './support-types';

import type {
  ChannelConfig,
  UnifiedTicket,
  UnifiedMessage,
  TicketFilters,
  TicketCounts,
} from './support-types';

// ─── Channel System ───

export const CHANNELS: ChannelConfig[] = [
  { code: 'amazon', name: 'Amazon', color: '#FF9900', icon: '📦', connected: true, lastSyncAt: '2026-03-02T14:30:00Z' },
  { code: 'tiktok', name: 'TikTok Shop', color: '#010101', icon: '🎵', connected: true, lastSyncAt: '2026-03-02T14:28:00Z' },
  { code: 'shopee', name: 'Shopee', color: '#EE4D2D', icon: '🛍️', connected: true, lastSyncAt: '2026-03-02T13:45:00Z' },
  { code: 'portal', name: 'Brand Portal', color: 'var(--accent)', icon: '🌐', connected: true, lastSyncAt: '2026-03-02T14:32:00Z' },
  { code: 'walmart', name: 'Walmart', color: '#0071CE', icon: '🏪', connected: true, lastSyncAt: '2026-03-02T14:15:00Z' },
  { code: 'a2a', name: 'A2A Agent', color: '#7C3AED', icon: '🤖', connected: true, lastSyncAt: '2026-03-02T14:31:00Z' },
];

// ─── Mock Tickets ───

const now = new Date('2026-03-02T14:35:00Z');
function ago(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

const MOCK_TICKETS: UnifiedTicket[] = [
  // A2A tickets
  {
    id: 'a2a-001',
    channel: 'a2a',
    consumer: { name: 'ConsumerBot-7', email: 'bot7@a2a.internal' },
    commodity: { id: 'cmd-001', title: 'ChefPro X3 Blender', productName: 'ChefPro X3' },
    issueType: 'refund_request',
    status: 'open',
    priority: 'high',
    agentConfidence: 0.91,
    agentSuggestion: 'Process full refund under warranty. Batch #2847 has known defect rate of 28%.',
    a2aDetails: {
      agentName: 'ConsumerBot-7',
      scope: ['read_order', 'request_refund', 'check_warranty'],
      operationChain: [
        { action: 'read_order', timestamp: ago(5), result: 'Order #ORD-8834 found, delivered 2026-02-15' },
        { action: 'check_warranty', timestamp: ago(4), result: 'Active warranty until 2027-02-15' },
        { action: 'request_refund', timestamp: ago(3), result: 'Pending human confirmation — amount $89.99' },
      ],
      humanConfirmationRequired: true,
    },
    messages: [
      { id: 'a2a-001-m1', role: 'system', contentType: 'text', content: 'A2A session initiated by ConsumerBot-7', createdAt: ago(6) },
      { id: 'a2a-001-m2', role: 'consumer', contentType: 'text', content: 'My consumer wants a refund for ChefPro X3 Blender (Order #ORD-8834). The housing cracked after 2 weeks of normal use.', createdAt: ago(5) },
      { id: 'a2a-001-m3', role: 'agent', contentType: 'text', content: 'Warranty verified. Batch #2847 has a known defect rate of 28%. Recommending full refund of $89.99. Awaiting human confirmation.', confidence: 0.91, createdAt: ago(3) },
    ],
    mediaAnalyses: [{
      id: 'ma-a2a-001',
      sourceType: 'image',
      analysisResult: { damageType: 'housing_crack', location: 'base_unit', severity: 'high', observations: ['Crack along seam line', 'Consistent with batch #2847 defect pattern'], recommendation: 'Replace unit' },
      confidence: 0.94,
      originalDeleted: true,
    }],
    createdAt: ago(6),
    updatedAt: ago(3),
  },
  {
    id: 'a2a-002',
    channel: 'a2a',
    consumer: { name: 'ShopAssist-3', email: 'assist3@a2a.internal' },
    commodity: { id: 'cmd-005', title: 'AeroPress Travel Kit', productName: 'AeroPress' },
    issueType: 'warranty_check',
    status: 'closed',
    priority: 'medium',
    agentConfidence: 0.95,
    agentSuggestion: 'Warranty valid. Seal replacement shipped.',
    knowledgeWriteback: 'AeroPress Travel Kit seal degradation after 6 months of daily use. Replacement seal shipped via standard shipping. Root cause: silicone seal material not rated for repeated hot water exposure above 95°C.',
    a2aDetails: {
      agentName: 'ShopAssist-3',
      scope: ['read_order', 'check_warranty', 'ship_replacement'],
      operationChain: [
        { action: 'read_order', timestamp: ago(120), result: 'Order found' },
        { action: 'check_warranty', timestamp: ago(119), result: 'Active' },
        { action: 'ship_replacement', timestamp: ago(118), result: 'Replacement seal shipped — tracking #TRK-4421' },
      ],
      humanConfirmationRequired: false,
    },
    messages: [
      { id: 'a2a-002-m1', role: 'consumer', contentType: 'text', content: 'Consumer reports AeroPress seal is degraded. Requesting warranty replacement.', createdAt: ago(120) },
      { id: 'a2a-002-m2', role: 'agent', contentType: 'text', content: 'Warranty confirmed. Replacement seal shipped via standard shipping. Tracking: TRK-4421.', confidence: 0.95, createdAt: ago(118) },
      { id: 'a2a-002-m3', role: 'system', contentType: 'text', content: 'Case auto-resolved by ShopAssist-3. Knowledge writeback completed.', createdAt: ago(117) },
    ],
    mediaAnalyses: [],
    createdAt: ago(120),
    updatedAt: ago(117),
  },

  // Amazon tickets
  {
    id: 'amz-001', channel: 'amazon', externalId: 'AMZ-CASE-88341',
    consumer: { name: 'John Doe', email: 'john.doe@email.com' },
    commodity: { id: 'cmd-001', title: 'ChefPro X3 Blender', productName: 'ChefPro X3' },
    issueType: 'product_defect', status: 'human_escalated', priority: 'high', agentConfidence: 0.87,
    agentSuggestion: 'Suggest replacement under warranty. Batch #2847 has elevated defect rate. Offer expedited shipping.',
    messages: [
      { id: 'amz-001-m1', role: 'consumer', contentType: 'text', content: 'My ChefPro X3 blender stopped working after just 2 weeks. The motor makes a grinding noise and the housing has a visible crack.', createdAt: ago(15) },
      { id: 'amz-001-m2', role: 'consumer', contentType: 'image', content: '[Image: cracked blender housing]', createdAt: ago(14) },
      { id: 'amz-001-m3', role: 'agent', contentType: 'text', content: 'I\'m sorry to hear about this issue. Based on the image analysis, this appears to be a housing defect from batch #2847. I recommend a full replacement under warranty with expedited shipping.', confidence: 0.87, createdAt: ago(12) },
      { id: 'amz-001-m4', role: 'consumer', contentType: 'text', content: 'Yes, please send a replacement. Can I get it by this weekend?', createdAt: ago(10) },
    ],
    mediaAnalyses: [{
      id: 'ma-amz-001', sourceType: 'image',
      analysisResult: { damageType: 'housing_crack', location: 'motor_housing', severity: 'high', observations: ['Visible crack on motor housing', 'Batch #2847 pattern match'], recommendation: 'Full replacement' },
      confidence: 0.92, originalDeleted: true,
    }],
    createdAt: ago(15), updatedAt: ago(10),
  },
  {
    id: 'amz-002', channel: 'amazon', externalId: 'AMZ-CASE-88356',
    consumer: { name: 'Sarah Miller', email: 'sarah.m@email.com' },
    commodity: { id: 'cmd-003', title: 'SmartScale Pro', productName: 'SmartScale' },
    issueType: 'shipping_delay', status: 'open', priority: 'medium', agentConfidence: 0.78,
    agentSuggestion: 'Tracking shows package in transit. Expected delivery in 2 days. Offer $5 credit for inconvenience.',
    messages: [
      { id: 'amz-002-m1', role: 'consumer', contentType: 'text', content: 'I ordered the SmartScale Pro 5 days ago and it still hasn\'t arrived. The tracking hasn\'t updated in 3 days.', createdAt: ago(45) },
      { id: 'amz-002-m2', role: 'agent', contentType: 'text', content: 'I\'ve checked the tracking and the package is currently in transit at the regional distribution center. Expected delivery within 2 business days.', confidence: 0.78, createdAt: ago(40) },
    ],
    mediaAnalyses: [], createdAt: ago(45), updatedAt: ago(40),
  },
  {
    id: 'amz-003', channel: 'amazon', externalId: 'AMZ-CASE-88372',
    consumer: { name: 'Mike Chen', email: 'mike.c@email.com' },
    commodity: { id: 'cmd-005', title: 'AeroPress Travel Kit', productName: 'AeroPress' },
    issueType: 'missing_parts', status: 'open', priority: 'medium', agentConfidence: 0.82,
    agentSuggestion: 'Ship missing filter cap. Common issue with recent packaging change.',
    messages: [
      { id: 'amz-003-m1', role: 'consumer', contentType: 'text', content: 'The AeroPress kit arrived but the filter cap is missing from the box.', createdAt: ago(30) },
      { id: 'amz-003-m2', role: 'agent', contentType: 'text', content: 'I apologize for the missing part. This has been reported by a few customers recently. I\'ll ship the filter cap separately with express delivery.', confidence: 0.82, createdAt: ago(25) },
      { id: 'amz-003-m3', role: 'consumer', contentType: 'text', content: 'Thank you, that would be great.', createdAt: ago(20) },
    ],
    mediaAnalyses: [], createdAt: ago(30), updatedAt: ago(20),
  },
  {
    id: 'amz-004', channel: 'amazon', externalId: 'AMZ-CASE-88290',
    consumer: { name: 'Lisa Wang', email: 'lisa.w@email.com' },
    commodity: { id: 'cmd-001', title: 'ChefPro X3 Blender', productName: 'ChefPro X3' },
    issueType: 'product_defect', status: 'closed', priority: 'high', agentConfidence: 0.90,
    knowledgeWriteback: 'ChefPro X3 batch #2847 blade assembly loose after 10 uses. Replacement sent. Escalated to supplier QA team.',
    messages: [
      { id: 'amz-004-m1', role: 'consumer', contentType: 'text', content: 'The blade assembly on my ChefPro X3 is loose and wobbles during operation.', createdAt: ago(180) },
      { id: 'amz-004-m2', role: 'agent', contentType: 'text', content: 'This is a known issue with batch #2847. A replacement unit has been shipped.', confidence: 0.90, createdAt: ago(175) },
      { id: 'amz-004-m3', role: 'operator', contentType: 'text', content: 'Replacement confirmed shipped. Case resolved.', createdAt: ago(170) },
    ],
    mediaAnalyses: [], createdAt: ago(180), updatedAt: ago(170),
  },

  // TikTok Shop tickets
  {
    id: 'tt-001', channel: 'tiktok', externalId: 'TT-MSG-44210',
    consumer: { name: 'Emma Zhang', email: 'emma.z@tiktok.user' },
    commodity: { id: 'cmd-002', title: 'GlowSkin LED Mask', productName: 'GlowSkin' },
    issueType: 'product_inquiry', status: 'open', priority: 'low', agentConfidence: 0.85,
    agentSuggestion: 'LED mask is safe for daily use up to 15 minutes. Share usage guide link.',
    messages: [
      { id: 'tt-001-m1', role: 'consumer', contentType: 'text', content: 'Is it safe to use the GlowSkin LED mask every day? How long should each session be?', createdAt: ago(8) },
      { id: 'tt-001-m2', role: 'agent', contentType: 'text', content: 'Yes, the GlowSkin LED Mask is designed for daily use. We recommend 10-15 minute sessions for optimal results.', confidence: 0.85, createdAt: ago(6) },
    ],
    mediaAnalyses: [], createdAt: ago(8), updatedAt: ago(6),
  },
  {
    id: 'tt-002', channel: 'tiktok', externalId: 'TT-MSG-44198',
    consumer: { name: 'Ryan Park', email: 'ryan.p@tiktok.user' },
    commodity: { id: 'cmd-001', title: 'ChefPro X3 Blender', productName: 'ChefPro X3' },
    issueType: 'return_request', status: 'pending', priority: 'medium', agentConfidence: 0.72,
    agentSuggestion: 'Within 30-day return window. Process return with prepaid label.',
    messages: [
      { id: 'tt-002-m1', role: 'consumer', contentType: 'text', content: 'I want to return the ChefPro X3. It\'s too loud for my apartment.', createdAt: ago(60) },
      { id: 'tt-002-m2', role: 'agent', contentType: 'text', content: 'I understand. You\'re within the 30-day return window. I can generate a prepaid return label for you.', confidence: 0.72, createdAt: ago(55) },
      { id: 'tt-002-m3', role: 'consumer', contentType: 'text', content: 'Yes please, send me the label.', createdAt: ago(50) },
    ],
    mediaAnalyses: [], createdAt: ago(60), updatedAt: ago(50),
  },
  {
    id: 'tt-003', channel: 'tiktok', externalId: 'TT-MSG-44185',
    consumer: { name: 'Sophia Lee', email: 'sophia.l@tiktok.user' },
    commodity: { id: 'cmd-003', title: 'SmartScale Pro', productName: 'SmartScale' },
    issueType: 'connectivity_issue', status: 'open', priority: 'medium', agentConfidence: 0.80,
    agentSuggestion: 'Reset Bluetooth pairing. If persists, firmware update required.',
    messages: [
      { id: 'tt-003-m1', role: 'consumer', contentType: 'text', content: 'My SmartScale won\'t connect to the app via Bluetooth anymore. It was working fine last week.', createdAt: ago(22) },
      { id: 'tt-003-m2', role: 'agent', contentType: 'text', content: 'Please try resetting the Bluetooth pairing: hold the button for 5 seconds until the light flashes blue. Then re-pair in the app.', confidence: 0.80, createdAt: ago(18) },
    ],
    mediaAnalyses: [], createdAt: ago(22), updatedAt: ago(18),
  },

  // Shopee tickets
  {
    id: 'sp-001', channel: 'shopee', externalId: 'SP-CHAT-77120',
    consumer: { name: 'Anh Nguyen', email: 'anh.n@shopee.user' },
    commodity: { id: 'cmd-001', title: 'ChefPro X3 Blender', productName: 'ChefPro X3' },
    issueType: 'product_defect', status: 'human_escalated', priority: 'critical', agentConfidence: 0.65,
    agentSuggestion: 'Electrical issue detected. Safety concern — escalate to QA immediately. Offer full refund.',
    messages: [
      { id: 'sp-001-m1', role: 'consumer', contentType: 'text', content: 'The blender sparked when I turned it on! This is dangerous!', createdAt: ago(3) },
      { id: 'sp-001-m2', role: 'consumer', contentType: 'video', content: '[Video: sparking blender]', createdAt: ago(2) },
      { id: 'sp-001-m3', role: 'agent', contentType: 'text', content: 'This is a serious safety concern. I\'ve escalated this to our QA team immediately. Please stop using the product. A full refund will be processed.', confidence: 0.65, createdAt: ago(1) },
    ],
    mediaAnalyses: [{
      id: 'ma-sp-001', sourceType: 'video',
      analysisResult: { damageType: 'electrical_fault', location: 'power_connection', severity: 'critical', observations: ['Visible sparking at base', 'Possible short circuit'], recommendation: 'Immediate recall assessment for batch' },
      confidence: 0.88, originalDeleted: true,
    }],
    createdAt: ago(3), updatedAt: ago(1),
  },
  {
    id: 'sp-002', channel: 'shopee', externalId: 'SP-CHAT-77098',
    consumer: { name: 'Bao Tran', email: 'bao.t@shopee.user' },
    commodity: { id: 'cmd-004', title: 'EcoBottle Insulated 750ml', productName: 'EcoBottle' },
    issueType: 'quality_complaint', status: 'open', priority: 'low', agentConfidence: 0.88,
    agentSuggestion: 'Color fading is cosmetic only. Offer 15% discount on next purchase.',
    messages: [
      { id: 'sp-002-m1', role: 'consumer', contentType: 'text', content: 'The color on my EcoBottle is fading after just 2 months of use.', createdAt: ago(90) },
      { id: 'sp-002-m2', role: 'agent', contentType: 'text', content: 'I\'m sorry about that. The color fading doesn\'t affect the insulation performance. We\'d like to offer you a 15% discount on your next purchase.', confidence: 0.88, createdAt: ago(85) },
    ],
    mediaAnalyses: [], createdAt: ago(90), updatedAt: ago(85),
  },
  {
    id: 'sp-003', channel: 'shopee', externalId: 'SP-CHAT-77055',
    consumer: { name: 'Linh Pham', email: 'linh.p@shopee.user' },
    commodity: { id: 'cmd-005', title: 'AeroPress Travel Kit', productName: 'AeroPress' },
    issueType: 'usage_question', status: 'closed', priority: 'low', agentConfidence: 0.92,
    knowledgeWriteback: 'AeroPress water temperature FAQ: optimal 80-85°C for light roast, 90-95°C for dark roast. Added to FAQ database.',
    messages: [
      { id: 'sp-003-m1', role: 'consumer', contentType: 'text', content: 'What\'s the best water temperature for the AeroPress?', createdAt: ago(200) },
      { id: 'sp-003-m2', role: 'agent', contentType: 'text', content: 'For light roast coffee, use 80-85°C water. For dark roast, 90-95°C works best. Let the water cool for about 30 seconds after boiling.', confidence: 0.92, createdAt: ago(198) },
      { id: 'sp-003-m3', role: 'consumer', contentType: 'text', content: 'Perfect, thanks!', createdAt: ago(195) },
    ],
    mediaAnalyses: [], createdAt: ago(200), updatedAt: ago(195),
  },

  // Walmart tickets
  {
    id: 'wm-001', channel: 'walmart', externalId: 'WM-TICKET-33210',
    consumer: { name: 'David Johnson', email: 'david.j@email.com' },
    commodity: { id: 'cmd-003', title: 'SmartScale Pro', productName: 'SmartScale' },
    issueType: 'accuracy_complaint', status: 'open', priority: 'medium', agentConfidence: 0.75,
    agentSuggestion: 'Calibration reset instructions. If persists, offer replacement.',
    messages: [
      { id: 'wm-001-m1', role: 'consumer', contentType: 'text', content: 'The SmartScale shows different weights each time I step on it. The readings vary by 2-3 lbs.', createdAt: ago(35) },
      { id: 'wm-001-m2', role: 'agent', contentType: 'text', content: 'Please try recalibrating: place the scale on a hard, flat surface and step on/off 3 times. This resets the sensors.', confidence: 0.75, createdAt: ago(30) },
    ],
    mediaAnalyses: [], createdAt: ago(35), updatedAt: ago(30),
  },
  {
    id: 'wm-002', channel: 'walmart', externalId: 'WM-TICKET-33195',
    consumer: { name: 'Karen White', email: 'karen.w@email.com' },
    commodity: { id: 'cmd-004', title: 'EcoBottle Insulated 750ml', productName: 'EcoBottle' },
    issueType: 'wrong_item', status: 'pending', priority: 'high', agentConfidence: 0.90,
    agentSuggestion: 'Wrong color shipped. Send correct item with prepaid return label for wrong one.',
    messages: [
      { id: 'wm-002-m1', role: 'consumer', contentType: 'text', content: 'I ordered the Midnight Blue EcoBottle but received the Forest Green one instead.', createdAt: ago(70) },
      { id: 'wm-002-m2', role: 'agent', contentType: 'text', content: 'I apologize for the mix-up. I\'ll ship the correct Midnight Blue bottle right away and include a prepaid return label for the wrong one.', confidence: 0.90, createdAt: ago(65) },
      { id: 'wm-002-m3', role: 'consumer', contentType: 'text', content: 'Okay, when will the correct one arrive?', createdAt: ago(60) },
    ],
    mediaAnalyses: [], createdAt: ago(70), updatedAt: ago(60),
  },
];

// ─── Portal Adapter ───

const PORTAL_STATUS_MAP: Record<string, UnifiedTicket['status']> = {
  open: 'open',
  agent_handling: 'open',
  human_escalated: 'human_escalated',
  resolved: 'closed',
  closed: 'closed',
};

const PORTAL_PRIORITY_MAP: Record<string, UnifiedTicket['priority']> = {
  critical: 'critical',
  high: 'high',
  normal: 'medium',
  medium: 'medium',
  low: 'low',
};

function portalCaseToUnifiedTicket(c: SupportCaseItem): UnifiedTicket {
  return {
    id: c.id,
    channel: 'portal',
    consumer: {
      name: c.consumer?.name ?? 'Anonymous Consumer',
      email: c.consumer?.email ?? 'unknown@portal',
    },
    commodity: {
      id: c.commodity.id,
      title: c.commodity.title,
      productName: c.commodity.product.name,
    },
    issueType: c.issueType ?? 'general',
    status: PORTAL_STATUS_MAP[c.status] ?? 'open',
    priority: PORTAL_PRIORITY_MAP[c.priority] ?? 'medium',
    agentConfidence: c.agentConfidence,
    knowledgeWriteback: c.knowledgeWriteback ?? undefined,
    messages: [],
    mediaAnalyses: [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ─── Data Service Functions ───

export function getChannels(): ChannelConfig[] {
  return CHANNELS;
}

const ENABLE_MOCK = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA !== 'false';

export async function listUnifiedTickets(
  tenantId: string,
  filters?: TicketFilters,
): Promise<UnifiedTicket[]> {
  let allTickets = ENABLE_MOCK ? [...MOCK_TICKETS] : [];

  try {
    const portalStatus = filters?.status === 'all' || !filters?.status
      ? undefined
      : filters.status === 'human_escalated' ? 'human_escalated'
      : filters.status === 'closed' ? 'closed'
      : filters.status === 'open' ? 'open'
      : undefined;
    const { cases } = await listSupportCases(tenantId, portalStatus);
    const portalTickets = cases.map(portalCaseToUnifiedTicket);
    allTickets = [...portalTickets, ...allTickets];
  } catch {
    console.error('Failed to fetch Portal cases, showing mock data only');
  }

  if (filters?.status && filters.status !== 'all') {
    allTickets = allTickets.filter(t => t.status === filters.status);
  }
  if (filters?.channels && filters.channels.length > 0) {
    const filterChannels = filters.channels;
    allTickets = allTickets.filter(t => filterChannels.includes(t.channel));
  }

  allTickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return allTickets;
}

export async function getUnifiedTicket(
  tenantId: string,
  id: string,
): Promise<UnifiedTicket | null> {
  if (ENABLE_MOCK) {
    const mockTicket = MOCK_TICKETS.find(t => t.id === id);
    if (mockTicket) return mockTicket;
  }

  try {
    const { case: c } = await getSupportCase(tenantId, id);
    const ticket = portalCaseToUnifiedTicket(c);
    const lastAgentMsg = c.messages.filter(m => m.role === 'agent').at(-1);
    ticket.agentSuggestion = lastAgentMsg?.content;
    const parseConfidence = (meta: unknown): number | undefined => {
      if (meta && typeof meta === 'object' && 'confidence' in meta) {
        const val = (meta as Record<string, unknown>).confidence;
        return typeof val === 'number' ? val : undefined;
      }
      return undefined;
    };
    ticket.agentConfidence = parseConfidence(lastAgentMsg?.metadata) ?? c.agentConfidence;

    const VALID_ROLES: UnifiedMessage['role'][] = ['consumer', 'agent', 'system', 'operator'];
    const VALID_CONTENT_TYPES: UnifiedMessage['contentType'][] = ['text', 'image', 'video', 'media_ref'];
    ticket.messages = c.messages.map(m => ({
      id: m.id,
      role: VALID_ROLES.includes(m.role as UnifiedMessage['role']) ? m.role as UnifiedMessage['role'] : 'consumer',
      contentType: VALID_CONTENT_TYPES.includes(m.contentType as UnifiedMessage['contentType']) ? m.contentType as UnifiedMessage['contentType'] : 'text',
      content: m.content,
      confidence: m.role === 'agent' ? parseConfidence(m.metadata) : undefined,
      createdAt: m.createdAt,
    }));
    return ticket;
  } catch {
    return null;
  }
}

export function computeTicketCounts(tickets: UnifiedTicket[]): TicketCounts {
  return {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    human_escalated: tickets.filter(t => t.status === 'human_escalated').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };
}
