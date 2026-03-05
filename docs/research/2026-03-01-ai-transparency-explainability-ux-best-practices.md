# AI 透明度与可解释性 UX 最佳实践研究

**研究日期：** 2026-03-01  
**适用场景：** AI Agent 向人类 Operator 提供建议的生产级应用  
**信息来源：** 行业实践 (2024–2026)、Agentic Design、Google PAIR、Nielsen Norman Group、Intent Color Affordance Pattern

---

## 执行摘要

可信的 AI 推荐界面需要做到三点：**透明**（逻辑可见）、**可解释**（输入→输出因果清晰）、**可辩护**（有推理过程，而非猜测）。本报告针对 Harness 系统的 7 个核心需求，整理可落地的 UX 模式、组件结构和微文案示例。

---

## 1. 置信度展示模式（Confidence + 数据新鲜度）

### 1.1 核心原则（Agentic Design CVP + Google PAIR）

| 原则 | 做法 |
|-----|-----|
| 不要只显示「数字」 | 展示置信度 + 驱动因素 + 数据新鲜度 |
| 避免虚假精度 | 用「~95%」「高置信」而非「99.73%」 |
| 颜色需配合文案 | 不要只用颜色，需搭配标签（无障碍 + 语义） |
| 展示不确定性区间 | 高风险场景展示区间而非单点估计 |

### 1.2 推荐展示结构

```
┌─────────────────────────────────────────────────────────────┐
│ [91%]  ▲ High confidence                    Data: 2h ago   │
│ ████████████████████░░░░░                                   │
│ Confidence driven by: 3/3 platforms synced, recent sales  │
└─────────────────────────────────────────────────────────────┘
```

**组件拆解：**

- **主指标**：百分比 + 分类标签（High / Medium / Low 或 置信度区间）
- **进度条/色块**：填充比例对应置信度，颜色映射：
  - 绿：≥85% — 高置信
  - 橙：65–84% — 建议复核
  - 红：<65% — 低置信 / 需人工判断
- **数据新鲜度**：`Data: 2h ago` / `Synced 15 min ago` / `Stale: 3 days`
- **Tooltip / 展开说明**：影响置信度的因素（平台同步、数据覆盖等）

### 1.3 颜色编码（Intent Color Affordance 扩展）

| 置信度 | 颜色 | 标签 | 建议操作 |
|-------|------|------|---------|
| 90–100% | 绿 | High confidence | 可快速采纳 |
| 70–89% | 橙 | Verification recommended | 建议复核再执行 |
| 50–69% | 橙偏红 | Low confidence | 建议人工确认 |
| &lt;50% | 红 | Uncertain | 需人工决策 |

### 1.4 微文案示例

| 场景 | 推荐 copy |
|------|----------|
| 高置信 + 新数据 | `[91%] High confidence · Data refreshed 15 min ago` |
| 中置信 + 部分数据缺失 | `[78%] Medium — 2 of 3 platforms synced. DE market data from 6h ago.` |
| 低置信 | `[62%] Low confidence — suggest manual review` |
| 数据过时 | `[85%] Stale data: last sync 3 days ago` |
| Tooltip | `Confidence driven by: platform sync status, sales recency, inventory coverage` |

### 1.5 避免的做法（NN/G + PAIR）

- ❌ 只用数字、无解释
- ❌ 隐藏不确定性，系统不确定时仍显示很高置信度
- ❌ 对低风险场景过度强调风险，造成视觉疲劳
- ❌ 使用「99.73%」等虚假精度
- ❌ 只用颜色、无文字标签（无障碍问题）

---

## 2. 推理链可视化（OODA: Observe→Orient→Decide→Act）

### 2.1 设计思路

OODA 是决策框架，不是技术实现。展示时聚焦「人类可理解的决策步骤」，而非底层计算细节。

### 2.2 推荐展示结构（渐进式披露）

**Level 1 — 卡片主视区（默认）：**

```
Observe → Orient → Decide → Act
Margins down 4.2% · 3 factors → Cost/competition/volume → Adjust costs → [View RCA]
```

**Level 2 — 展开「Why this recommendation」：**

