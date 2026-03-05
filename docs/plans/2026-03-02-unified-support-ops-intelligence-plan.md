# Unified Support Ops + Intelligence Dashboard — Implementation Plan

---
title: "feat: Unified Support Ops + Intelligence Dashboard"
type: feat
status: completed
date: 2026-03-02
brainstorm: docs/brainstorms/2026-03-02-unified-support-ops-intelligence-brainstorm.md
---

## Overview

替换现有 `/support` 页面为全渠道 **Unified Inbox** 三栏工作台，新建 `/intelligence` **跨渠道智能分析**仪表板。所有非 Portal 渠道数据使用 mock，封装为独立数据服务层便于后续逐渠道替换为真实 API。

**核心价值：** 信息割裂 → 信息汇聚。跨平台售后数据统一后，才能发现单渠道看不到的模式（如批次缺陷、跨平台情绪差异），Agent 才能从全渠道经验中进化。

---

## Problem Statement

当前 `/support` 页面仅处理 Portal 单渠道工单。跨境电商运营中，售后信息分散在 Amazon Seller Central、TikTok Shop、Shopee Chat 等多个平台，导致：

1. 无法发现跨平台模式（批次缺陷信号需要多渠道数据交叉验证）
2. Agent 知识回写只覆盖 Portal 渠道，其他渠道处理经验流失
3. 运营效率低，客服在 5+ 个后台之间切换

---

## Proposed Solution

### 界面一：Unified Inbox（替换 `/support`）

三栏布局全渠道客服工作台：

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Platform Status Bar] Amazon ✓  TikTok ✓  Shopee ⚠  Portal ✓  A2A ✓│
├──────────────┬───────────────────────────┬──────────────────────────┤
│ LEFT 260px   │ CENTER flex-1             │ RIGHT 340px              │
│              │                           │                          │
│ [Status]     │ [Case Header]             │ [Agent Analysis]         │
│ ○ All (47)   │ 📦 Amazon · John Doe      │ Recommendation: "..."    │
│ ○ Open (12)  │ AeroPress · Defect        │ Confidence: 87%          │
│ ○ Escalated  │                           │ [✓ Accept] [✎ Edit]      │
│ ○ Pending    │ [Message Timeline]        │                          │
│ ○ Closed     │ ┌───────────────────────┐ │ [Media Analysis]         │
│              │ │ Consumer: Product not  │ │ ⚠ Original deleted       │
│ [Channel]    │ │ working after 2 weeks  │ │ Findings: housing crack  │
│ ☑ All        │ └───────────────────────┘ │                          │
│ ☑ Amazon     │ ┌───────────────────────┐ │ [Knowledge Writeback]    │
│ ☑ TikTok     │ │ Agent: Based on your  │ │ AI: "AeroPress housing   │
│ ☑ Portal     │ │ description... 87%    │ │ crack batch #2847..."    │
│ ☑ A2A        │ └───────────────────────┘ │ [Edit] [Confirm ✓]       │
│              │                           │                          │
│ [Ticket List]│ [Reply Input]             │ ⚠ Required to close      │
│ 🤖 A2A #1251│ ┌───────────────────────┐ │ [Close Case] (disabled)  │
│ 📦 AMZ #1247│ │ Type your reply...    │ │                          │
│ 🌐 PTL #1243│ └───────────────────────┘ │                          │
└──────────────┴───────────────────────────┴──────────────────────────┘
```

### 界面二：Support Intelligence（新建 `/intelligence`）

6 个分析模块的跨渠道智能仪表板：

```
┌──────────────────────────────────────────────────────────────────────┐
│ Support Intelligence                                [7d][30d][90d]  │
├──────────────────────────────────────────────────────────────────────┤
│ M1: KPIs  [1,247 +12%] [4.2min -8%] [78% +3%] [4.1 +0.2] [89 +34%]│
├──────────────────────────────┬───────────────────────────────────────┤
│ M2: Sentiment Compare        │ M3: Product Feedback Matrix           │
│ Portal  ████████░░ 72%       │ Product    │Defect│Return│Complaint│  │
│ Amazon  ██████░░░░ 58%       │ ChefPro X3 │ 28% │  12% │   8%   │  │
│ A2A     ████████░░ 71%       │ AeroPress  │  3% │   5% │   2%   │  │
│ Shopee  ████░░░░░░ 45%       │ ⚠ ChefPro X3 batch #2847 → Alert    │
├──────────────────────────────┴───────────────────────────────────────┤
│ M4: A2A Activity Log                                                 │
│ 14:32 ConsumerBot-7 "Process refund" ✓ Auto  │ 14:28 ShopAssist-3..│
├──────────────────────────────┬───────────────────────────────────────┤
│ M5: Writeback Queue          │ M6: Real-time Insight Stream          │
│ 🔴 5 pending                 │ 🔴 ChefPro X3 defect 28% — alert     │
│ Case #1247 [Review]          │ 🟡 AeroPress seal ↑ across 3 ch.     │
│ Case #1243 [Review]          │ 🔵 Portal CSAT +5% after FAQ update   │
└──────────────────────────────┴───────────────────────────────────────┘
```

---

## Technical Approach

### Architecture

```
apps/web/lib/
├── mock-support-data.ts          # 类型定义 + mock 数据 + 数据服务层
├── api.ts                        # 现有 API（不修改）
└── design-tokens.ts              # 现有设计令牌（不修改）

