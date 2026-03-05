# AI Governance Runtime (Harness Engineering) — SpecFlow Analysis

**分析日期：** 2026-03-03  
**分析类型：** User Flow Completeness · Edge Cases · Gap Identification  

---

## Executive Summary

规范描述的 AI Governance Runtime 与当前实现之间存在显著架构断层。**Intent Resolution Pipeline** 的设计面向结构化意图（如广告出价调整），而 **Portal Agent** 产出的是非结构化聊天消息与置信度。两者尚未统一。同时，多处关键数据流（KnowledgeEntry→Agent、FeedbackSignal→Confidence Calibration、Ledger 写入）未实现，导致养分管道与治理管线的闭环断裂。

---

## 1. User Flow Overview

### 1.1 已实现的用户流

| # | 流程 | 入口 | 当前状态 |
|---|------|------|----------|
| F1 | Operator 关单 → Writeback | 关闭工单时 WritebackEditor | ✅ 部分实现：createKnowledgeEntry + closeSupportCase；但 agent 未读取 KnowledgeEntry |
| F2 | Operator Accept/Reject 建议 | AgentPanel | ✅ 实现：createFeedbackSignal；但无 intentId、无 Ledger 写入、无置信度校准 |
| F3 | 知识库 CRUD | /harness/knowledge | ✅ 实现 |
| F4 | 反馈信号 CRUD | /harness/feedback | ✅ 实现 |
| F5 | Ledger 读取 | /harness/ledger | ✅ 只读 API |
| F6 | Maturity 读取/覆盖 | /harness/maturity | ✅ 实现；但 TMS 未计算 |

### 1.2 规范描述但未实现的用户流

| # | 流程 | 入口 | 缺失原因 |
|---|------|------|----------|
| F7 | 知识注入 Agent  context | Portal Agent buildSystemPrompt | 仅读取 ConsumerFAQ，未读取 KnowledgeEntry |
| F8 | Constitution 规则管理 → 生效 | Admin UI | Constitution Engine 仅支持 ads 域，无 support 域规则 |
| F9 | Agent Authority 设置 → 生效 | Admin UI | 仅 localStorage，未对接 PolicyConfig/TenantMaturity |
| F10 | Consumer 聊天结束评价 | Portal Chat | 无弹窗、无 FeedbackSignal |
| F11 | Consumer FAQ 评价 | FAQ 底部 | 无内联评价、无 FeedbackSignal |
| F12 | Dashboard 审批流 | CONFIRM 队列 | 纯 mock，无真实 Intent 队列 |
| F13 | Ledger 写入 | Intent Resolution Pipeline | 管线未实现，无写入逻辑 |
| F14 | TMS 重算 → AAL 升级 | 定时任务 | 无 TMS 计算逻辑 |
| F15 | 知识衰减 → DORMANT → ARCHIVED | 定时任务 | 无 decay 任务 |
| F16 | Drift 检测 → Insight Stream | 定时/分析 | 无 drift 分析 |
| F17 | L2 仪表盘指标（真实数据） | Intelligence Dashboard | 使用 mock，未查 Ledger/Experience |
| F18 | L3 因果链 | Insight Stream | 无因果链生成逻辑 |

---

## 2. Flow Permutations Matrix

| 维度 | 变体 | 当前覆盖 |
|------|------|----------|
| **用户角色** | Tenant Admin | 部分：maturity patch、constitution UI mock |
| | Operator | ✅ 主要覆盖：writeback、accept/reject |
| | Consumer | ❌ 无行为信号 |
| **Agent 类型** | Ads Agent (Intent) | Constitution + 执行管线存在，但无 Ledger 写入 |
| | Portal Agent (Chat) | 无 Intent、无管线、无 Ledger |
| **工单状态** | open | ✅ |
| | human_escalated | ✅ 强制 writeback |
| | closed | ✅ |
| **渠道** | portal | ✅ 真实 API |
| | amazon/tiktok/shopee/a2a | Mock；writeback 写入 KnowledgeEntry 但关单不调用 closeSupportCase |
| **首次 vs 复访** | 首次 | 未显式处理 |
| | 复访 | 未显式处理 |
| **网络** | 离线/慢速 | 无降级策略 |
| **并发** | 多操作员同工单 | 无锁、无冲突检测 |

---

## 3. Critical Architecture Gap: Intent vs Message

**问题：** 规范假定每个 Agent 行为对应一个 `AuditableIntent`，经管线处理后写入 Ledger。但：

