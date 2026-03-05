---
date: 2026-03-02
topic: harness-engineering-framework
---

# AI Governance Runtime — 动态治理执行系统

> 从"养分管道"升级为"企业级 AI 治理运行时"。不仅定义养分如何流入，更定义 Agent 如何在治理框架下执行每一个决策。

## What We're Building

一个完整的 **AI Governance Runtime 架构蓝图**，包含：

1. **三通道养分供给** — 知识、规则、反馈从三类供给者流入
2. **Intent Resolution Pipeline** — Agent 每个决策必经的标准执行管线
3. **Confidence Ledger** — 每次 Agent 行为的完整审计账本（RL/联邦学习/资本调度的基础）
4. **Tenant Maturity Model** — 冷启动到成熟期的动态自主权调节

核心设计哲学：**最小摩擦、最小 UI、嵌入工作流**——养分供给不是额外的工作，而是日常操作的自然副产品。

## 架构蓝图

### 〇、系统全景（AI Governance Runtime）

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AI GOVERNANCE RUNTIME                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   NUTRIENT BUS (§一)                         │    │
│  │   Knowledge ──┐                                              │    │
│  │   Rules ──────┼──→ Priority Layer (§五) ──→ Learning Engine  │    │
│  │   Feedback ───┘                              (§七)           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              INTENT RESOLUTION PIPELINE (§九)                │    │
│  │                                                              │    │
│  │  Intent → Constitution → Authority → Knowledge Injection     │    │
│  │       → Confidence Calibration → Execution → Ledger Write    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐        │
│  │  CONFIDENCE LEDGER   │  │  TENANT MATURITY MODEL       │        │
│  │  (§十)               │  │  (§十一)                      │        │
│  │  每次行为的完整审计    │  │  TenantMaturityScore ↔       │        │
│  │  RL / 联邦学习基础    │  │  AgentAutonomyLevel          │        │
│  └──────────────────────┘  └──────────────────────────────┘        │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           THREE-LAYER FEEDBACK SYSTEM (§四)                  │    │
│  │  L1: 即时微反馈  L2: 仪表盘指标  L3: 因果链（可验证）        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           DECAY & DRIFT ENGINE (§六)                         │    │
│  │  知识衰减 · 漂移检测 · 自动代谢 · 生命周期管理                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 一、三通道养分模型

```
┌─────────────────────────────────────────────────────────────┐
│                      NUTRIENT BUS                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  知识养分      │  │  规则养分      │  │  反馈养分      │       │
│  │  Knowledge    │  │  Rules       │  │  Feedback    │       │
│  │              │  │              │  │              │       │
│  │ • FAQ 回写    │  │ • Constitution│  │ • 拒绝原因    │       │
│  │ • 案例解决方案 │  │ • 执行权限     │  │ • 质量评分    │       │
│  │ • 产品手册    │  │ • 审批阈值     │  │ • 修正建议    │       │
│  │ • 操作经验    │  │ • 安全红线     │  │ • 行为信号    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌──────────────────────────────────────────────────┐       │
│  │         PRIORITY LAYER (§五) → LEARNING ENGINE    │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 二、三类供给者 × 三种养分

| 供给者 | 知识养分 | 规则养分 | 反馈养分 |
|--------|----------|----------|----------|
| **Tenant Admin** | 产品手册上传、FAQ 策略、知识库审核 | Constitution 规则、执行权限（AUTO/CONFIRM/BLOCK）、审批阈值、安全红线 | 策略效果评估、规则调优 |
| **Operator** | 工单回写（关单时）、解决方案模板、异常案例标注 | — | 拒绝原因选择、Agent 建议评分（👍/👎）、修正建议 |
| **Consumer** | 行为信号（哪些 FAQ 被查看、哪些没解决问题） | — | 满意度评分、问题是否解决确认 |

### 三、嵌入式喂养入口（最小摩擦设计）

**核心交互铁律：人类是审核者，不是创作者。**

```
传统模式（30 秒）：
  人类看到空白表单 → 思考 → 打字 → 提交

Harness 模式（3 秒）：
  Agent 已预填内容 → 人类扫一眼 → 一键确认 → Toast 告知效果