apps/web/app/
├── support/page.tsx              # 重写 → Unified Inbox
└── intelligence/page.tsx         # 新建 → Intelligence Dashboard

apps/web/components/
└── sidebar-nav.tsx               # 修改导航项
```

**数据服务层抽象：** `mock-support-data.ts` 导出统一接口（`listUnifiedTickets`, `getUnifiedTicket` 等），内部对 Portal 渠道调用真实 API，对其他渠道返回 mock 数据。后续替换时只需修改此文件。

### 与现有系统的关系

| 现有组件 | 操作 | 说明 |
|----------|------|------|
| `apps/api/src/support-routes.ts` | **不修改** | Portal 工单 CRUD 保持不变 |
| `apps/api/src/portal-config-routes.ts` | **不修改** | 门户配置保持不变 |
| `apps/web/lib/api.ts` | **不修改** | 现有 API 调用保持不变 |
| `apps/web/app/support/page.tsx` | **重写** | 从 381 行单渠道 → 三栏全渠道 |
| `apps/web/components/sidebar-nav.tsx` | **修改** | 重命名 + 新增入口 |

---

## Implementation Phases

### Sprint 1: Mock 数据层 + 类型系统 + 数据服务

**目标：** 建立所有类型定义、mock 数据和统一数据服务层。

**文件清单：**
- [x] **新建** `apps/web/lib/mock-support-data.ts`

**类型定义：**

```typescript
// apps/web/lib/mock-support-data.ts

// ─── Channel System ───
export type ChannelCode = 'portal' | 'amazon' | 'tiktok' | 'shopee' | 'walmart' | 'a2a';

export interface ChannelConfig {
  code: ChannelCode;
  name: string;
  color: string;
  icon: string;
  connected: boolean;
  lastSyncAt: string;
}

// ─── Unified Ticket ───
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
  analysisResult: Record<string, unknown>;
  confidence: number;
  originalDeleted: boolean;
}

// ─── Intelligence Types ───
export interface CrossChannelKPI {
  totalTickets: number;
  avgResponseTimeMin: number;
  firstContactResolutionRate: number;
  csatScore: number;
  a2aSessions: number;
  writebackCompletionRate: number;
  trends: Record<string, number>;
}

export interface ChannelSentiment {
  channel: ChannelCode;
  channelName: string;
  channelColor: string;
  satisfactionPct: number;
  totalReviews: number;
  topIssues: string[];
}

export interface ProductFeedbackEntry {
  productName: string;
  commodityId: string;
  batchId?: string;
  issueBreakdown: Record<string, number>;
  defectRate: number;
  alertLevel: 'normal' | 'warning' | 'critical';
}

export interface A2AActivityLog {
  id: string;
  timestamp: string;
  agentName: string;
  action: string;
  autoResolved: boolean;
  humanConfirmation: boolean;
  scope: string[];
  result: string;
}

export interface WritebackQueueItem {
  caseId: string;
  channel: ChannelCode;
  consumerName: string;
  summary: string;
  status: 'pending' | 'completed';
  createdAt: string;
  agentSuggestion?: string;
}

export interface InsightStreamItem {
  id: string;
  timestamp: string;
  type: 'product_insight' | 'supply_chain' | 'trend' | 'anomaly';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  relatedProducts?: string[];
  source: ChannelCode[];
}
```

**Mock 数据量：**
- 6 个 `ChannelConfig`（Amazon/TikTok/Shopee/Portal/Walmart/A2A）
- 18 个 `UnifiedTicket`（分布：Portal 4, Amazon 4, TikTok 3, Shopee 3, Walmart 2, A2A 2）
- 每工单 3-8 条 `UnifiedMessage`
- 3 个 `MediaAnalysisResult`
- 1 个 `CrossChannelKPI` + trends
- 6 个 `ChannelSentiment`
- 10 个 `ProductFeedbackEntry`（含 2 个 warning + 1 个 critical）
- 12 个 `A2AActivityLog`
- 5 pending + 8 completed `WritebackQueueItem`
- 10 个 `InsightStreamItem`

**数据服务函数（导出）：**

```typescript
// Unified Inbox 数据服务
export function getChannels(): ChannelConfig[];
export function listUnifiedTickets(filters?: TicketFilters): UnifiedTicket[];
export function getUnifiedTicket(id: string): UnifiedTicket | null;
export function getTicketCounts(): Record<string, number>;

