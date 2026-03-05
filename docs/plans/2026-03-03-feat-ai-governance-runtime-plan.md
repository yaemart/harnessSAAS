---
title: "feat: AI Governance Runtime — Intent Pipeline, Knowledge Injection, Decay Engine"
type: feat
status: completed
date: 2026-03-03
brainstorm: docs/brainstorms/2026-03-02-harness-engineering-framework-brainstorm.md
---

# AI Governance Runtime — 从数据管道到治理运行时

## Overview

将已建好的数据管道（KnowledgeEntry、FeedbackSignal、ConfidenceLedger、TenantMaturity 四表 + CRUD API + UI 闭环）升级为完整的 **AI Governance Runtime**。

当前状态：养分可以写入，但 Agent 不消费、不学习、不衰减、不校准。
目标状态：Agent 每个决策都经过标准管线，知识自动注入，置信度持续校准，养分自动代谢。

## Problem Statement

| 断层 | 影响 |
|------|------|
| Agent 不读 KnowledgeEntry | Writeback 写了但 Agent 不引用，Operator 看不到效果 → 停止供给 |
| ConfidenceLedger 只读无写 | 无审计记录，L3 因果链无数据源 |
| Portal Agent 无 Intent 概念 | FeedbackSignal.intentId 恒 null，Ledger 无法关联 |
| 无衰减引擎 | 知识库 2 年后被历史噪音淹没 |
| TenantMaturity 不驱动 Agent | 冷启动和成熟期逻辑写死 |
| L2/L3 用 mock 数据 | 供给者看不到真实效果 |

## Technical Approach

### Architecture

```
Portal Agent (portal-agent.ts)
  │
  ├── handleConsumerMessage()
  │     ├── [NEW] loadTenantKnowledge()     ← KnowledgeEntry 注入
  │     ├── [NEW] loadTenantMaturity()       ← 读取 AAL/阈值
  │     ├── buildSystemPrompt()              ← 已有，增强知识注入
  │     ├── ModelRouter.call()               ← 已有
  │     ├── extractConfidence()              ← 已有
  │     ├── [NEW] writeConfidenceLedger()    ← 每次回复写 Ledger
  │     └── [EXISTING] escalateToHuman()     ← 阈值由 TMS 驱动
  │
  └── [NEW] handleFeedbackUpdate()
        ├── 读取 FeedbackSignal
        ├── 更新 ConfidenceLedger.feedbackType/After
        └── 更新 KnowledgeEntry.impactScore
```

### ERD — 新增关联

```mermaid
erDiagram
    SupportCase ||--o{ ConfidenceLedger : "caseId"
    SupportCase ||--o{ FeedbackSignal : "caseId"
    SupportCase ||--o{ KnowledgeEntry : "sourceRef"
    
    KnowledgeEntry ||--o{ ConfidenceLedger : "knowledgeUsed[]"
    FeedbackSignal ||--o{ ConfidenceLedger : "feedbackType (async)"
    
    TenantMaturity ||--|| Tenant : "tenantId"
    TenantMaturity ..> ConfidenceLedger : "drives thresholds"
    
    ConfidenceLedger }o--|| Tenant : "tenantId"
    KnowledgeEntry }o--|| Tenant : "tenantId"
    FeedbackSignal }o--|| Tenant : "tenantId"
```

### Implementation Phases

---

#### Phase 1: Knowledge Injection + Ledger Write（Agent 开始学习）

**目标：** Agent 消费 KnowledgeEntry，每次回复写入 ConfidenceLedger。这是整个系统的心脏。

**任务：**

- [x] **1.1** `apps/api/src/portal-agent.ts` — `loadTenantKnowledge(tenantId, category?, limit=5)`
  - 查询 `KnowledgeEntry` WHERE `tenantId` AND `status = 'ACTIVE'` ORDER BY `effectiveWeight DESC`
  - 可选按 `category` 过滤（匹配工单 issueType）
  - 返回 top-K 条目的 `{ id, content, effectiveWeight }`
  - 调用 `prisma.knowledgeEntry.updateMany()` 批量 increment `usageCount` + set `lastUsedAt`

- [x] **1.2** `apps/api/src/portal-agent.ts` — `buildSystemPrompt()` 增强
  - 在 system prompt 中注入 `## Relevant Knowledge` 段落
  - 格式：`[KE-{id}] (weight: {w}): {content}`
  - Agent 回复中引用知识时标注 `[KE-xxx]`（用于 Ledger 追踪）