- **Ads Agent**（agent-py + server.ts）：产生 `AgentIntent`，经 Constitution → 执行，**但不写 Ledger**
- **Portal Agent**（portal-agent.ts）：产生聊天消息 + 置信度，**不产生 Intent**，无 `intentId`

**影响：**

1. FeedbackSignal 的 `intentId` 恒为 `null`（Portal 无 intent）
2. Confidence Ledger 无法与 Portal 反馈关联
3. Dashboard 审批流（入口 6）依赖「Agent Intent 进入 CONFIRM 队列」— 但 Portal 无此概念
4. L3 因果链需要 `KnowledgeEntry → Case → Ledger` 关联，但 Ledger 无 Portal 记录

**需要的澄清：**

- Support 域是否也要引入「结构化 Intent」？（如 `ProcessRefund`、`EscalateToHuman`、`ApplyKnowledgeBasedResponse`）
- 若保持当前聊天模式，Ledger 记录单位是「每条 agent 消息」还是「每个 case 的最终决策」？

---

## 4. Missing Elements & Gaps（按类别）

### 4.1 数据流与一致性

| 分类 | 缺口 | 影响 |
|------|------|------|
| **KnowledgeEntry → Agent** | Portal Agent 的 `loadContext` 仅查 `ConsumerFAQ`，不查 `KnowledgeEntry` | 回写无法被引用，impact 无法追踪 |
| **Writeback sourceRef** | 已存 `ticket.id`，但 KnowledgeEntry 与 SupportCase 无外键 | 无法通过 KnowledgeEntry 反查来源 case |
| **FeedbackSignal → Ledger** | 无 `intentId`，Ledger 无记录 | 反馈无法参与校准 |
| **cite 调用点** | `/harness/knowledge/:id/cite` 存在，但无调用方 | usageCount、lastUsedAt 永不更新 |
| **非 Portal 关单** | amazon/tiktok 等关单不调用 `closeSupportCase` | 仅更新 mock 本地状态，KnowledgeEntry 可能已建但 case 状态不同步 |

### 4.2 错误处理与边界

| 分类 | 缺口 | 影响 |
|------|------|------|
| **createKnowledgeEntry 失败** | 关单流程中若 createKnowledgeEntry 失败，handleClose 是否继续 closeSupportCase？ | 当前会 catch 后 onToast error，但 closeSupportCase 可能未执行 → 状态不一致 |
| **createFeedbackSignal 失败** | Accept/Reject 失败时 UI 恢复，但用户可能认为已记录 | 需明确「失败时是否允许视为已操作」 |
| **Ledger 写入失败** | 管线未实现，无规范 | 需定义：写入失败是否阻塞执行 |
| **TMS 计算失败** | 无计算逻辑 | AAL 无法更新 |
| **Decay 任务失败** | 无任务 | 无重试/告警策略 |

### 4.3 安全

| 分类 | 缺口 | 影响 |
|------|------|------|
| **Consumer 反馈权限** | Portal 消费者无认证时提交 FeedbackSignal | 需区分：匿名评价 vs 需登录 |
| **tenantId 校验** | 所有 harness 接口已用 auth.tenantId | ✅ |
| **Constitution 规则注入** | 规则存储位置、版本控制、审计未定义 | 规则被篡改风险 |
| **Ledger 不可变性** | 规范要求「不可变」，Prisma 未禁止 update | 需应用层或 DB 约束保证 |

### 4.4 竞态与并发

| 分类 | 缺口 | 影响 |
|------|------|------|
| **同 case 多 Operator** | 无锁 | 可能重复 writeback、重复 FeedbackSignal |
| **关单 + 回写竞态** | 先 createKnowledgeEntry 再 closeSupportCase 非事务 | 若 close 失败，KnowledgeEntry 已存在，case 仍 open |
| **TMS 计算与 AAL 更新** | 若并发更新 maturity | 需定义乐观锁或串行化 |
| **Decay 与 cite 并发** | 同时运行 decay 任务和 agent 引用 | effectiveWeight 可能基于过期 usageCount |

### 4.5 顺序与依赖

| 分类 | 缺口 | 影响 |
|------|------|------|
| **Knowledge Injection 顺序** | 规范：Constitution → Authority → Knowledge Injection | Portal 无 Constitution/Authority，顺序无意义 |
| **Ledger 写入时机** | 规范：无论成功/失败/拒绝都记录 | 当前无任何写入 |
| **feedbackAt 异步回填** | Ledger 记录后，人类反馈到达时更新 | 需明确更新接口与幂等性 |
| **实施阶段顺序** | 见下表 | |

