import type { UserRole } from '../../components/auth-context';

export const REJECTION_REASONS = [
  { value: 'MARKET_JUDGMENT', label: '市场判断不同', hint: '你了解到 Agent 未掌握的市场信息', labelEn: 'Market judgment differs' },
  { value: 'BAD_TIMING', label: '时机不对', hint: '当前不是执行此操作的最佳时机', labelEn: 'Bad timing' },
  { value: 'INACCURATE_DATA', label: '数据不准', hint: 'Agent 依据的数据可能过时或不完整', labelEn: 'Inaccurate data' },
  { value: 'RISK_TOO_HIGH', label: '风险太高', hint: '潜在损失超出你的风险承受范围', labelEn: 'Risk too high' },
  { value: 'OTHER', label: '其他', hint: '请在下方补充具体原因', labelEn: 'Other' },
] as const;

export type RejectionReasonValue = (typeof REJECTION_REASONS)[number]['value'];

export const IRON_LAW_MESSAGES: Record<UserRole, string> = {
  operator: '⚠ Reject requires reason selection — feeds Layer 7 evolution',
  tenant_admin: '⚠ New agent capabilities default to BLOCK — explicit authorization required',
  system_admin: '⚠ Tenant business data is isolated — only aggregate metrics visible',
  supplier: '⚠ Pricing and margin data is restricted — supplier view only',
  viewer: '⚠ Read-only view — no actions available',
};