```

每个嵌入式入口都必须遵循这个四步范式：

| 步骤 | 职责 | 耗时 |
|------|------|------|
| **① Agent 预填** | Agent 基于上下文自动生成内容（回写、分类、原因、建议） | 0 秒（用户到达时已就绪） |
| **② 人类审核** | 用户扫一眼预填内容，判断是否正确 | 1-2 秒 |
| **③ 一键动作** | 确认 / 微调 / 拒绝（最多一次点击 + 可选下拉） | 0.5-1 秒 |
| **④ Toast 反馈** | 即时告知效果（可验证措辞） | 自动 |

**设计原则：** 不创建独立的"喂养页面"。养分收集嵌入在日常操作的关键节点，是"顺手动作"而非"额外工作"。

---

#### 入口 1：工单关闭时 — Knowledge Writeback

```
┌─────────────────────────────────────────────┐
│  Knowledge Writeback                         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Agent 预填（灰底）：                     │  │
│  │ "ChefPro X3 加热元件缺陷，批次 BN-24-09 │  │
│  │  → 更换 + $10 代金券。建议通知供应商。"  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  分类标签（Agent 预填）：                     │
│  [ChefPro X3 ▾] [产品缺陷 ▾]  ← 可改       │
│                                              │
│  [✓ 确认并保存]  [✎ 编辑]                    │
│                                              │
│  → Toast: "✓ 已进入候选知识池，类似问题将    │
│           优先引用此方案"                     │
└─────────────────────────────────────────────┘
```

- **触发点：** Operator 关闭工单（或升级工单强制出现）
- **Agent 预填：** 基于工单对话自动生成回写摘要 + 产品/问题类型标签
- **人类动作：** 扫一眼 → [✓ 确认] 或 [✎ 编辑] 微调
- **当前状态：** WritebackEditor 已存在，Agent 预填 `agentSuggestion` 已有
- **需要补的：** 分类标签预填 + 写入 KnowledgeEntry 表 + Toast

#### 入口 2：Agent 建议审核 — Feedback Signal

```
┌─────────────────────────────────────────────┐
│  Agent Recommendation          Confidence 87%│
│                                              │
│  "建议全额退款 + 快递更换。批次 #2847 已知   │
│   缺陷率 28%。"                              │
│                                              │
│  [✓ Accept]  [✕ Reject ▾]  [✎ Modify]       │
│                                              │
│  Reject 展开（Agent 预填最可能原因）：        │
│  ○ 方案不适用于此场景  ← Agent 预选          │
│  ○ 金额/权限超出范围                         │
│  ○ 信息不准确                                │
│  ○ 安全风险                                  │
│  ○ 其他: [________]                          │
│                                              │
│  → Accept Toast: "✓ 方案已确认，置信度 +0.05"│
│  → Reject Toast: "✓ 反馈已记录至 Ledger"     │
└─────────────────────────────────────────────┘
```

- **触发点：** Operator 在 AgentPanel 查看建议
- **Agent 预填：** 建议内容 + 置信度 + Reject 时预选最可能的拒绝原因
- **人类动作：** [✓ Accept] 一键 / [✕ Reject] 一键（原因已预选，可改）/ [✎ Modify] 编辑
- **当前状态：** Accept 按钮 disabled，无 Reject 机制
- **需要补的：** 启用三按钮 + Reject 原因选择器（预选） + 写入 FeedbackSignal + Ledger

#### 入口 3：Constitution 规则管理 — Rule Nutrient

```
┌─────────────────────────────────────────────┐
│  Add Rule                                    │
│                                              │
│  Agent 建议（基于近期 Ledger 分析）：         │
│  ┌────────────────────────────────────────┐  │
│  │ "建议新增规则：单笔退款 > $100 需人工   │  │
│  │  确认。原因：过去 30 天有 8 笔 > $100   │  │
│  │  退款，其中 3 笔被 Operator 修改。"     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  规则类型: [HARD ▾]  ← Agent 预填            │
│  条件:     [refund_amount > 100]  ← 预填     │
│  动作:     [CONFIRM]  ← 预填                 │
│                                              │
│  [✓ 采纳此规则]  [✎ 调整]  [✕ 忽略]          │
│                                              │
│  → Toast: "规则已生效 · 影响 3 个待处理 Intent"│
└─────────────────────────────────────────────┘
```

- **触发点：** Admin 在 Constitution 页面，或 Agent 主动推荐新规则
- **Agent 预填：** 基于 Confidence Ledger 分析，主动建议规则 + 预填类型/条件/动作
- **人类动作：** [✓ 采纳] 一键 / [✎ 调整] 微调参数
- **当前状态：** 纯 mock，未对接后端
- **需要补的：** 对接 constitution-engine.ts + Agent 规则建议引擎 + Toast

#### 入口 4：Agent Authority 权限设置 — Rule Nutrient

```
┌─────────────────────────────────────────────┐
│  Execution Authority                         │
│                                              │
│  Agent 建议（基于 TenantMaturityScore）：     │
│  "您的 TMS 已达 0.65（L3 Supervised）。      │
│   建议将'退款处理'从 CONFIRM 升级为 AUTO     │
│  （限额 ≤ $50）。"                           │
│                                              │
│  退款处理:  ○ BLOCK  ● CONFIRM  ○ AUTO       │
│                       ↑ 当前     ↑ 建议       │
│                                              │
│  [✓ 接受建议]  [保持现状]                     │
│                                              │
│  → Toast: "权限已更新，Agent 可自动处理       │
│           ≤$50 退款"                          │
└─────────────────────────────────────────────┘
```

- **触发点：** Admin 在 Agent Authority 页面，或 TMS 升级时主动推荐
- **Agent 预填：** 基于 TenantMaturityScore 建议权限调整
- **人类动作：** [✓ 接受] 一键 / 手动选择其他级别
- **当前状态：** 仅存 localStorage
- **需要补的：** 对接 PolicyConfig + TMS 驱动的建议 + Toast

#### 入口 5：消费者行为信号 — Implicit Feedback

```
┌─────────────────────────────────────────────┐
│  Chat 结束后（自动弹出）：                    │
│                                              │
│  "您的问题解决了吗？"                        │
│                                              │
│  [👍 已解决]  [👎 未解决]                     │
│                                              │
│  → 已解决 Toast: "感谢反馈，已记录"          │
│  → 未解决 → 自动升级给 Operator              │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  FAQ 底部（内联）：                           │
│                                              │
│  "这篇文章有帮助吗？  [👍] [👎]"             │
│                                              │
│  → 👎 → Agent 标记此 FAQ 为低效              │
│       → 进入知识衰减快车道                    │
└─────────────────────────────────────────────┘
```

- **触发点：** Chat 结束 / FAQ 阅读完毕（自动出现，零主动操作）
- **Agent 预填：** 不适用（消费者场景是纯选择题，无需预填）
- **人类动作：** 一个按钮 [👍] 或 [👎]
- **当前状态：** Portal 无行为追踪
- **需要补的：** Chat 结束弹窗 + FAQ 底部评价 + 写入 FeedbackSignal

#### 入口 6：Dashboard 审批流 — Feedback Signal

```
┌─────────────────────────────────────────────┐
│  ⚠ Needs Your Approval                      │
│                                              │
│  Agent 请求退款 $89.99（ChefPro X3）         │
│  置信度: 91%  规则: 需人工确认（> $50）       │
│                                              │
│  Agent 理由（预填）：                         │
│  "批次 #2847 已知缺陷率 28%，保修有效，       │
│   历史同类工单 100% 批准退款。"               │
│                                              │
│  [✓ Approve]  [✕ Reject ▾]                   │
│                                              │
│  Reject 展开（Agent 预选最可能原因）：        │
│  ● 金额需调整  ← Agent 预选                  │
│  ○ 信息不足                                  │
│  ○ 违反政策                                  │
│  ○ 其他: [________]                          │
│                                              │
│  → Approve Toast: "✓ 已批准，Agent 执行中"   │
│  → Reject Toast: "✓ 反馈已记录至 Ledger，     │
│                   Agent 将校准此类决策"        │
└─────────────────────────────────────────────┘
```

- **触发点：** Agent Intent 进入 CONFIRM 队列
- **Agent 预填：** 完整理由 + Reject 时预选最可能原因 + 历史同类审批统计
- **人类动作：** [✓ Approve] 一键 / [✕ Reject] 一键（原因已预选）
- **当前状态：** "Needs Your Attention" 卡片纯 mock
- **需要补的：** 对接真实 Intent 队列 + Reject 原因 + 写入 Ledger

### 四、三层反馈系统

#### L1：即时微反馈（操作后 0-3 秒）

**铁律：不过度承诺学习效果。所有 L1 反馈必须可验证。**

| 触发 | 反馈形式 | 措辞（可验证） | ~~不要这样说~~ |
|------|----------|----------------|----------------|
| 保存 Writeback | Toast + 动画 | "✓ 已进入候选知识池，未来类似问题将优先引用" | ~~"Agent 已学习"~~ |
| Accept 建议 | 内联确认 | "✓ 方案已确认，置信度 +0.05" | ~~"模式已强化"~~ |
| Reject 建议 | 内联确认 | "✓ 反馈已记录至 Confidence Ledger" | ~~"Agent 将调整"~~ |
| 修改 Constitution | Banner | "规则已生效 · 影响 12 个待处理 Intent" | （这个本身可验证，保留） |
| 消费者评价 | 感谢动画 | "感谢反馈，已记录" | ~~"我们会持续改进"~~ |

#### L2：仪表盘指标（Intelligence Dashboard）

| 指标 | 含义 | 数据源 |
|------|------|--------|
| KB Writebacks | 本周回写数量 | KnowledgeBase 表 |
| Agent Auto-Resolution Rate | 自动解决率变化趋势 | SupportCase 统计 |
| Writeback Impact Score | 回写后相似工单解决率提升 | Experience 表关联分析 |
| Constitution Hit Rate | 规则触发次数与通过/拦截比 | ConstitutionLog |
| Rejection Learning Rate | Agent 从拒绝中学习后的改善率 | Experience 表 |
| Consumer CSAT Trend | 消费者满意度趋势 | Portal 评价数据 |

#### L3：因果链（Insight Stream）

因果链是最高级的反馈形式——让人类看到完整的 "输入 → 学习 → 效果" 链路。

**铁律：因果链中的每一步必须有数据支撑，不可虚构。**

示例（每一行都可追溯到具体记录）：
```
🧠 你 2 小时前的回写 "ChefPro X3 加热元件缺陷 → 更换 + 代金券"
   → 已进入候选知识池（KnowledgeEntry #KE-4821, effectiveWeight: 1.0）
   → 被 Agent 引用 5 次处理同类工单（Case #CS-2849, #CS-2851, #CS-2853, #CS-2855, #CS-2857）
   → 这 5 个工单中 4 个自动解决、1 个升级（可点击查看详情）
   → 该类问题自动解决率：71% → 80%（基于 Confidence Ledger 统计）