- [x] **1.3** `apps/api/src/portal-agent.ts` — `writeConfidenceLedger()`
  - 在 `handleConsumerMessage` 的每次 LLM 回复后调用
  - 写入字段：`tenantId`, `caseId`, `agentAction: 'chat_reply'`, `confidenceBefore`, `knowledgeUsed[]`, `knowledgeWeights[]`, `ruleResult: 'pass'`, `authorityLevel: 'auto'`, `executionResult: 'success'`
  - `ruleTriggered`: 空（Portal 域暂无 Constitution 规则）
  - `tenantMaturityScore`: 从 TenantMaturity 读取
  - `agentAutonomyLevel`: 从 TenantMaturity 读取

- [x] **1.4** `apps/api/src/portal-agent.ts` — `escalateToHuman()` 阈值动态化
  - 当前硬编码 `escalationThreshold`（从 PolicyConfig 读取）
  - 改为优先读取 `TenantMaturity.escalationThreshold`，fallback 到 PolicyConfig
  - 升级时写入 Ledger：`executionResult: 'escalated'`

- [x] **1.5** `apps/api/src/harness-ledger-service.ts` — Ledger 写入服务（新文件）
  - `writeConfidenceLedger(payload)`: try/catch + console.error（不抛出，保证 fire-and-forget）
  - portal-agent 通过 import 调用，agent-py 未来通过 API 调用
  - 失败时记录到 `SecurityAuditEvent`（已有表）作为 dead-letter

**验收标准：**
- [x] Agent 回复包含从 KnowledgeEntry 注入的知识
- [x] 每次 Agent 回复在 ConfidenceLedger 中有记录
- [x] `GET /harness/ledger?caseId=xxx` 返回该工单的完整决策链
- [x] 升级阈值由 TenantMaturity 驱动

---

#### Phase 2: Feedback → Ledger 闭环（Agent 开始校准）

**目标：** Operator 的 Accept/Reject 反馈回写到 ConfidenceLedger，形成 `confidenceBefore → feedback → confidenceAfter` 闭环。

**任务：**

- [x] **2.1** `apps/api/src/harness-routes.ts` — FeedbackSignal 创建后触发 Ledger 更新
  - `POST /harness/feedback` 成功后，查找关联的 ConfidenceLedger（by `caseId`，最近一条 `feedbackType IS NULL`）
  - 更新：`feedbackType`, `feedbackReason`, `feedbackSourceRole`, `feedbackAt`
  - 计算 `confidenceAfter = confidenceBefore + delta`
    - accept: `+0.05`
    - reject: `-0.10`
    - modify: `-0.03`

- [x] **2.2** `apps/api/src/harness-routes.ts` — FeedbackSignal 创建后更新 KnowledgeEntry
  - 如果 Ledger 中 `knowledgeUsed` 非空：
    - accept → 对引用的 KnowledgeEntry increment `impactScore` by `+0.1`
    - reject → decrement `impactScore` by `-0.15`
  - 这形成了知识的正/负反馈循环

- [x] **2.3** `apps/web/app/support/page.tsx` — AgentPanel 增加 Modify 按钮
  - Accept / Reject 已有，增加 Modify：打开编辑框修改建议内容
  - 修改后发送 `type: 'modify'`, `correction: '修改后的内容'`
  - Toast: "✓ 修正已记录，Agent 将在类似场景中引用"

- [x] **2.4** `apps/api/src/support-routes.ts` — 关单事务化（从 Phase 6 提前）
  - `POST /cases/:id/close` 用 Prisma `$transaction` 包裹：
    - 创建 KnowledgeEntry（如有 writeback）
    - 更新 SupportCase status/closedAt/resolvedAt
    - 写入 ConfidenceLedger（executionResult: 'success', agentAction: 'case_close'）
  - 任一失败则全部回滚
  - 前端改为只调用 close endpoint，不再单独调用 createKnowledgeEntry

**验收标准：**
- [x] Accept 后 Ledger 的 `confidenceAfter` = `confidenceBefore + 0.05`
- [x] Reject 后关联 KnowledgeEntry 的 `impactScore` 下降
- [x] 连续 3 次 reject 同一知识 → `effectiveWeight` 显著下降
- [x] 关单 + writeback + ledger 在同一事务中，任一失败全部回滚

---

#### Phase 3: Decay & Drift Engine（知识自动代谢）

**目标：** 定时任务自动计算衰减权重，检测漂移，管理知识生命周期。

**任务：**