```
Observe:  Profit margin −4.2% (BT Headphones X1, last 7d)
          Data: Amazon SP-API, DE/UK/FR — synced 2h ago

Orient:   3 contributing factors:
          • Factor 1: COGS +8% (supplier price change)
          • Factor 2: Competitor price drop −5%
          • Factor 3: Volume mix shift to lower-margin SKU

Decide:   Primary lever: Reduce COGS via renegotiation or volume commitment
          Secondary: Match competitor price on 2 key ASINs

Act:      Recommended: [Adjust Costs] or [Draft PO for volume deal]
```

**Level 3 — Technical / 审计用（可选）：**

- 完整 ReasoningLog JSON
- 节点 trace IDs
- 决策时间戳与数据快照版本

### 2.3 组件建议

- **时间线/步骤条**：Observe / Orient / Decide / Act 四步，每步可展开
- **Observe**：只读数据源、指标、快照时间
- **Orient**：影响因素列表，带权重/贡献度
- **Decide**：主建议与备选
- **Act**：推荐动作及一键按钮

### 2.4 与 NN/G 的注意点

NN/G 指出：步骤式推理常为**事后合理化**，未必真实反映模型推理过程。因此：

- ✅ 若 OODA 由**结构化 ReasoningLog** 生成，可放心展示
- ⚠️ 若为模型事后「解释」，需在 UI 中标注为「解释性说明」而非「真实推理过程」
- ✅ Harness 的 ReasoningLog 是结构化的，适合作为 OODA 展示来源

---

## 3. “Why did the AI recommend this?” 可展开说明面板

### 3.1 渐进式披露层次（Agentic Design PDP）

```
agent_response → [show reasoning] → [technical details] → [full trace]
```

建议不超过 3–4 层，避免多层嵌套。

### 3.2 触发与交互

- **默认**：一行摘要 + `Why this?` 链接
- **点击**：展开「Why this recommendation」面板
- **再展开**：可选技术细节（trace / 审计用）
- 记住用户上次展开偏好（localStorage / 用户设置）

### 3.3 微文案示例（Google PAIR 风格）

| 元素 | Copy |
|------|------|
| 触发链接 | `Why this recommendation?` |
| 摘要 | `Based on 3 contributing factors: COGS +8%, competitor price −5%, volume mix shift` |
| 通用解释 | `This app uses margin trends, competitor data, and volume mix to identify cost levers` |
| 具体输出 | `Recommended because margin dropped 4.2% with strong COGS signal; reducing COGS has highest expected impact` |
| 反事实 | `Not recommended for price match because volume impact would exceed margin gain` |

### 3.4 避免的做法（NN/G）

- ❌ 拟人化：「I thought about…」「I searched…」→ 用「The system used…」「Based on…」
- ❌ 不实或模糊引用：链接到不存在或无关页面
- ❌ 把关键限制藏在 footer 或小字里
- ❌ 误导性步骤推理：看起来像真实推理过程，实为事后解释

---

## 4. 拒绝反馈收集 UX（强制枚举 + 可选自由文本）

### 4.1 核心理念：「Teaching」而非「Complaining」

- 文案强调「帮助改进」：`Help the system learn` / `These reasons train the model`
- 避免指责或负向情绪词
- 强调 Operator 的角色：`You're teaching the Agent when to adjust`

### 4.2 推荐组件结构

```
┌────────────────────────────────────────────────────────────────┐
│ Why are you rejecting this recommendation?                      │
│ (Required — this helps the Agent learn)                        │
│                                                                │
│ ○ Data inaccurate — Agent used wrong or stale data             │
│ ○ Different market view — I disagree with market trend         │
│ ○ Company strategy — Conflicts with our current strategy      │
│ ○ Wrong priority — Right idea, wrong timing                    │
│ ○ Other — [________________________]                           │
│                                                                │
│ Additional context (optional):                                 │
│ [________________________________________________________]    │
│                                                                │
│ [Cancel]                                    [Confirm Reject]   │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 微文案对比

| 避免 | 推荐 |
|-----|------|
| Reject (required: reason) | Why are you rejecting? (helps the Agent learn) |
| You must select a reason | Select a reason so we can improve future recommendations |
| Complaint / Feedback | Teaching / Learning |
| Error / Wrong | Different judgment / Incomplete data |

### 4.4 枚举设计原则

- 枚举覆盖 80% 常见原因，保留「Other + 自由文本」
- 每个选项附 1 句解释，降低歧义
- 与业务领域匹配（如：数据不准、市场判断、策略冲突、优先级等）
- 后端存 `rejection_reason_enum + free_text`，便于分析

### 4.5 真实案例参考

- **Microsoft Agent Academy**：结构化反馈 + 可选注释，用于改进 agent 行为
- **Label Studio / RLHF**：人类反馈作为训练信号，强调「teaching the model」

---

## 5. 14 天结果追踪（Outcome Tracking）

### 5.1 目标

通过展示「过去决策带来的结果」建立信任，形成「建议 → 执行 → 结果」闭环。

### 5.2 展示模式

**模式 A — Inbox 推送：**

```
✓ 14 days ago you executed: Pause 3 low-ROAS keywords (LED Desk Lamp Pro)
  Result: ROAS +11% after 24h · Est. saving $420/mo confirmed
  [View details]