```

因果链在 Intelligence Dashboard 的 Insight Stream 中展示，也可在 Dashboard 的 "Live Agent Activity" 中推送关键事件。每条因果链都链接到具体的 KnowledgeEntry、CaseId、ConfidenceLedger 记录，用户可点击验证。

### 五、Nutrient Priority Layer（养分优先级层）

当三种养分对同一决策产生矛盾指令时，Agent 必须有明确的裁决顺序。否则会出现"价值震荡"——Agent 在矛盾信号中反复摇摆。

**优先级栈（从高到低）：**

```
┌─────────────────────────────────────────┐
│  P0  RULES (Hard Constraints)           │  Constitution 硬规则、安全红线
│      绝对不可违反，无论其他养分怎么说      │  例：退款上限 $200、禁止泄露用户数据
├─────────────────────────────────────────┤
│  P1  SAFETY FEEDBACK                    │  安全类反馈信号
│      涉及人身安全、法律合规的反馈          │  例：产品起火报告 → 立即升级
├─────────────────────────────────────────┤
│  P2  KNOWLEDGE                          │  知识库条目
│      新知识可覆盖旧知识，但不可破坏规则    │  例：新 SOP 替代旧 SOP
├─────────────────────────────────────────┤
│  P3  EXPERIENCE FEEDBACK                │  体验类反馈信号
│      用于调整权重和置信度，不用于破坏规则  │  例：差评 → 降低该方案置信度
└─────────────────────────────────────────┘
```

**冲突裁决示例：**

| 场景 | Knowledge 说 | Rule 说 | Feedback 说 | 裁决 |
|------|-------------|---------|-------------|------|
| 退款请求 | "建议全额退款" | "单笔退款不超过 $200" | 高差评 | **Rule 胜出** → 退款 ≤ $200，差评记录但不破坏规则 |
| 产品安全 | "正常使用" | 无相关规则 | "产品起火！" | **Safety Feedback 胜出** → 立即升级，不引用旧知识 |
| 方案选择 | 方案 A（旧） | 无约束 | 方案 A 被拒绝 3 次 | **Feedback 调权** → 降低方案 A 置信度，但不删除 |

**实现机制：** Agent Learning Engine 在 `buildSystemPrompt` 和 `recall_similar_experiences` 时，按优先级栈过滤和排序养分。Constitution Engine 作为 P0 层拦截器，在任何养分注入前先评估规则合规性。

### 六、Decay & Drift Mechanism（养分衰减与漂移机制）

所有知识都会过期。没有新陈代谢的知识库，2 年后会被历史噪音淹没。

**衰减模型：**

```
effectiveWeight = baseWeight × decayFactor × usageBoost × feedbackModifier