- [x] **3.1** `apps/api/src/harness-decay-engine.ts` — 新文件
  - `recalculateWeights(tenantId?)` — 每日运行
    - 遍历所有 ACTIVE/DECAYING 的 KnowledgeEntry
    - **简化公式**：`effectiveWeight = 1.0 × Math.exp(-decayRate × daysSinceLastUsed)`
    - `usageBoost` 和 `feedbackModifier` 延后（feedback 继续只影响 `impactScore`）
    - 按 tenantId 分片处理，避免单 job 过大
    - 批量更新 `effectiveWeight`

  - `transitionLifecycle()` — 每周运行（同一 job 内按 `dayOfWeek === 1` 分支）
    - `effectiveWeight < 0.1` AND `status = 'ACTIVE'` → `DECAYING`
    - `effectiveWeight < 0.05` AND `status = 'DECAYING'` → `DORMANT`
    - `status = 'DORMANT'` AND `updatedAt < 60 days ago` → `ARCHIVED`

  - `detectDrift()` — **延后**（需至少 60 天数据才有意义，Phase 5b 再实现）

- [x] **3.2** `apps/api/src/queue.ts` — 注册定时任务
  - **合并为 1 个** pg-boss `schedule`: `harness:decay:daily` (每日 03:00 UTC)
  - 内部按 `dayOfWeek` 分支执行 lifecycle 转换

- [x] **3.3** `apps/api/src/harness-routes.ts` — Admin 手动触发
  - `POST /harness/knowledge/recalculate` — 手动触发权重重算（system_admin only）

**验收标准：**
- [x] 90 天未引用的知识 `effectiveWeight` 降至 < 0.5
- [x] DECAYING 状态的知识不再被 Agent 优先引用（weight 低于 ACTIVE 条目）
- [x] DORMANT 60 天后自动 ARCHIVED
- [x] Admin 可通过 `POST /harness/knowledge/recalculate` 手动触发重算

---

#### Phase 4: TenantMaturity ↔ Agent Autonomy（动态自主权）

**目标：** TMS 每日重算，驱动 AAL 动态调节，影响 Agent 行为。

**任务：**

- [x] **4.1** `apps/api/src/harness-maturity-engine.ts` — 新文件
  - `recalculateTMS(tenantId)`:
    ```
    // Phase 4 简化版：2 维模型（ruleScore/historyScore 延后）
    knowledgeScore = min(1.0, activeKnowledgeEntries / 30)
    feedbackScore  = min(1.0, positiveFeedbackCount / 50)
    TMS = 0.5 * knowledgeScore + 0.5 * feedbackScore
    ```
  - `deriveAAL(tms)`:
    - 0.0–0.2 → GUIDED (escalationThreshold: 0.9)
    - 0.2–0.5 → ASSISTED (escalationThreshold: 0.75)
    - 0.5–0.8 → SUPERVISED (escalationThreshold: 0.6)
    - 0.8–1.0 → AUTONOMOUS (escalationThreshold: 0.4)
  - 如果 `autonomyOverride` 存在且 < 计算值，使用 override
  - AAL 变更时 → 更新 TenantMaturity 记录（SSE 通知延后）

- [x] **4.2** `apps/api/src/queue.ts` — 注册定时任务
  - pg-boss `schedule`: `harness:maturity:daily` (每日 02:00 UTC)

- [x] **4.3** `apps/api/src/portal-agent.ts` — 集成 TMS
  - `loadAgentPolicy()` 增加读取 `TenantMaturity`
  - `escalationThreshold` 从 TMS 驱动
  - 低 AAL 时 system prompt 增加 "Always ask for human confirmation" 指令

- [x] **4.4** `apps/web/app/support/page.tsx` — AAL 指示器
  - AgentPanel 顶部显示当前 AAL 级别 badge
  - 如 "L2 Assisted · TMS 0.35"

**验收标准：**
- [x] 新租户 TMS = 0.0，AAL = GUIDED
- [x] 写入 30 条 KnowledgeEntry + 50 条正向 FeedbackSignal → TMS ≈ 1.0
- [x] AAL 升级后 Admin 在 AgentPanel 可见新级别
- [x] Agent 在 GUIDED 模式下 escalationThreshold = 0.9

---

#### Phase 5: L2 Dashboard + L3 Causal Chain（供给者看到效果）

**目标：** Intelligence Dashboard 从真实数据驱动，因果链可追溯。

**任务：**

