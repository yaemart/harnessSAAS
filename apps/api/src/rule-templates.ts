export interface RuleTemplate {
  id: string;
  category: '投放策略' | '库存联动' | '季节策略' | '风险偏好';
  name: string;
  scenario: string;
  description: string;
  defaultText: string;
  params: Array<{ key: string; label: string; defaultValue: number | string }>;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'aggressive-growth',
    category: '投放策略',
    name: '激进增长型',
    scenario: '新品牌、市场份额优先',
    description: '优先抢量，允许短期 ACoS 提升。',
    defaultText: '新品上架前30天可将ACoS目标放宽到45%，并将出价提高10%。',
    params: [
      { key: 'newProductWindowDays', label: '新品窗口天数', defaultValue: 30 },
      { key: 'acosTarget', label: 'ACoS目标(%)', defaultValue: 45 },
      { key: 'bidDeltaPct', label: '出价变化(%)', defaultValue: 10 },
    ],
  },
  {
    id: 'steady-profit',
    category: '投放策略',
    name: '稳健盈利型',
    scenario: '成熟品牌、利润优先',
    description: '控制波动，持续优化利润。',
    defaultText: '将ACoS控制在32%以内，单次出价调整不超过10%。',
    params: [
      { key: 'acosTarget', label: 'ACoS目标(%)', defaultValue: 32 },
      { key: 'bidDeltaPct', label: '出价变化(%)', defaultValue: 10 },
    ],
  },
  {
    id: 'defensive',
    category: '投放策略',
    name: '保守防御型',
    scenario: '高价值产品、风险敏感',
    description: '保护利润与现金流，避免大波动。',
    defaultText: '高价值商品采用保守模式，ACoS控制在25%以内。',
    params: [{ key: 'acosTarget', label: 'ACoS目标(%)', defaultValue: 25 }],
  },
  {
    id: 'inventory-standard',
    category: '库存联动',
    name: '标准库存保护',
    scenario: '常规补货周期(14-30天)',
    description: '避免断货期广告浪费。',
    defaultText: '库存低于7天时暂停广告，库存恢复至14天后逐步恢复。',
    params: [
      { key: 'pauseThreshold', label: '暂停阈值(天)', defaultValue: 7 },
      { key: 'resumeThreshold', label: '恢复阈值(天)', defaultValue: 14 },
    ],
  },
  {
    id: 'inventory-long-cycle',
    category: '库存联动',
    name: '长周期库存保护',
    scenario: '海运/进口产品(45-90天)',
    description: '针对长补货周期提前收缩风险。',
    defaultText: '库存低于21天时将出价下调15%，低于10天暂停投放。',
    params: [
      { key: 'warningThreshold', label: '预警阈值(天)', defaultValue: 21 },
      { key: 'pauseThreshold', label: '暂停阈值(天)', defaultValue: 10 },
    ],
  },
  {
    id: 'prime-day',
    category: '季节策略',
    name: 'Prime Day 模板',
    scenario: '亚马逊大促',
    description: '预热+爆发双阶段策略。',
    defaultText: 'Prime Day 前7天预热出价+10%，当天放宽ACoS至40%。',
    params: [{ key: 'warmupDays', label: '预热天数', defaultValue: 7 }],
  },
  {
    id: 'q4-peak',
    category: '季节策略',
    name: 'Q4 旺季模板',
    scenario: '黑五/圣诞季',
    description: '旺季流量争夺与库存平衡。',
    defaultText: '旺季期间允许ACoS提高5%，但库存低于10天即暂停投放。',
    params: [{ key: 'inventoryThreshold', label: '库存阈值(天)', defaultValue: 10 }],
  },
  {
    id: 'new-launch',
    category: '投放策略',
    name: '新品冷启动',
    scenario: '新品前30天',
    description: '提高曝光获取首批评价。',
    defaultText: '新品30天内出价+15%，ACoS上限45%。',
    params: [{ key: 'windowDays', label: '窗口天数', defaultValue: 30 }],
  },
  {
    id: 'profit-recovery',
    category: '投放策略',
    name: '利润修复',
    scenario: '利润下滑期',
    description: '快速止损，聚焦高效关键词。',
    defaultText: '当ACoS超过35%时将出价下调12%，并暂停低转化词。',
    params: [{ key: 'acosThreshold', label: 'ACoS阈值(%)', defaultValue: 35 }],
  },
  {
    id: 'risk-averse',
    category: '风险偏好',
    name: '风险敏感模式',
    scenario: '现金流敏感期',
    description: '严格限制单次动作幅度。',
    defaultText: '所有自动出价调整幅度不超过±8%，风险域规则优先级最高。',
    params: [{ key: 'maxDeltaPct', label: '最大调整幅度(%)', defaultValue: 8 }],
  },
];

export function renderTemplate(template: RuleTemplate, values?: Record<string, number | string>): string {
  if (!values) {
    return template.defaultText;
  }

  let text = template.defaultText;
  for (const [key, value] of Object.entries(values)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return text;
}