其中：
  decayFactor    = e^(-decayRate × daysSinceLastUsed)
  usageBoost     = log(1 + usageCount) / log(1 + maxUsageCount)
  feedbackModifier = 1.0 + (positiveSignals - negativeSignals) × 0.1
```

**衰减规则：**

| 条件 | 行为 | 阈值 |
|------|------|------|
| 长期未被 Agent 引用 | 自动降低 effectiveWeight | 90 天未引用 → weight × 0.5 |
| 被频繁拒绝 | 快速衰减 | 3 次拒绝 → weight × 0.3 |
| 高 impactScore | 延长寿命 | impactScore > 0.8 → 衰减速率 × 0.5 |
| 关联产品下架 | 标记为 archived | 自动检测 |
| 被新知识显式覆盖 | 标记为 superseded | 新 KnowledgeEntry 指向旧条目 |

**生命周期状态：**

```
ACTIVE → DECAYING → DORMANT → ARCHIVED
  ↑         │          │
  └─────────┘          │  (被重新引用时复活)
  └────────────────────┘  (被 Admin 手动复活)
```

**自动代谢任务（定时运行）：**

1. 每日：计算所有 KnowledgeEntry 的 `effectiveWeight`
2. 每周：将 `effectiveWeight < 0.1` 的条目标记为 DORMANT
3. 每月：将 DORMANT 超过 60 天的条目标记为 ARCHIVED
4. ARCHIVED 条目不删除，但不再注入 Agent prompt

**漂移检测（Drift Detection）：**

当某类知识的平均 impactScore 持续下降时，系统在 Intelligence Dashboard 的 Insight Stream 中发出预警：

```
⚠ 知识漂移检测：ChefPro X3 相关知识条目的平均解决率
   从 89% 下降至 62%（过去 30 天）
   → 可能原因：产品更新、SOP 变更
   → 建议：审核 12 条相关知识条目