- [x] **5.1** `apps/api/src/harness-routes.ts` — L2 统计端点
  - `GET /harness/stats/dashboard` 返回：
    - `kbWritebacks`: 本周 KnowledgeEntry count (source='writeback')
    - `autoResolutionRate`: SupportCase closed without escalation / total
    - `writebackImpactScore`: avg impactScore of writebacks used in last 7 days
    - `constitutionHitRate`: ConfidenceLedger where ruleTriggered.length > 0 / total
    - `rejectionLearningRate`: 被 reject 后同类 intent 的 accept rate 变化
    - `csatTrend`: FeedbackSignal type='rating' avg rating over time

- [x] **5.2** `apps/web/app/intelligence/page.tsx` — 替换 mock 数据
  - KPI 行从 `MOCK_KPIS` 改为调用 `/harness/stats/dashboard`
  - 保留 mock 作为 fallback（`NEXT_PUBLIC_ENABLE_MOCK_DATA`）

- [x] **5.3** `apps/api/src/harness-routes.ts` — L3 因果链端点
  - `GET /harness/causal-chain?knowledgeId=xxx` 返回：
    - KnowledgeEntry 详情
    - 引用此知识的 ConfidenceLedger 列表
    - 关联的 SupportCase 结果（resolved/escalated）
    - 计算 impact: 引用前后的 autoResolutionRate 变化
  - `GET /harness/insight-stream?limit=10` 返回最近的因果链事件

- [x] **5.4** `apps/web/app/intelligence/page.tsx` — Insight Stream 真实数据
  - BottomInsightStream 组件从 `/harness/insight-stream` 获取数据
  - 每条 insight 可点击展开完整因果链

- [x] **5.5** Consumer Chat 反馈
  - `apps/portal/components/screen-chat.tsx` — Chat 结束后弹出 "问题解决了吗？" [👍] [👎]
    - 👍 → `POST /harness/feedback` type='resolved', sourceRole='consumer'
    - 👎 → `POST /harness/feedback` type='resolved', rating=1 + 自动升级
  - Rate limit: 每个 consumerId + caseId 只允许 1 次评价

**验收标准：**
- [x] Intelligence Dashboard KPI 从真实数据驱动
- [x] 因果链可从 KnowledgeEntry → Ledger → Case 完整追溯
- [x] Consumer 👎 触发自动升级
- [x] Insight Stream 展示真实事件而非 mock

---

#### Phase 5b: FAQ 反馈 + Drift 检测（延后）

**目标：** FAQ 底部评价 + 知识漂移检测。在 Phase 5a 数据积累 60+ 天后实施。

- [x] **5b.1** `apps/portal/components/product-tabs.tsx` — FAQ 底部 "有帮助吗？" [👍] [👎]
  - 👎 → 标记 FAQ 为低效 → 关联 KnowledgeEntry 加速衰减
  - `POST /portal/faqs/:faqId/feedback` 端点 + rate limit + 去重
  - `accelerateFaqDecay()` 提升 decayRate 1.5x + 降低 impactScore
- [x] **5b.2** `apps/api/src/harness-decay-engine.ts` — `detectDrift()` 实现
  - 按 category 分组，比较 30 天窗口的平均 impactScore
  - 下降 > 20% → 生成 drift alert → 持久化为 FeedbackSignal(type='system_alert')
  - `GET /harness/drift/alerts` — 实时检测
  - `GET /harness/drift/history` — 历史 drift 记录
  - Intelligence Dashboard 集成 DriftAlertsCard 组件

---

#### Phase 6: Constitution UI → Backend 对接（规则养分闭环）

**目标：** Constitution 规则管理页面和 Agent Authority 设置对接后端。

**任务：**

- [x] **6.1** `apps/api/src/constitution-routes.ts` — Constitution API 路由
  - `GET /constitution` — 获取当前生效的 Constitution
  - `GET /constitution/history` — 获取版本历史
  - `POST /constitution` — 发布新版本（含验证）
  - `GET /constitution/suggestions` — AI 规则建议（分析 reject 模式）

- [x] **6.2** `apps/web/components/governance-dashboard.tsx` — GovernanceDashboard 重写
  - Constitution Rules Tab: 展示真实规则，支持编辑/启停/发布新版本
  - Agent Authority Tab: 展示 TMS/AAL，支持手动 Override
  - Version History Tab: 展示 Constitution 版本历史
  - AI Suggestions: 展示基于 reject 模式的规则建议

**验收标准：**
- [x] Admin 可在 UI 中查看/编辑/发布 Constitution 规则
- [x] 规则变更立即影响 Agent 行为（通过 publishConstitution 事务）
- [x] Admin 可查看 TMS/AAL 并手动降级 AAL

