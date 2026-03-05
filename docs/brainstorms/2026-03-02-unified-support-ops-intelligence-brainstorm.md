# Unified Support Ops + Intelligence Dashboard

**Date:** 2026-03-02
**Status:** approved
**Approach:** Full-build with mock data, replace `/support`, new `/intelligence`

---

## What We're Building

两个核心界面，将割裂的多渠道售后信息汇聚为统一的运营工作台和智能分析中心。

### 界面一：Unified Inbox（替换 `/support`）

**三栏布局**的全渠道客服工作台：

| 区域 | 内容 |
|------|------|
| **顶部状态条** | 各平台实时连接状态（Amazon ✓ / TikTok Shop ✓ / Shopee ⚠ / Portal ✓ / A2A ✓），同步时间 |
| **左栏：工单列表** | 所有渠道工单统一排列，渠道图标标识，优先级排序，状态过滤（Open/Escalated/Pending/Closed），A2A 工单紫色标识 |
| **中栏：对话流** | 选中工单的完整消息时间线，支持文本/图片/视频消息，Agent 自动回复带置信度标签，人工回复输入框 |
| **右栏：Agent 分析面板** | Agent 推荐方案 + 置信度，一键接受按钮；媒体分析结果（标注"原始文件已处理删除，仅保留结构化信息"）；**知识回写框**（AI 预填 + 人工确认，常驻底部，未填写时关闭按钮置灰） |

**关键交互：**
- 渠道过滤器：可选单渠道或全部
- A2A 工单展开显示消费者 Agent 的操作详情（scope、操作链、确认节点）
- 知识回写闭环：Agent 自动生成回写建议 → 人工确认/编辑 → 提交后工单才能关闭
- 工单关闭时，升级工单必须有回写内容（已有后端逻辑）

### 界面二：Support Intelligence（新建 `/intelligence`）

**6 个模块**的跨渠道智能分析仪表板：

| 模块 | 内容 |
|------|------|
| **1. 跨渠道 KPI 卡片** | 6 个指标横跨所有渠道：总工单数、平均响应时间、首次解决率、CSAT 评分、A2A 会话数、知识回写完成率 |
| **2. 平台情绪对比** | 各渠道满意度对比柱状图（Portal 72% vs Amazon 58% vs Shopee 45% 等），直观说明自有门户价值 |
| **3. 产品反馈矩阵** | 产品 × 问题类型热力图，缺陷率超阈值触发供应商预警标红，批次追踪 |
| **4. A2A 活动日志** | 时间线：自动解决 vs 触发人类确认节点，完整审计链，scope 声明 |
| **5. 知识回写队列** | pending 回写标红显示，已完成回写统计，Agent 等待养料的提示 |
| **6. 实时信息流** | 从全渠道数据提炼的产品洞察，反哺选品和供应链的建议流 |

---

## Why This Approach

### 信息汇聚的核心价值

> 信息割裂不利系统进化

当前系统的 `/support` 页面仅处理 Portal 单渠道工单。但真实的跨境电商运营中，售后信息分散在 Amazon Seller Central、TikTok Shop 后台、Shopee Chat 等多个平台。这些信息孤岛导致：

1. **无法发现跨平台模式** — 某批次产品在 Amazon 退货率高 + Shopee 差评多 = 供应链缺陷信号，但分开看不到
2. **Agent 无法进化** — 知识回写只覆盖 Portal 渠道，其他渠道的处理经验流失
3. **运营效率低** — 客服需要在 5+ 个后台之间切换

### 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据来源 | 全部 mock，封装为独立模块 | 先验证 UI 和交互，后续逐个接入真实 API |
| 布局 | 三栏（列表/对话/分析） | 行业标准客服工作台模式，效率最高 |
| 知识回写 | AI 预填 + 内联常驻 | 降低填写成本，同时保证闭环 |
| 替换策略 | 替换 `/support`，新建 `/intelligence` | 避免功能重复，统一入口 |
| Intelligence 范围 | 6 模块全部实现 | 需求明确，mock 驱动下工作量可控 |

---

## Key Decisions

1. **替换 `/support` 而非新建** — Unified Inbox 是 `/support` 的超集，保留旧页面会造成混乱
2. **mock 数据独立模块** — `apps/web/lib/mock-support-data.ts` 封装所有 mock 数据和类型，后续替换时只改导入源
3. **渠道标识系统** — 每个渠道有唯一颜色 + 图标（Amazon 橙 / TikTok 黑 / Shopee 橙红 / Portal 蓝 / A2A 紫）
4. **A2A 工单特殊处理** — 紫色标识 + 展开显示 Agent 操作链 + scope 声明
5. **知识回写 AI 预填** — Agent 分析面板底部常驻回写框，自动生成建议，人工确认后提交
6. **产品反馈矩阵阈值** — 缺陷率 > 15% 黄色预警，> 25% 红色预警 + 供应商通知
7. **侧边栏导航更新** — `/support` 改名为 "Support Ops"，新增 "Intelligence" 入口
8. **设计系统合规** — 所有颜色使用 CSS 变量，使用现有 UI 组件（StatBadge, Badge, Card）

---

## Scope — Files to Create/Modify

### 新建文件
- `apps/web/lib/mock-support-data.ts` — mock 数据 + 类型定义
- `apps/web/app/intelligence/page.tsx` — Intelligence Dashboard

### 修改文件
- `apps/web/app/support/page.tsx` — 完全重写为 Unified Inbox
- `apps/web/components/sidebar-nav.tsx` — 更新导航项名称和新增入口

### 不修改的文件
- `apps/api/src/support-routes.ts` — 后端 API 保持不变（已有完整的工单 CRUD）
- `apps/api/src/portal-config-routes.ts` — 保持不变
- `apps/web/lib/api.ts` — 现有 API 调用保持不变，mock 数据层独立

---

## Open Questions

（无 — 所有关键决策已在对话中确认）

---

## Channels Reference

| 渠道 | 代码 | 颜色 | 图标 | 数据来源 |
|------|------|------|------|----------|
| Amazon | `amazon` | `#FF9900` | 📦 | mock（未来 SP-API） |
| TikTok Shop | `tiktok` | `#010101` | 🎵 | mock（未来 TikTok API） |
| Shopee | `shopee` | `#EE4D2D` | 🛍️ | mock（未来 Shopee API） |
| Brand Portal | `portal` | `var(--accent)` | 🌐 | 真实数据（已有 API） |
| A2A Agent | `a2a` | `#7C3AED` | 🤖 | mock（未来 A2A Protocol） |
| Walmart | `walmart` | `#0071CE` | 🏪 | mock（未来 Walmart API） |