```

### 七、Agent Learning Engine（学习引擎）

```
养分输入 → 优先级裁决(§五) → 分类 → 存储 → 索引 → Agent 引用 → 效果追踪 → 衰减代谢(§六)
```

| 阶段 | 知识养分 | 规则养分 | 反馈养分 |
|------|----------|----------|----------|
| **优先级** | P2 | P0 (Hard) / P1 (Safety) | P1 (Safety) / P3 (Experience) |
| **存储** | KnowledgeEntry 表 | PolicyConfig 表 | FeedbackSignal 表（新） |
| **索引** | 按产品/问题类型/渠道 | 按 policyKey/tenantId | 按 caseId/agentAction |
| **Agent 引用** | buildSystemPrompt 中按 effectiveWeight 排序注入 | Constitution Engine 评估（无衰减） | recall_similar_experiences 时加权 |
| **效果追踪** | 引用次数 + 解决率 → impactScore | 触发次数 + 通过率 | 改善率 + 重复拒绝率 |
| **衰减** | 按 §六 衰减模型 | **不衰减**（规则由 Admin 显式管理） | 90 天后自动降权 |

### 八、数据模型（新增）

```
FeedbackSignal {
  id              String
  tenantId        String
  type            "accept" | "reject" | "modify" | "rating" | "resolved"
  sourceRole      "operator" | "tenant_admin" | "consumer"
  priorityClass   "safety" | "experience"    // §五 优先级分类
  caseId?         String
  intentId?       String
  agentAction     String
  reason?         String      // 拒绝原因
  correction?     String      // 修正内容
  rating?         Int         // 1-5
  metadata        Json
  createdAt       DateTime
}