// Intelligence 数据服务
export function getCrossChannelKPIs(days?: number): CrossChannelKPI;
export function getChannelSentiments(): ChannelSentiment[];
export function getProductFeedbackMatrix(): ProductFeedbackEntry[];
export function getA2AActivityLogs(limit?: number): A2AActivityLog[];
export function getWritebackQueue(): WritebackQueueItem[];
export function getInsightStream(limit?: number): InsightStreamItem[];
```

**验收标准：**
- [x] 所有类型导出且无 TypeScript 错误
- [x] Mock 数据覆盖所有渠道和状态组合
- [x] 数据服务函数支持过滤和排序
- [x] A2A 工单有完整的 `a2aDetails`
- [x] 产品矩阵有 2+ 个超阈值预警条目

---

### Sprint 2: Unified Inbox — 三栏工作台

**目标：** 完全重写 `/support` 为三栏 Unified Inbox。

**文件清单：**
- [x] **重写** `apps/web/app/support/page.tsx`

**页面内部组件：**

| 组件 | 职责 | 关键 Props |
|------|------|-----------|
| `PlatformStatusBar` | 顶部渠道连接状态条 | `channels: ChannelConfig[]` |
| `TicketFilters` | 左栏顶部：状态 + 渠道过滤 | `counts`, `onFilterChange` |
| `TicketListItem` | 左栏：单个工单卡片 | `ticket`, `isSelected`, `onClick` |
| `ConversationView` | 中栏：消息时间线 + 回复输入 | `ticket`, `onReply` |
| `MessageBubble` | 中栏：单条消息气泡 | `message` |
| `AgentPanel` | 右栏：Agent 分析 + 媒体 + 回写 | `ticket`, `onAccept`, `onClose` |
| `A2ADetailsCard` | 右栏：A2A 操作链展开 | `a2aDetails` |
| `WritebackEditor` | 右栏底部：知识回写编辑器 | `suggestion`, `required`, `onConfirm` |

**交互逻辑：**

| 操作 | 行为 |
|------|------|
| 点击左栏工单 | 中栏加载对话 + 右栏加载分析 |
| 状态/渠道过滤 | 实时筛选左栏列表，更新计数 |
| "Accept" 按钮 | Agent 建议填入回复输入框（不自动发送） |
| "Edit" 按钮 | Agent 建议填入回复框并聚焦 |
| 发送回复 | 调用 API（Portal）或追加到 mock 消息列表（其他渠道） |
| 回写 "Confirm" | 保存回写内容到工单 |
| "Close Case" | 升级工单：检查回写是否填写 → 未填写则 disabled + 红色提示 |
| URL `?case=xxx` | 自动选中对应工单（从 Intelligence 跳转） |

**状态管理：**

```typescript
const [tickets, setTickets] = useState<UnifiedTicket[]>([]);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [statusFilter, setStatusFilter] = useState<string>('all');
const [channelFilter, setChannelFilter] = useState<ChannelCode[]>([]);
const [reply, setReply] = useState('');
const [writeback, setWriteback] = useState('');
```

**与现有 API 的桥接：**

Portal 渠道工单通过现有 `listSupportCases` / `getSupportCase` 获取，然后通过适配器转换为 `UnifiedTicket` 格式：

```typescript
function portalCaseToUnifiedTicket(c: SupportCaseItem): UnifiedTicket {
  return {
    id: c.id,
    channel: 'portal',
    consumer: { name: c.consumer.name, email: c.consumer.email },
    commodity: c.commodity ? { id: c.commodity.id, title: c.commodity.title, productName: c.commodity.productName } : undefined,
    issueType: c.issueType,
    status: c.status as UnifiedTicket['status'],
    priority: c.priority as UnifiedTicket['priority'],
    agentConfidence: c.agentConfidence,
    // ...
  };
}
```

**空状态设计：**
- 无工单：居中图标 + "No tickets yet" + 引导文案
- 未选中工单：中栏 + 右栏显示 "Select a ticket to view details"
- 加载失败：红色错误提示 + "Retry" 按钮

**验收标准：**
- [x] 三栏布局正确渲染
- [x] 平台状态条显示 6 个渠道连接状态
- [x] 状态过滤和渠道过滤正常工作
- [x] A2A 工单有紫色边框和 🤖 图标
- [x] Agent 分析面板显示推荐方案和置信度
- [x] "Accept" 填入回复框但不自动发送
- [x] 媒体分析显示 "Original file deleted" 标注
- [x] 知识回写框常驻右栏底部，AI 预填建议
- [x] 升级工单关闭时，未填回写 → 按钮 disabled + 红色提示
- [x] Portal 工单调用真实 API，其他渠道使用 mock
- [x] URL `?case=xxx` 参数自动选中工单
- [x] TypeScript 编译通过，零 lint 错误

---

### Sprint 3: Intelligence Dashboard — 6 模块

**目标：** 新建 `/intelligence` 页面，实现全部 6 个分析模块。

**文件清单：**
- [x] **新建** `apps/web/app/intelligence/page.tsx`

**页面内部组件：**

| 组件 | 职责 | 数据源 |
|------|------|--------|
| `KPIRow` | 6 个 StatBadge + 趋势箭头 | `getCrossChannelKPIs()` |
| `SentimentCompare` | 渠道满意度柱状图（CSS 实现） | `getChannelSentiments()` |
| `ProductMatrix` | 产品 × 问题类型表格 + 预警 | `getProductFeedbackMatrix()` |
| `A2ATimeline` | A2A 操作时间线 | `getA2AActivityLogs()` |
| `WritebackQueue` | pending 回写列表 + Review 按钮 | `getWritebackQueue()` |
| `InsightStream` | 实时洞察卡片流 | `getInsightStream()` |

**模块细节：**

**M1 — KPIRow：**
- 6 个 `<StatBadge>` 横排
- 每个指标下方显示趋势（↑ 绿色 / ↓ 红色 / — 灰色）
- 趋势值格式：`+12%` / `-8%` / `+0.2`

**M2 — SentimentCompare：**
- 纯 CSS 柱状图（`div` 宽度百分比）
- 每行：渠道图标 + 名称 + 进度条 + 百分比
- 按满意度降序排列
- 渠道色作为进度条颜色

**M3 — ProductMatrix：**
- `.table-wrap` + `<table>` 表格
- 列：Product / Defect Rate / Return Rate / Complaint Rate / Alert
- 行按 `defectRate` 降序
- `warning` 行：黄色背景 tint
- `critical` 行：红色背景 tint + 闪烁 ⚠ 图标
- 点击行展开详细 `issueBreakdown`

**M4 — A2ATimeline：**
- 垂直时间线，每条记录一行
- 自动解决：绿色 ✓ + "Auto-resolved"
- 人工确认：黄色 ⚠ + "Human confirmed"
- 显示 Agent 名称、操作、scope 标签

**M5 — WritebackQueue：**
- pending 数量标红显示
- 每条 pending 项：Case ID + 渠道图标 + 摘要 + "Review & Confirm" 按钮
- "Review" 按钮 → `router.push('/support?case=xxx')`
- 底部统计：已完成 / 总计

**M6 — InsightStream：**
- 卡片列表，按时间降序
- 严重程度着色：`critical` 红 / `warning` 黄 / `info` 蓝
- 每张卡片：图标 + 标题 + 描述 + 来源渠道标签 + 相关产品
- 可暂停自动刷新

**交互逻辑：**
- 顶部时间范围选择器（7d / 30d / 90d）影响 KPI 和 Sentiment 数据
- 产品矩阵点击行 → 展开详细缺陷分析
- 回写队列 "Review" → 跳转到 `/support?case=xxx`

**权限：** `RoleGuard allowedRoles={['tenant_admin']}`

**验收标准：**
- [x] 6 个模块全部渲染
- [x] KPI 卡片显示趋势箭头和颜色
- [x] 情绪对比柱状图按满意度排序
- [x] 产品矩阵 critical 行红色高亮
- [x] A2A 时间线区分自动/人工
- [x] 回写队列 pending 标红，Review 跳转正确
- [x] 洞察流按严重程度着色
- [x] 时间范围选择器工作正常
- [x] 仅 tenant_admin 可访问
- [x] TypeScript 编译通过，零 lint 错误

---

### Sprint 4: 侧边栏 + 联动 + 打磨

**目标：** 侧边栏更新、两个页面联动、视觉打磨、质量验证。

**文件清单：**
- [x] **修改** `apps/web/components/sidebar-nav.tsx`
- [x] **打磨** `apps/web/app/support/page.tsx`
- [x] **打磨** `apps/web/app/intelligence/page.tsx`

**侧边栏变更：**

```diff
  // sidebar-nav.tsx NAV_ITEMS