---

## 5. Implementation Phase Dependencies

```
Phase A (基础管线)
├── 1. 定义 Support 域 Intent 或等效概念
├── 2. Portal Agent 产生 intentId（或每消息生成 sessionIntentId）
├── 3. Intent Resolution Pipeline 统一接入 Portal
└── 4. Confidence Ledger 写入（Constitution 拒绝 / 执行成功 / 升级 / 人类反馈）

Phase B (知识闭环)
├── 5. Knowledge Injection：loadContext 合并 KnowledgeEntry（按 effectiveWeight 排序）
├── 6. 执行时调用 /knowledge/:id/cite 更新 usageCount
├── 7. impactScore 计算（引用后的解决率）→ 需 Ledger 数据
└── 8. L3 因果链生成（依赖 Ledger + KnowledgeEntry 关联）

Phase C (衰减与成熟度)
├── 9. Decay 定时任务（日更 effectiveWeight）
├── 10. Drift 检测（category 维度 impactScore 下降）
├── 11. TMS 计算（knowledgeScore, ruleScore, feedbackScore, historyScore）
└── 12. AAL 映射与通知

Phase D (UI 闭环)
├── 13. Constitution 规则管理 → PolicyConfig + 扩展 Constitution Engine 支持 support 域
├── 14. Agent Authority 设置 → 对接 TenantMaturity
├── 15. Consumer 评价（chat 结束 + FAQ 底部）
├── 16. Dashboard 审批流 → 真实 CONFIRM 队列
└── 17. L2 指标从 Ledger/KnowledgeEntry 取数
```

**关键依赖：** Phase B 依赖 Phase A（Ledger 写入）；Phase C 依赖 Phase B（cite + impactScore）；L3 因果链依赖 Phase A+B。

---

## 6. Edge Cases Not Covered

### 6.1 Writeback 流程

| 场景 | 规范/实现 | 缺口 |
|------|----------|------|
| 用户点击 Confirm 后立即关闭页面 | 已调用 createKnowledgeEntry | 无离线/重试队列 |
| 写空 content | API 校验 `content.length >= 1` | ✅ |
| 同一 case 多次 Confirm | 无防重 | 可能产生重复 KnowledgeEntry |
| 关单时 writeback 与 ticket.agentSuggestion 不同 | 以用户编辑为准 | ✅ |
| 非 escalated 关单不填 writeback | Close 可用，传 `'Resolved'` | 无 KnowledgeEntry，符合预期 |

### 6.2 Accept/Reject 流程

| 场景 | 规范/实现 | 缺口 |
|------|----------|------|
| 同建议多次 Accept | 每次创建新 FeedbackSignal | 可能重复计数，影响学习信号 |
| Accept 后立刻 Reject | 两个信号都记录 | 未定义如何解释矛盾信号 |
| Reject 无 reason | API 中 reason 可选 | 规范鼓励预选原因，未强制 |
| 无 agentSuggestion 时隐藏按钮 | ✅ | - |

### 6.3 Consumer 评价（未实现）

| 场景 | 规范 | 缺口 |
|------|------|------|
| 未解决 → 自动升级 | 规范有描述 | 需定义升级目标（case 状态？新建工单？） |
| FAQ 点踩「低效」 | 进入知识衰减快车道 | KnowledgeEntry 与 FAQ 是否共用？当前 ConsumerFAQ ≠ KnowledgeEntry |
| 消费者刷新/离开未评价 | 无强制 | 可能永远无反馈 |

### 6.4 Decay & Drift（未实现）

| 场景 | 规范 | 缺口 |
|------|------|------|
| effectiveWeight 归零 | 规范：< 0.1 → DORMANT | 除零、浮点精度 |
| 全部知识 ARCHIVED | Agent 无知识注入 | 降级策略？ |
| Drift 误报 | 短期波动触发告警 | 需置信区间/滑动窗口 |
| 新租户零知识 | TMS = 0, AAL = L1 | ✅ 规范已覆盖 |

### 6.5 TMS & AAL