KnowledgeEntry {
  id              String
  tenantId        String
  source          "writeback" | "faq" | "manual" | "experience"
  category        String      // 产品/问题类型（Agent 自动分类 + 人工确认）
  content         String
  sourceRef       String      // 来源工单/FAQ ID
  supersededBy?   String      // 被哪条新知识覆盖（§六 漂移处理）

  // §六 衰减字段
  status          "active" | "decaying" | "dormant" | "archived"
  effectiveWeight Float       // 当前有效权重（每日重算）
  decayRate       Float       // 衰减速率（默认 0.01）
  usageCount      Int         // Agent 引用次数
  impactScore     Float       // 引用后解决率
  lastUsedAt      DateTime    // 最后被 Agent 引用的时间
  lastReviewedAt? DateTime    // 最后被 Admin 审核的时间

  createdAt       DateTime
  updatedAt       DateTime
}
```

### 九、Intent Resolution Pipeline（意图解析执行管线）

Agent 的每一个决策都必须经过标准化的执行管线。这不是新组件——代码库中已有 Constitution Engine、Authority Check、Knowledge Injection 等模块，但它们尚未串联为一条强制执行的管线。

**Agent Execution Lifecycle：**

```
                    ┌──────────────┐
                    │   INTENT     │  Agent 产生意图
                    │  (AuditableIntent)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
              ┌─────│ CONSTITUTION │  §五 P0: 硬规则检查
              │     │   ENGINE     │  HARD_REJECTED → 终止 + 记录
              │     └──────┬───────┘
              │            │ PASS / SOFT_WARNING
              │     ┌──────▼───────┐
              │     │  AUTHORITY   │  检查执行权限 (AUTO/CONFIRM/BLOCK)
              │     │    CHECK     │  BLOCK → 终止
              │     └──────┬───────┘  CONFIRM → 排队等待人类审批
              │            │ AUTO / APPROVED
              │     ┌──────▼───────┐
              │     │  KNOWLEDGE   │  §五 P2: 注入相关知识
              │     │  INJECTION   │  按 effectiveWeight 排序
              │     └──────┬───────┘  注入 top-K 条目到 context
              │            │
              │     ┌──────▼───────┐
              │     │  CONFIDENCE  │  基于历史 Ledger 数据校准
              │     │ CALIBRATION  │  类似意图的历史成功率
              │     └──────┬───────┘  低于 autonomyThreshold → 升级
              │            │
              │     ┌──────▼───────┐
              │     │  EXECUTION   │  IPlatformAgent.execute()
              │     │              │  产生 ExecutionReceipt
              │     └──────┬───────┘
              │            │
              │     ┌──────▼───────┐
              └────→│  CONFIDENCE  │  写入 Confidence Ledger (§十)
                    │   LEDGER     │  记录完整决策上下文
                    │   WRITE      │  无论成功/失败/拒绝都记录
                    └──────────────┘
```

**关键设计点：**

- **每一步都产生审计记录**：即使 Intent 在 Constitution 阶段就被拒绝，也写入 Ledger
- **管线是强制的**：没有"绕过"路径，所有 Agent 行为必经此管线
- **管线是可配置的**：通过 Tenant Maturity Model (§十一) 动态调整各阶段的阈值
- **与 OODA 对齐**：Observe（Knowledge Injection）→ Orient（Confidence Calibration）→ Decide（Constitution + Authority）→ Act（Execution）

### 十、Confidence Ledger（置信度账本）

每次 Agent 行为都在 Ledger 中留下一条不可变记录。这是系统的"记忆脊柱"——RL 训练、联邦学习、资本层调度都将基于此。

**Ledger 记录结构：**

```
ConfidenceLedger {
  id                  String      @id
  tenantId            String
  intentId            String      // 关联的 AuditableIntent
  caseId?             String      // 关联的工单（如有）
  agentAction         String      // Agent 执行的动作

  // 决策上下文快照
  confidenceBefore    Float       // 执行前 Agent 置信度
  confidenceAfter     Float       // 反馈后校准的置信度
  knowledgeUsed       String[]    // 引用的 KnowledgeEntry IDs
  knowledgeWeights    Float[]     // 各知识条目的 effectiveWeight
  ruleTriggered       String[]    // 触发的 Constitution 规则 IDs
  ruleResult          String      // "pass" | "soft_warning" | "hard_rejected"
  authorityLevel      String      // "auto" | "confirm" | "block"

  // 执行结果
  executionResult     String      // "success" | "failed" | "escalated" | "rejected"
  executionLatencyMs  Int         // 执行耗时

  // 人类反馈（异步填充）
  feedbackType?       String      // "accept" | "reject" | "modify" | null
  feedbackReason?     String      // 拒绝原因
  feedbackSourceRole? String      // 谁给的反馈
  feedbackAt?         DateTime    // 反馈时间

  // 元数据
  pipelineVersion     String      // 管线版本号（用于 A/B 测试）
  tenantMaturityScore Float       // 执行时的租户成熟度
  agentAutonomyLevel  String      // 执行时的自主权级别

  createdAt           DateTime
}
```

**Ledger 的三个用途：**

| 用途 | 说明 | 时间线 |
|------|------|--------|
| **审计追溯** | 任何 Agent 行为都可追溯到完整决策链 | 当前 |
| **置信度校准** | `confidenceAfter = f(confidenceBefore, feedbackResult)` 用于校准 Agent 的自我评估准确性 | 当前 |
| **RL / 联邦学习基础** | Ledger 数据是 reward signal 的来源：`reward = feedbackType == "accept" ? +1 : feedbackType == "reject" ? -1 : 0` | 未来 |

**Ledger 写入时机：**

- Intent 被 Constitution 拒绝 → 写入（`executionResult: "rejected"`, `ruleResult: "hard_rejected"`）
- Intent 等待人类审批 → 写入（`executionResult: "escalated"`, `authorityLevel: "confirm"`）
- Intent 执行成功 → 写入（`executionResult: "success"`）
- 人类反馈到达 → 更新（填充 `feedbackType`, `feedbackReason`, `confidenceAfter`）

**与 FeedbackSignal 的关系：**

`FeedbackSignal` 是面向养分管道的（记录"人类喂了什么"），`ConfidenceLedger` 是面向执行管线的（记录"Agent 做了什么以及效果如何"）。两者通过 `intentId` / `caseId` 关联，但职责不同。

### 十一、Tenant Maturity Model（租户成熟度模型）

冷启动和成熟期不应该是写死的 if/else，而应该是一个动态评分系统。

**两个核心指标：**

```
TenantMaturityScore (TMS)  ←→  AgentAutonomyLevel (AAL)
```

**TenantMaturityScore 计算：**

```
TMS = w1 × knowledgeScore + w2 × ruleScore + w3 × feedbackScore + w4 × historyScore