---

#### Phase 7: Ads Agent Governance 接入

**目标：** agent-py 的 Ads 域也接入 Governance Runtime，写入 ConfidenceLedger。

**任务：**

- [x] **7.1** `ConfidenceLedger` 增加 `agentDomain` 字段（`portal` | `ads`）
  - Portal: `caseId` 必填，`intentId` 可选
  - Ads: `intentId` 必填，`caseId` 为空
  - 字段默认值 `"portal"`，向后兼容
- [x] **7.2** `POST /harness/ledger` API 端点 — agent-py 通过 HTTP 写入 Ledger
  - 支持 `agentDomain` 参数（`portal` | `ads`）
  - 验证必填字段：`agentAction`, `ruleResult`, `authorityLevel`, `executionResult`, `confidenceBefore`
  - `appendLedgerFeedback` 自动继承原始记录的 `agentDomain`
- [x] **7.3** TMS 公式暂不扩展 — ads 域 FeedbackSignal 自然汇入现有 feedbackScore 计算

---

## Alternative Approaches Considered

| 方案 | 优点 | 缺点 | 决定 |
|------|------|------|------|
| Ledger 写入放在 agent-py | 与 Agent 执行更紧密 | Portal Agent 在 TypeScript，需跨语言调用 | **否** — Portal 域 Ledger 在 TS 侧写入 |
| 衰减用 PostgreSQL 触发器 | 数据库层保证 | 逻辑不透明，难调试 | **否** — 用 pg-boss 定时任务，逻辑在应用层 |
| TMS 实时计算 | 总是最新 | 每次 Agent 调用都要聚合查询 | **否** — 每日重算 + 缓存，Agent 读缓存值 |
| Knowledge 用向量搜索 | 语义匹配更精准 | 增加复杂度，pgvector 已有但未用于此 | **Phase 1 不用** — 先按 category + weight 排序，未来可升级 |

## Acceptance Criteria

### Functional Requirements

- [x] Agent 回复中引用 KnowledgeEntry 内容
- [x] 每次 Agent 回复在 ConfidenceLedger 中有记录
- [x] Accept/Reject 反馈更新 Ledger 的 confidenceAfter
- [x] 知识条目按衰减模型自动降权
- [x] TenantMaturity 驱动 Agent 升级阈值
- [x] Intelligence Dashboard 展示真实 L2 指标
- [x] 因果链可从知识条目追溯到具体工单和解决率

### Non-Functional Requirements

- [x] Ledger 写入不阻塞 Agent 回复（异步或 fire-and-forget）
- [x] 衰减任务在 < 30 秒内完成（单租户 1000 条知识）
- [x] TMS 重算在 < 5 秒内完成
- [x] 所有新表有 RLS + tenantId 索引

### Quality Gates

- [x] TypeScript 编译零错误
- [x] portal-agent.ts 保持 Death Line 合规（不导入平台模块）
- [x] 所有 Harness API 端点有 requireRole 保护
- [x] Ledger 写入失败不阻塞主流程（catch + log）

## Success Metrics

| 指标 | 基线 | 目标 |
|------|------|------|
| Agent 引用知识的回复占比 | 0% | > 30% |
| Ledger 覆盖率（有 Ledger 记录的 Agent 回复占比） | 0% | 100% |
| 知识条目平均 impactScore | 0 | > 0.5 |
| Operator 持续供给率（每周 writeback 数） | 未追踪 | 可度量 |
| TMS 从 0 到 L2 的平均天数 | N/A | < 14 天 |

## Dependencies & Prerequisites

| 依赖 | 状态 | 阻塞 |
|------|------|------|
| KnowledgeEntry + FeedbackSignal + ConfidenceLedger + TenantMaturity 表 | ✅ 已创建 | — |
| Harness CRUD API | ✅ 已实现 | — |
| WritebackEditor → KnowledgeEntry | ✅ 已对接 | — |
| Accept/Reject → FeedbackSignal | ✅ 已对接 | — |
| L1 Toast 系统 | ✅ 已实现 | — |
| pg-boss 队列 | ✅ 已有 | — |
| Constitution Engine | ✅ 已有（ads 域） | Phase 6 需扩展到 support 域 |