```

**模式 B — 历史面板：**

```
Past recommendations you followed:
| Action           | Date    | Expected   | Actual (14d)   |
|------------------|---------|------------|----------------|
| Pause keywords   | 2 weeks | $420/mo    | $398/mo ✓      |
| Adjust costs     | 3 weeks | Margin +2% | Margin +1.8% ✓ |
```

**模式 C — 信任仪表盘：**

- 执行采纳率
- 14 天结果与预期对比
- 校准曲线（若可用）：展示「系统预期 vs 实际」的一致性

### 5.3 数据需求

- 决策时间戳
- 执行/拒绝操作记录
- 14 天后业务指标快照
- 可选：预期 vs 实际对比字段

### 5.4 微文案示例

| 场景 | Copy |
|------|------|
| 符合预期 | `Result: ROAS +11% · as expected` |
| 略低于预期 | `Result: Margin +1.8% (expected +2%)` |
| 超出预期 | `Result: Est. saving $420 → actual $512` |
| 无数据 | `Outcome pending — check back in 14 days` |

---

## 6. 信任校准与渐进式披露

### 6.1 原则（Agentic Design PDP + PAIR）

- 先用最少必要信息，按需逐层展开
- 每层信息需明确「用户可获得什么」
- 层级建议：摘要 → 详细 → 技术/审计（2–3 层足够）

### 6.2 信息分层示例

| 层级 | 内容 | 触发 |
|-----|------|------|
| L1 | 建议摘要 + 置信度 + 操作按钮 | 默认 |
| L2 | OODA 推理、Why this、影响因素 | 「Why this?」/「View RCA」 |
| L3 | Trace ID、JSON、数据快照 | 「Technical details」/「Audit」 |

### 6.3 交互建议

- 使用一致的展开/收起图标
- 展开过渡要平滑
- 支持键盘操作
- 提供「Expand all / Collapse all」
- 不要将关键信息藏在多次点击后

---

## 7. “Worth Learning” 标记模式

### 7.1 用途

标记「特别值得学习的决策」，用于进化层优先训练，形成高质量训练集。

### 7.2 推荐交互

- **执行后**：`✓ Executed · [Mark as Worth Learning]`
- **修改后**：`Modified · Original vs your change recorded · [Mark as Worth Learning]`
- **标记后**：`★ Worth Learning — will be used to improve future recommendations`

### 7.3 组件结构

```
[Execute] [Modify] [Reject]

After execute/modify:
  ☐ Mark as "Worth Learning" — highlight this as a key example for the model