| 场景 | 规范 | 缺口 |
|------|------|------|
| Admin 手动降级 | 规范：可降级不可超 TMS 升级 | maturity PATCH 仅 system_admin，tenant_admin 无法覆盖 |
| 连续 3 次严重错误自动降级 | 规范有 | 「严重错误」定义？如何检测？ |
| TMS 下降导致 AAL 降级 | 规范有 | 通知渠道？ |

---

## 7. Critical Questions Requiring Clarification

### 7.1 关键（阻塞实现）

1. **Support 域是否引入 Intent？**  
   - 若引入，Portal 每条建议是否对应一个 Intent（如 `SuggestResponse`）？  
   - 若不引入，Ledger 记录粒度是什么（每条消息 vs 每 case）？  

2. **Ledger 写入失败策略**  
   - 写入失败是否阻止执行？  
   - 是否允许异步补偿写入？  

3. **Consumer 反馈与认证**  
   - 匿名用户能否提交 `resolved`/`rating` 类型 FeedbackSignal？  
   - 需如何防刷？  

### 7.2 重要（显著影响 UX/可维护性）

4. **FeedbackSignal 与 Ledger 的关联方式**  
   - 无 intentId 时，是否用 `caseId + agentAction` 关联？  
   - 一个 case 多条 agent 消息时，如何映射？  

5. **重复 Accept/Reject 的语义**  
   - 是否去重（同 case+同 agentAction 只计一次）？  
   - 矛盾信号（先 Accept 后 Reject）的裁决规则？  

6. **关单事务边界**  
   - createKnowledgeEntry + closeSupportCase 是否需要跨服务事务？  
   - 若 KnowledgeEntry 成功、close 失败，是否回滚 KnowledgeEntry？  

7. **Constitution 的 support 域规则形态**  
   - 例如 `refund_amount > 100 → CONFIRM`：规则存储格式？如何从聊天内容解析 `refund_amount`？  

### 7.3 建议（可合理默认）

8. **Decay 任务调度**  
   - 假设每日 00:00 UTC？  
   - 多实例时如何避免重复执行？  

9. **「严重错误」定义**  
   - 假设：Constitution 硬拒绝 / 人类 Reject 且 reason=policy_violation？  

10. **FAQ 与 KnowledgeEntry 的关系**  
    - 假设：ConsumerFAQ 用于门户展示，KnowledgeEntry 用于 Agent 注入；FAQ 点踩仅影响 ConsumerFAQ 或需新建「FAQ 评价→KnowledgeEntry 衰减」链路？  

---

## 8. Recommended Next Steps

1. **确定 Intent 模型**：Support 域采用结构化 Intent，还是以 case 为单位记录 Ledger。  
2. **实现 Ledger 写入**：至少覆盖 Portal 每次 agent 响应（或每 case 一次），建立 FeedbackSignal 与 Ledger 的关联。  
3. **实现 Knowledge Injection**：在 `loadContext` / `buildSystemPrompt` 中合并 KnowledgeEntry（按 effectiveWeight 排序，排除 ARCHIVED）。  
4. **实现 cite 调用**：在引用某条 KnowledgeEntry 时调用 cite API。  
5. **定义关单事务策略**：明确 createKnowledgeEntry 失败时是否继续关单，以及是否支持补偿。  
6. **扩展 Constitution Engine**：增加 support 域规则类型（若采用 Intent 模型）。  
7. **实现 Consumer 评价**：Chat 结束弹窗 + FAQ 底部评价，并写入 FeedbackSignal。  
8. **实现 TMS 计算与 AAL 映射**：定时任务 + Admin 通知。  
9. **实现 Decay 任务**：日更 effectiveWeight，周/月处理 DORMANT/ARCHIVED。  
10. **补齐文档**：将上述决策写入 ADR，供后续实施参考。

---

## Appendix: Current vs Spec Alignment

| 规范组件 | 当前实现 | 差距 |
|----------|----------|------|
| Intent Resolution Pipeline | Ads 有管线，Portal 无 | Portal 未接入 |
| Confidence Ledger Write | 无 | 需实现 |
| Knowledge Injection | 无 | 仅用 ConsumerFAQ |
| Confidence Calibration | 无 | 无 feedback→confidence 闭环 |
| Constitution (support) | 仅 ads 规则 | 需扩展 |
| Decay Engine | 无 | 需定时任务 |
| Drift Engine | 无 | 需分析任务 |
| TMS ↔ AAL | 无计算 | 需实现 |
| L2 真实数据 | Mock | 需查 Ledger/KnowledgeEntry |
| L3 因果链 | 无 | 需实现 |