## Risk Analysis & Mitigation

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Knowledge Injection 增加 prompt 长度 → 超 token 限制 | 中 | 高 | 限制注入 top-5，每条 < 200 字 |
| Ledger 写入失败导致数据不完整 | 低 | 中 | fire-and-forget + 错误日志 + 定期对账 |
| 衰减引擎误杀有效知识 | 中 | 中 | Admin 可手动复活 DORMANT 条目 |
| TMS 计算不准导致过早升级 AAL | 低 | 高 | Admin 可手动降级 + 连续错误自动降级 |
| 关单事务中 KnowledgeEntry 创建失败 | 低 | 中 | Prisma transaction 回滚 |

## Review Findings & Incorporated Changes

### Architecture Review

1. **Ledger 写入策略升级**：从纯 fire-and-forget 改为 `catch + 持久化失败日志`。Phase 1 先用 `try/catch + console.error`，中期迁移到 pg-boss 异步队列写入。
2. **Ledger 服务抽取**：新增 `harness-ledger-service.ts`，portal-agent 和未来 agent-py 都通过该服务写入，不直接操作 Prisma。
3. **关单事务提前**：Phase 6.3 的事务化逻辑提前到 Phase 2，在 `POST /cases/:id/close` 中用 Prisma transaction 包裹 KnowledgeEntry + SupportCase + ConfidenceLedger。
4. **Ads 域整合标注**：新增 Phase 7（可选）说明 agent-py 接入 Governance Runtime 的设计点。
5. **Death Line 澄清**：portal-agent.ts 属于 API/Execution 层，可合法使用 Prisma/ModelRouter，Death Line 仅约束 `apps/agent-py/src/nodes/`。

### Simplicity Review — YAGNI 削减

1. **衰减公式简化**：Phase 3 先只用 `effectiveWeight = baseWeight × exp(-decayRate × daysSinceLastUsed)`，不实现 `usageBoost` 和 `feedbackModifier`（feedback 继续只影响 `impactScore`）。
2. **pg-boss 任务合并**：3 个定时任务合并为 1 个每日任务 `harness:decay:daily`，内部按 `dayOfWeek` 分支执行 lifecycle 和 drift。
3. **TMS 简化**：Phase 4 先用 2 维模型 `TMS = 0.5 × knowledgeScore + 0.5 × feedbackScore`，`ruleScore` 和 `historyScore` 延后。
4. **Phase 5 拆分**：5a（L2 + L3 + Chat 反馈）先做，5b（FAQ 反馈）延后。
5. **延后功能**：AAL 变更 SSE 通知、drift 检测、`POST /harness/ledger` 独立端点（先作为内部函数）。

### Best Practices Research

1. **Knowledge 注入**：固定 token 预算，top-5 条目各 ≤ 200 字，用 `[KE-xxx]` 标记引用。
2. **Ledger 不可变性**：仅 INSERT，feedback 更新限定 `feedbackType`/`confidenceAfter` 字段。
3. **衰减任务分片**：按 tenantId 分片处理，避免单 job 过大。
4. **因果链查询**：`WHERE knowledgeUsed @> ARRAY[knowledgeId]` 查询引用链。

## Future Considerations

1. **向量搜索知识注入** — 用 pgvector 对 KnowledgeEntry.content 做 embedding，语义匹配替代 category 过滤
2. **RL 训练** — 基于 ConfidenceLedger 的 reward signal 训练 Agent 策略
3. **联邦学习** — 跨租户匿名化 Ledger 数据用于全局模型改进
4. **Agent 规则建议引擎** — 从 Ledger 高频 reject 模式自动生成 Constitution 规则建议
5. **资本层调度** — 基于 TMS 和 Ledger 数据优化计算资源分配

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-03-02-harness-engineering-framework-brainstorm.md`
- Architecture: `ARCHITECTURE.md` (ADR-002 Constraint Power, ADR-008 Knowledge Writeback)
- Constitution Engine: `apps/api/src/constitution-engine.ts`
- Portal Agent: `apps/api/src/portal-agent.ts`
- Harness Routes: `apps/api/src/harness-routes.ts`
- Support Page: `apps/web/app/support/page.tsx`
- Queue: `apps/api/src/queue.ts`
- Prisma Schema: `packages/database/prisma/schema.prisma` (L780–L1010)

### SpecFlow Analysis

- `docs/analysis/2026-03-03-harness-engineering-spec-flow-analysis.md`
- Key finding: Portal Agent 无 Intent 概念 → Ledger 以 `caseId` 为粒度记录，每次 Agent 回复一条
- Key finding: 关单流程需事务化（KnowledgeEntry + SupportCase + Ledger）
- Key finding: Consumer 反馈需防刷（rate limit by consumerId）