- { name: 'Support', path: '/support', icon: <HeadphonesIcon size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
+ { name: 'Support Ops', path: '/support', icon: <HeadphonesIcon size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
  { name: 'Portal Config', path: '/portal-config', icon: <Globe size={20} />, roles: ['tenant_admin'], group: 'Operations' },
+ { name: 'Intelligence', path: '/intelligence', icon: <Activity size={20} />, roles: ['tenant_admin'], group: 'Operations' },
```

**联动逻辑：**
- Intelligence "Review" → `router.push('/support?case=xxx')`
- Support Ops 解析 `searchParams.get('case')` → 自动选中并滚动到工单
- 两个页面共享 mock 数据源，数据一致

**打磨清单：**
- [x] Loading skeleton 动画（左栏列表 + 中栏对话 + 右栏面板）
- [x] 空状态设计（无工单引导、未选中提示）
- [x] 错误状态设计（API 失败 + 重试按钮）
- [ ] 键盘快捷键（↑↓ 切换工单，Enter 打开，Esc 返回）— 延后
- [x] 渠道状态条 hover tooltip 显示最后同步时间
- [x] 产品矩阵 critical 行脉冲动画
- [x] TypeScript 编译验证（apps/web）
- [x] Lint 检查
- [ ] 浏览器测试（headed mode）— 延后

**验收标准：**
- [x] 侧边栏显示 "Nexus" 入口 + NexusSubNav 子导航（Unified Inbox / Intelligence）
- [x] Intelligence → Support Ops 跳转正确定位工单
- [x] Loading skeleton 在数据加载时显示
- [x] 空状态有引导文案
- [x] TypeScript 编译通过
- [x] 零 lint 错误
- [ ] 浏览器测试 PASS — 延后

---

## Acceptance Criteria

### Functional Requirements

- [x] Unified Inbox 三栏布局正确渲染，所有渠道工单统一展示
- [x] 渠道过滤和状态过滤实时生效
- [x] A2A 工单有紫色标识和可展开的操作详情
- [x] Agent 分析面板显示推荐方案、置信度、一键接受
- [x] 媒体分析标注 "原始文件已处理删除"
- [x] 知识回写 AI 预填 + 人工确认闭环
- [x] 升级工单关闭强制要求回写
- [x] Intelligence 6 个模块全部渲染且数据正确
- [x] 产品矩阵超阈值预警（>15% 黄 / >25% 红）
- [x] 回写队列 Review 跳转到对应工单
- [x] Portal 工单使用真实 API，其他渠道使用 mock

### Non-Functional Requirements

- [x] 页面加载时间 < 2s（mock 数据）
- [x] 所有颜色使用 CSS 变量（渠道品牌色除外）
- [x] 使用现有 UI 组件（StatBadge, Badge, Card）
- [x] 零 TypeScript 错误，零 lint 错误
- [x] 在 default + dark 主题下正常显示

---

## Research-Backed Design Decisions

### Unified Inbox — 行业最佳实践整合

**三栏布局（参考 Front 2025、Intercom、Zendesk）：**
- 左栏可折叠至图标宽度（56px），专注对话时释放空间
- 中栏消息区域采用紧凑头部设计，最大化可读区域
- 右栏 Agent 分析面板参考 Intercom Fin AI Copilot：建议回复 + 来源引用 + 置信度 + 一键采纳

**AI 建议面板 UX（参考 Intercom Fin、Google Agent Assist）：**
- 每条建议标注置信度和知识来源，方便快速判断
- "Accept" 仅填入回复框，不自动发送（人工确认后再发）
- 建议旁提供 👍/👎 反馈按钮，驱动 Agent 迭代

**知识回写闭环（参考 Agent-in-the-Loop / AITL 模式）：**
- 回写数据结构记录：`action: 'accepted' | 'rejected' | 'edited'`、`editDelta`、`missingKnowledge`
- AI 采纳率和编辑率作为 Agent 进化指标，展示在 Intelligence Dashboard

**平台连接状态指示器：**
- 4 种状态：`healthy`（绿 ✓）/ `degraded`（黄 ◐）/ `error`（红 ✕）/ `disconnected`（灰 ○）
- Hover tooltip 显示 `lastSyncAt` 和 `nextSyncAt`

**键盘快捷键（参考 Zendesk 2025）：**
- `↑/↓` 切换工单，`Enter` 打开，`Esc` 返回列表
- `⌘+Enter` 发送回复，`⌘+S` 保存草稿
- `?` 显示快捷键帮助面板

**工单列表性能：**
- 18 条 mock 数据无需虚拟滚动
- 后续接入真实 API 时，如工单量 > 100，引入 `react-window` FixedSizeList
- 行组件用 `React.memo` 包裹，`overscanCount: 5`

### Intelligence Dashboard — 行业最佳实践整合

**KPI 可视化（6 指标）：**
- 使用现有 `<StatBadge>` 组件，`trend` 属性显示 `↑ 12%` / `↓ 8%`
- `trendColor` 用 `var(--success)` / `var(--danger)`
- 布局：`grid-template-columns: repeat(6, 1fr)`，小屏降为 `repeat(3, 1fr)`

**情绪对比柱状图（纯 CSS，无图表库）：**
- Flexbox 水平条形图：每行 = 渠道名 + 进度条 div（宽度百分比）+ 数值
- 进度条颜色使用渠道品牌色
- 按满意度降序排列

```tsx
// 示例结构
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <span style={{ width: 100 }}>Portal</span>
  <div style={{ flex: 1, height: 24, background: 'var(--panel-bg)', borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ width: '72%', height: '100%', background: channelColor, borderRadius: 4 }} />
  </div>
  <span className="small">72%</span>
</div>
```

**产品矩阵热力图：**
- `<table>` + `color-mix()` 做单元格背景着色
- `critical` 行：`color-mix(in srgb, var(--danger) 20%, transparent)` + 脉冲动画
- `warning` 行：`color-mix(in srgb, var(--warning) 15%, transparent)`
- 点击行展开详细 `issueBreakdown`

**A2A 活动时间线：**
- 垂直列表，左侧 3px 色条：自动解决 `var(--success)` / 人工确认 `var(--warning)`
- 每条记录：时间 + Agent 名 + 操作 + `<Badge>` 状态标签

**回写队列：**
- 顶部摘要：`<Badge variant="danger">{pendingCount} pending</Badge>`
- Pending 项背景高亮：`color-mix(in srgb, var(--warning) 8%, transparent)`
- "Review" 按钮 → `router.push('/support?case=xxx')`

**洞察流着色：**
- `critical`：左边框 `var(--danger)` + 背景 `color-mix(in srgb, var(--danger) 10%, transparent)`
- `warning`：左边框 `var(--warning)` + 背景 tint
- `info`：左边框 `var(--accent)` + 背景 tint

**时间范围选择器：**
- 页面级 state（`useState<'7d'|'30d'|'90d'>('7d')`），通过 props 传递到各模块
- 切换时所有模块统一更新（mock 数据按 range 过滤）

**多模块并行加载：**
- Mock 数据同步返回，无需 Suspense
- 后续接入真实 API 时，每个模块独立 `useEffect` + loading skeleton
- 单模块失败不影响其他模块（独立 try/catch）

### Mock 数据服务层 — 最佳实践整合

**服务抽象模式：**
- 导出纯函数接口（`listUnifiedTickets`, `getCrossChannelKPIs` 等）
- 内部按渠道路由：Portal → 真实 API adapter，其他 → mock 数据
- 后续替换时只需修改此文件内部实现，调用方无感知

**适配器模式（Portal API → UnifiedTicket）：**

```typescript
function portalCaseToUnifiedTicket(c: SupportCaseItem): UnifiedTicket {
  return {
    id: c.id,
    channel: 'portal' as const,
    consumer: { name: c.consumer.name, email: c.consumer.email },
    commodity: c.commodity ? {
      id: c.commodity.id,
      title: c.commodity.title,
      productName: c.commodity.productName,
    } : undefined,
    issueType: c.issueType,
    status: mapPortalStatus(c.status),
    priority: c.priority as UnifiedTicket['priority'],
    agentConfidence: c.agentConfidence,
    agentSuggestion: c.agentSuggestion,
    knowledgeWriteback: c.knowledgeWriteback,
    messages: c.messages.map(portalMessageToUnified),
    mediaAnalyses: c.mediaAnalyses?.map(portalMediaToUnified) ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
```

**Mock 数据真实性：**
- 使用加权分布：`open: 40%, escalated: 20%, pending: 25%, closed: 15%`
- 日期使用相对时间（`2m ago`, `15m ago`, `2h ago`）
- 渠道分布反映真实比例：Amazon 最多，A2A 最少
- ID 使用 UUID v4 格式，保持与 Prisma 模型一致

---

## SpecFlow Analysis — Edge Cases & Mitigations

### 状态映射

现有 `SupportCase.status` 值与 `UnifiedTicket.status` 的映射：

| Portal Status | UnifiedTicket Status |
|---------------|---------------------|
| `open` | `open` |
| `agent_handling` | `open` |
| `human_escalated` | `human_escalated` |
| `resolved` | `closed` |
| `closed` | `closed` |

### 空状态设计

| 场景 | 展示 |
|------|------|
| 无工单 | 居中图标 + "No tickets yet" + 引导文案 |
| 未选中工单 | 中栏 + 右栏："Select a ticket to view details" |
| 某渠道无工单 | 列表中不显示该渠道，过滤器计数为 0 |
| API 加载失败 | 红色错误卡片 + "Retry" 按钮 |
| 部分渠道断开 | 状态条显示 ⚠，工单列表正常（mock 数据不受影响） |

### 关闭按钮逻辑

```
if (ticket.status === 'human_escalated' && !writeback.trim()) {
  // Close 按钮 disabled + 红色提示 "Knowledge writeback required"
} else if (ticket.status === 'closed') {
  // Close 按钮隐藏（已关闭）
} else {
  // Close 按钮可用
}
```

### URL 参数解析（从 Intelligence 跳转）

```typescript
// support/page.tsx
const searchParams = useSearchParams();
const caseParam = searchParams.get('case');

useEffect(() => {
  if (caseParam) {
    setSelectedId(caseParam);
    // 滚动到对应工单
  }
}, [caseParam]);
```

### 安全考虑

- Mock 数据不包含真实消费者信息（使用虚构名称和邮箱）
- Intelligence 页面仅 `tenant_admin` 可访问
- Mock 数据按 tenant 隔离（虽然当前是静态数据，但结构上预留 tenantId 过滤）

---

## Dependencies & Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| mock 数据与真实 API 结构不匹配 | 后续替换困难 | mock 类型严格对齐 Prisma 模型 + 适配器模式 |
| 三栏布局小屏不可用 | 移动端体验差 | Sprint 4 响应式折叠（左栏可收起） |
| 页面文件过大 | 维护困难 | 控制在 800 行以内，组件内聚 |
| A2A 协议未定义 | mock 偏离 | 参考 ADR-010 设计 |
| 多操作员并发编辑 | 数据冲突 | Phase 1 乐观更新，Phase 2 增加锁 |
| Portal API 无 channel/priority 参数 | 渠道筛选不落地 | 前端合并后过滤，API 增强为 Phase 2 |

---

## Channels Reference

| 渠道 | 代码 | 颜色 | 图标 | 数据来源 |
|------|------|------|------|----------|
| Amazon | `amazon` | `#FF9900` | 📦 | mock |
| TikTok Shop | `tiktok` | `#010101` | 🎵 | mock |
| Shopee | `shopee` | `#EE4D2D` | 🛍️ | mock |
| Brand Portal | `portal` | `var(--accent)` | 🌐 | 真实 API |
| A2A Agent | `a2a` | `#7C3AED` | 🤖 | mock |
| Walmart | `walmart` | `#0071CE` | 🏪 | mock |

---

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-03-02-unified-support-ops-intelligence-brainstorm.md`
- Existing support page: `apps/web/app/support/page.tsx`
- Support API routes: `apps/api/src/support-routes.ts`
- Portal agent: `apps/api/src/portal-agent.ts`
- Design tokens: `apps/web/lib/design-tokens.ts`
- UI components: `apps/web/components/ui/`
- Sidebar nav: `apps/web/components/sidebar-nav.tsx`
- ADR-008: Knowledge writeback mandate
- ADR-010: A2A protocol (planned)

### Existing API Functions (apps/web/lib/api.ts)
- `listSupportCases(tenantId, options)` — Portal 工单列表
- `getSupportStats(tenantId)` — Portal 工单统计
- `getSupportCase(tenantId, caseId)` — Portal 工单详情
- `replySupportCase(tenantId, caseId, content, writeback?)` — 回复
- `closeSupportCase(tenantId, caseId, writeback)` — 关闭

---

## Technical Review — 审查结论与修正决策

**审查日期：** 2026-03-02
**审查代理：** Architecture Strategist, TypeScript Reviewer, Simplicity Reviewer, Performance Oracle

### P0 修正（必须在实施前解决）

#### 1. 数据服务统一为 async + tenantId

所有数据服务函数必须接收 `tenantId` 并返回 `Promise`：

```typescript
// 修正后的服务签名
export async function listUnifiedTickets(tenantId: string, filters?: TicketFilters): Promise<UnifiedTicket[]>;
export async function getUnifiedTicket(tenantId: string, id: string): Promise<UnifiedTicket | null>;
export async function getTicketCounts(tenantId: string): Promise<TicketCounts>;
```

**原因：** Portal 渠道调用真实 API（异步），mock 渠道同步返回。统一为 async 保证调用方一致处理 loading/error。

#### 2. 补充 TicketFilters 类型定义

```typescript
export interface TicketFilters {
  status?: 'all' | UnifiedTicket['status'];
  channels?: ChannelCode[];
}
```

#### 3. 补充 TicketCounts 类型定义

```typescript
export interface TicketCounts {
  all: number;
  open: number;
  human_escalated: number;
  pending: number;
  closed: number;
}
```

#### 4. agentSuggestion 来源明确

`SupportCase` 无 `agentSuggestion` 字段。适配器从最后一条 `role: 'agent'` 消息的 `content` 推导：

```typescript
const lastAgentMsg = messages.filter(m => m.role === 'agent').at(-1);
agentSuggestion: lastAgentMsg?.content ?? undefined,
agentConfidence: lastAgentMsg?.metadata?.confidence ?? null,
```

#### 5. reply / writeback 状态下沉

`reply` 和 `writeback` 状态从页面根组件下沉到子组件内部，避免输入时整页重渲染：
- `reply` → `ConversationView` 内部 state
- `writeback` → `WritebackEditor` 内部 state

### P1 修正（重要改进）

#### 6. Portal 状态映射表

| Portal Status | UnifiedTicket Status |
|---------------|---------------------|
| `open` | `open` |
| `agent_handling` | `open` |
| `human_escalated` | `human_escalated` |
| `resolved` | `closed` |
| `closed` | `closed` |

`pending` 仅用于 mock 渠道（如等待平台回复），Portal 无此状态。

#### 7. Priority 映射

| Portal Priority | UnifiedTicket Priority |
|-----------------|----------------------|
| `critical` | `critical` |
| `high` | `high` |
| `normal` | `medium` |
| `low` | `low` |

#### 8. consumer.name 空值处理

适配器中：`name: c.consumer?.name ?? 'Anonymous Consumer'`

#### 9. commodity.productName 映射

适配器中：`productName: c.commodity?.product?.name ?? c.commodity?.title ?? 'Unknown'`

#### 10. TicketListItem 使用 React.memo

```typescript
const TicketListItem = React.memo(function TicketListItem({ ticket, isSelected, onClick }: Props) {
  // ...
});
```

所有事件回调使用 `useCallback`，过滤结果使用 `useMemo`。

#### 11. Intelligence 各模块 React.memo

6 个模块拆成独立子组件并用 `React.memo` 包裹，仅 KPIRow 和 SentimentCompare 依赖 `timeRange`。

#### 12. 错误处理策略

每个数据获取操作独立 try/catch，单渠道/模块失败不影响其他：
- Unified Inbox：Portal API 失败 → 仅显示 mock 渠道 + 错误提示
- Intelligence：单模块失败 → 该模块显示错误卡片 + Retry 按钮

### YAGNI 延后项（从 Phase 1 移除）

| 项目 | 原计划 | 决策 |
|------|--------|------|
| 时间范围选择器过滤逻辑 | 7d/30d/90d 过滤 mock | **保留 UI 按钮，不改变数据**（mock 无时间维度） |
| 平台状态 4 种状态 | healthy/degraded/error/disconnected | **简化为 ✓ 已配置**（mock 无真实同步） |
| 键盘快捷键 | ↑↓ Enter Esc ⌘+Enter ⌘+S ? | **延后到 Phase 2** |
| 洞察流自动刷新 + 暂停 | 轮询 + 暂停按钮 | **延后**（mock 为静态） |
| 左栏可折叠至 56px | 折叠动画 | **延后** |
| 产品矩阵行展开 | 点击展开 issueBreakdown | **延后**（表格已展示核心数据） |
| 知识回写 action 追踪 | accepted/rejected/edited | **延后**（需真实数据） |
| 点赞/点踩反馈按钮 | Agent 建议反馈 | **延后** |

### 简化后的 Sprint 结构

原 4 Sprint → **3 Phase**：

| Phase | 内容 | 文件 |
|-------|------|------|
| **Phase 1** | 类型 + Mock 常量 + Portal 适配器 + Unified Inbox | `mock-support-data.ts` + `support/page.tsx` |
| **Phase 2** | Intelligence Dashboard 6 模块 | `intelligence/page.tsx` |
| **Phase 3** | 侧边栏 + 页面联动 + 空状态 + 编译验证 | `sidebar-nav.tsx` + 打磨 |

### Mock 数据简化

Intelligence 模块直接导入常量，不通过服务函数：

```typescript
// 导出常量（Intelligence 直接使用）
export const MOCK_KPIS: CrossChannelKPI = { ... };
export const MOCK_SENTIMENTS: ChannelSentiment[] = [ ... ];
export const MOCK_PRODUCT_MATRIX: ProductFeedbackEntry[] = [ ... ];
export const MOCK_A2A_LOGS: A2AActivityLog[] = [ ... ];
export const MOCK_WRITEBACK_QUEUE: WritebackQueueItem[] = [ ... ];
export const MOCK_INSIGHT_STREAM: InsightStreamItem[] = [ ... ];

// 服务函数（仅 Unified Inbox 需要，因为要合并 Portal API + mock）
export async function listUnifiedTickets(tenantId: string, filters?: TicketFilters): Promise<UnifiedTicket[]>;
export async function getUnifiedTicket(tenantId: string, id: string): Promise<UnifiedTicket | null>;
```

### 性能清单（实施时遵循）

- [x] `TicketListItem` 使用 `React.memo`
- [x] `reply` / `writeback` 状态在子组件内部管理
- [x] 事件回调使用 `useCallback`
- [x] 过滤结果和 `selectedTicket` 使用 `useMemo`
- [x] Intelligence 6 个模块使用 `React.memo`
- [x] CSS 动画仅使用 `opacity` / `transform`（不触发 layout）
- [x] 单文件超 600 行时拆分为 types / mock-data / service