其中：
  knowledgeScore  = min(1.0, activeKnowledgeEntries / 50)     // 知识库丰富度
  ruleScore       = min(1.0, constitutionRules / 10)           // 规则完整度
  feedbackScore   = min(1.0, totalFeedbackSignals / 100)       // 反馈积累量
  historyScore    = min(1.0, ledgerEntries / 500)              // 历史行为量

  w1 = 0.3, w2 = 0.2, w3 = 0.25, w4 = 0.25
```

**AgentAutonomyLevel 映射：**

| TMS 区间 | AAL | Agent 行为 | UI 表现 |
|----------|-----|-----------|---------|
| 0.0 - 0.2 | **L1: Guided** | 所有操作需人类确认，escalationThreshold = 0.9 | 引导式入驻向导，"Agent 正在学习中" |
| 0.2 - 0.5 | **L2: Assisted** | 低风险操作自动执行，中高风险需确认 | "Agent 可处理常见问题" |
| 0.5 - 0.8 | **L3: Supervised** | 多数操作自动执行，仅高风险需确认 | "Agent 运行良好，偶尔需要指导" |
| 0.8 - 1.0 | **L4: Autonomous** | 仅 Constitution 硬规则和安全类需确认 | "Agent 高度自主，人类监督" |

**动态调节机制：**

- TMS 每日重算（基于 Confidence Ledger 统计）
- AAL 变更时通知 Tenant Admin（"您的 Agent 自主权已从 L2 升级至 L3"）
- Admin 可手动覆盖 AAL（降级但不可超越 TMS 上限升级）
- 连续 3 次严重错误 → AAL 自动降一级 + 通知 Admin

**数据模型：**

```
TenantMaturity {
  tenantId            String      @id
  maturityScore       Float       // 0.0 - 1.0
  autonomyLevel       String      // "guided" | "assisted" | "supervised" | "autonomous"
  autonomyOverride?   String      // Admin 手动覆盖（只能降级）

  // 分项得分
  knowledgeScore      Float
  ruleScore           Float
  feedbackScore       Float
  historyScore        Float

  // 阈值配置（随 AAL 动态调整）
  escalationThreshold Float       // 置信度低于此值 → 升级人类
  autoExecuteLimit    Float       // 金额低于此值 → 自动执行

  lastCalculatedAt    DateTime
  updatedAt           DateTime
}
```

**与 Intent Resolution Pipeline 的集成：**

Pipeline 的 Confidence Calibration 阶段读取 `TenantMaturity.escalationThreshold`，Authority Check 阶段读取 `TenantMaturity.autonomyLevel` 来决定是否需要人类确认。这样冷启动和成熟期的逻辑不是写死的 if/else，而是由数据驱动的动态调节。

## Why This Approach

### 考虑过的替代方案

**方案 A：独立 Harness 管理页面** — 创建专门的 `/harness-config` 页面让用户集中配置所有养分。
- 优点：集中管理
- 缺点：违反"最小摩擦"原则，用户不会主动去"喂养"页面
- 否决原因：增加工作量而非减少

**方案 B：纯自动化学习** — Agent 完全从行为数据中自学，无需人类显式输入。
- 优点：零人工成本
- 缺点：无法学习业务规则、安全红线、领域知识；黑盒不可控
- 否决原因：违反 Sovereign 架构的 Constraint Power 原则

**方案 C（选定）：嵌入式三通道养分系统** — 在现有工作流关键节点嵌入养分收集，三层反馈让供给者看到效果。
- 优点：最小摩擦、利用现有 UI、符合 Sovereign 架构
- 缺点：需要改造多个现有页面
- 选定原因：平衡了人类控制与 AI 自主性，且与现有代码库高度兼容

## Key Decisions

**养分层：**
1. **三通道模型**：知识 + 规则 + 反馈是三种不同类型的养分，分别有不同的存储、索引和引用机制
2. **三方供给者**：Admin 喂规则、Operator 喂知识+反馈、Consumer 通过行为间接喂养
3. **嵌入式入口**：不创建独立喂养页面，在 6 个现有工作流节点嵌入养分收集
4. **养分优先级栈**：RULES (P0) > SAFETY FEEDBACK (P1) > KNOWLEDGE (P2) > EXPERIENCE FEEDBACK (P3)
5. **养分衰减机制**：`effectiveWeight` 自动代谢 + 漂移检测预警

**治理层：**
6. **Intent Resolution Pipeline**：Agent 每个决策必经 Constitution → Authority → Knowledge Injection → Confidence Calibration → Execution → Ledger Write 标准管线，无绕过路径
7. **Confidence Ledger**：每次 Agent 行为的完整审计账本，记录 confidenceBefore/After、knowledgeUsed、ruleTriggered、feedbackResult — 是 RL/联邦学习/资本调度的基础数据
8. **Ledger 与 FeedbackSignal 分离**：FeedbackSignal 记录"人类喂了什么"，Ledger 记录"Agent 做了什么以及效果如何"，通过 intentId 关联

**成熟度层：**
9. **TenantMaturityScore (TMS)**：基于知识丰富度、规则完整度、反馈积累量、历史行为量的加权评分（0.0-1.0）
10. **AgentAutonomyLevel (AAL)**：L1 Guided → L2 Assisted → L3 Supervised → L4 Autonomous，由 TMS 驱动动态调节
11. **Admin 可降级不可超限升级**：Admin 可手动降低 AAL，但不可超越 TMS 上限升级
12. **连续错误自动降级**：3 次严重错误 → AAL 自动降一级 + 通知 Admin

**反馈层：**
13. **三层反馈**：L1 即时微反馈 + L2 仪表盘指标 + L3 因果链
14. **反馈措辞铁律**：不过度承诺学习效果，所有 L1/L3 反馈必须可验证、可追溯到具体记录

**数据模型：**
15. **四个新数据模型**：`FeedbackSignal`、`KnowledgeEntry`（含衰减字段）、`ConfidenceLedger`、`TenantMaturity`

## Resolved Questions

1. **Writeback 自动分类** → **Agent 自动分类 + 人工确认**：Agent 预填产品/问题类型标签，Operator 一键确认或修改。最小摩擦，同时保证分类准确性。

2. **反馈信号权重** → **上下文加权**：各答各的题——Admin 规则类反馈权重高，Operator 知识类反馈权重高，Consumer 满意度反馈权重高。不是简单的角色层级，而是"谁在自己的领域说话最有权威"。

3. **知识冲突处理** → **分阶段策略**：
   - 当前阶段：Admin 审核（冲突时标记为"待审核"，Admin 决定哪个正确）+ 保留两者（Agent 在不确定时展示两种方案让人类选择）
   - 成熟阶段：加入置信度融合（Agent 根据两者的使用效果自动调整权重）

4. **冷启动策略** → **引导式入驻 + TenantMaturityScore 驱动的动态自主权**：
   - 新租户首次登录时引导上传产品手册、设置基本规则（引导式入驻优先）
   - 初始 TMS = 0.0 → AAL = L1 Guided（所有操作需人类确认）
   - 随养分积累 TMS 自动上升 → AAL 逐步升级 → Agent 自主权动态放开
   - 不再是写死的 if/else 冷启动逻辑，而是数据驱动的连续体

## Open Questions

（无——所有问题已解决）

## Next Steps

→ 运行 `/workflows:plan` 进行实施规划