```

### 7.4 微文案

| 场景 | Copy |
|------|------|
| 勾选前 | `Mark as Worth Learning — use this as a training example` |
| 勾选后 | `★ Worth Learning — added to evolution training set` |
| 说明 | `Worth Learning examples help the Agent improve in similar situations` |

### 7.5 与 RLHF / Label Studio 的对应

- 类似 RLHF 中的「偏好样本」
- 可视为「正样本」：人类认可且执行的决策
- 与拒绝原因配合：拒绝 = 负反馈，Worth Learning = 正反馈，共同构成训练集

---

## 8. 铁律视觉强化（不可关闭的持久提示）

### 8.1 设计原则

- 针对合规/安全类规则：不可关闭、不可弱化
- 与 Cookie/DoD 合规横幅类似：必须明确可见，直到用户采取规定动作
- 针对 Harness：拒绝时**必须**选择原因，才能完成操作

### 8.2 推荐实现

**Reject 按钮旁：**

```
[Reject]  ⚠ Reject requires reason selection — feeds Layer 7 evolution
```

**Reject 弹窗顶部：**

```
┌────────────────────────────────────────────────────────────────┐
│ ⚠ Required: Select a reason before rejecting                  │
│ This data trains the Agent — your input improves recommendations │
└────────────────────────────────────────────────────────────────┘
```

**实现要点：**

- 无「跳过」「稍后」「关闭」按钮
- 文案说明原因与用途
- 视觉上显眼（橙/黄警示色 + 图标），但不过度干扰
- 颜色使用 `var(--warning)` / `var(--danger)` 等设计 token

### 8.3 微文案

| 场景 | Copy |
|------|------|
| 按钮旁 | `Reject requires reason — feeds evolution` |
| 弹窗标题 | `Why are you rejecting? (required)` |
| 解释 | `Your reason helps the Agent learn — select one to complete` |

---

## 9. 真实案例与产品参考

### 9.1 Stripe Radar

- **特点**：偏重准确性和性能，用户端解释较少
- **启示**：对高风险决策（如欺诈），可权衡「解释度 vs 响应速度」
- **适用**：低延迟、高吞吐场景

### 9.2 GitHub Copilot Radar

- **特点**：用注意力机制展示「模型关注哪些代码位置」
- **启示**：可解释性可聚焦在「输入中的关键部分」，而非全链路推理
- **适用**：代码、结构化和半结构化数据场景

### 9.3 Notion AI / ChatGPT / Perplexity

- **Citation**：Perplexity 将引用紧贴相关句子，便于核查
- **Disclaimer**：Claude 将 disclaimer 放在显眼位置，用清晰行动导向文案
- **Step-by-step**：ChatGPT Thinking 展示推理步骤，但要警惕「事后解释」问题

### 9.4 Intent Color Affordance (ICA)

- **四色**：无指示 / 蓝（创意）/ 绿（低风险 factual）/ 橙（建议核实）/ 红（高风险）
- **Progressive disclosure**：主界面用色块，hover 展示详细说明
- **Harness 扩展**：在绿/橙/红上叠加置信度百分比与数据新鲜度

---

## 10. 设计 Token 与实现建议（符合 UI Design System）

| 元素 | Token / 类 |
|------|------------|
| 高置信背景 | `color-mix(in srgb, var(--success) 15%, transparent)` |
| 低置信 / 警告 | `var(--warning)` |
| 危险 / 必须注意 | `var(--danger)` |
| 边框 | `var(--panel-border)` |
| 阴影 | `var(--panel-shadow)` |
| 文字 | `var(--text-primary)` / `var(--text-secondary)` |
| 状态徽章 | `<Badge variant="success|warning|danger|info">` |
| 页面结构 | `<PageHeader>`, `<Card>`, `.ios-card` |

---

## 11. 快速对照表

| 需求 | 核心模式 | 关键原则 |
|-----|---------|---------|
| 置信度展示 | 百分比 + 色块 + 数据新鲜度 + Tooltip | 避免虚假精度，颜色配文字 |
| OODA 推理链 | 4 步时间线 + 渐进式披露 | 从结构化 ReasoningLog 生成，避免事后编造 |
| Why this | 可展开面板，2–3 层 | 避免拟人化，明确数据来源 |
| 拒绝反馈 | 强制枚举 + 可选自由文本 | 强调「teaching」，枚举覆盖主要场景 |
| 14 天追踪 | Inbox 推送 + 历史表格 | 建立执行→结果闭环 |
| 渐进式披露 | 摘要 → 详细 → 技术 | 最多 3–4 层，默认展示摘要 |
| Worth Learning | 执行/修改后的可选勾选 | 作为进化层正样本 |
| 铁律 | 持久提示，无关闭 | 在 Reject 流程中强制选择原因 |

---

## 参考文献

- Agentic Design: Confidence Visualization Patterns, Progressive Disclosure Patterns  
- Google PAIR: Explainability + Trust (People + AI Guidebook)  
- Nielsen Norman Group: Explainable AI in Chat Interfaces  
- Carmelyne Thompson: Intent Color Affordance (ICA) Pattern  
- Microsoft Agent Academy: Obtain User Feedback  
- Lee & See (2004): Trust in Automation  
- Stripe Radar, GitHub Copilot Radar 公开文档与案例
