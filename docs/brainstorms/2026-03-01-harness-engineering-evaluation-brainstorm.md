---
date: 2026-03-01
topic: harness-engineering-evaluation
---

# Harness Engineering 对系统的必要性评估

## What We're Building

将 Harness Engineering 7 层架构作为系统的**工程骨架**，与现有 Sovereign AI-Native 架构**融合**而非替代。Sovereign 架构（Death Line / 四权分立 / OODA / Constitution）保留为治理内核，Harness 7 层补齐缺失的工程基础设施——特别是记忆、进化、工具注册、协作和可观测性。

## Why This Approach

### 考虑过的方案

| 方案 | 结论 |
|------|------|
| A. 保持现状，Harness 是过度工程 | **否决** — 3 个断裂点（工具有名无实、前端 mock、执行无闭环）不会自动解决 |
| B. 融合架构：Sovereign 治理内核 + Harness 工程骨架 | **选中** — 保留已有投入，补齐真正缺失的能力 |
| C. 全面重构为 Harness 7 层 | **否决** — Phase 1 的 8 周工作部分作废，MVP 阶段全面重构风险极高 |

### 选择方案 B 的核心理由

两者解决的是完全不同层面的问题，天然互补：

```
Sovereign 架构 → "Agent 的决策应该遵守什么规则？"  → 治理模型
Harness 7 层   → "Agent 怎么被驱动、观测、进化？"  → 工程基础设施
```

关系模型：

```
┌─────────────────────────────────────────┐
│  Harness 7 层（工程骨架 / 操作系统）     │
│  ┌─────────────────────────────────┐    │
│  │  Sovereign 架构（治理内核）      │    │
│  │  Death Line · 四权 · OODA       │    │
│  └─────────────────────────────────┘    │
│  基础层 · 执行层 · 工具层 · 记忆层      │
│  协作层 · 观测层 · 进化层               │
└─────────────────────────────────────────┘
```

## Key Decisions

- **不替代 Sovereign，而是包裹它**：Death Line、Constitution、OODA、四权分立全部保留，作为 Harness 各层的具体实现策略
- **渐进式演进**：每一层可以独立推进，不需要一次性全部实现
- **MVP 阶段优先级**：先补最痛的缺口（工具层实际调用、执行闭环），再建高阶能力（记忆、进化）

## 当前系统成熟度（基线）

```
Layer 7  进化层  ░░░░░░░░░░░░░░░░░░░░  5%   仅有 UI 占位
Layer 6  观测层  ████████████░░░░░░░░  60%  ReasoningLog + OODA 可视化
Layer 5  协作层  ████░░░░░░░░░░░░░░░░  20%  MDM 事件定义 + SSE
Layer 4  记忆层  ░░░░░░░░░░░░░░░░░░░░  0%   完全空白
Layer 3  工具层  ██████░░░░░░░░░░░░░░  30%  工具列表定义，未实际调用
Layer 2  执行层  ████████░░░░░░░░░░░░  40%  LangGraph 线性流，无 retry
Layer 1  基础层  ████████████████░░░░  80%  多租户 + 协议 + 白名单
```

## 融合映射表

| Harness 层 | 已有 Sovereign 资产 | 需要新增 |
|------------|---------------------|----------|
| Layer 1 基础层 | 租户隔离 (`withTenant`)、`TENANT_WHITELIST`、`AuditableIntent` 协议 | `AgentIdentity` / `AgentRole` 身份模型；租户配置中心化 |
| Layer 2 执行层 | LangGraph 8 节点线性流、`verify_brain_purity()`、Kill Switch | retry / recovery 机制；conditional edge；统一异常处理 |
| Layer 3 工具层 | `initial_tools()` 定义、`IPlatformAgent` 接口、`PlatformAgentRegistry` | `ToolRegistry` 统一注册；工具实际调用（替代 mock）；结果校验 |
| Layer 4 记忆层 | （空白） | 短期记忆（会话级 context）；长期记忆（experience 表）；向量检索 |
| Layer 5 协作层 | `MdmEvent` 类型定义、`onMdmEvent/emitMdmEvent`、SSE | Agent EventBus；`emitMdmEvent` 实际触发；多 Agent 编排 |
| Layer 6 观测层 | `ReasoningLog` OODA 完整结构、`sovereign-governance-insight.tsx` 可视化、`traceId` 贯穿 | 分布式 Tracer (span)；Metrics；结构化日志；governance-dashboard 接真实数据 |
| Layer 7 进化层 | `evolution-dashboard.tsx` UI 占位 | `evaluate_session`；`distill_pattern`；反馈闭环；Evolution Dashboard 接真实数据 |

## 三个断裂点（必须优先修复）

1. **工具层"有名无实"**：`initial_tools()` 定义了 9 个工具名，但 graph 中没有节点真正调用它们，`load_performance_node` 直接用 `_mock_performance_for_listing()` 生成假数据
2. **前端治理看板与后端脱钩**：`governance-dashboard.tsx` 的 `INTENT_LOGS`、`HARD_RULES` 全部前端硬编码，`/approvals` API 未 join `AgentExecutionLog`
3. **执行结果无闭环**：Intent → Constitution → 审批 → 执行，但 `ExecutionReceipt` 没有回写，进化层无数据源

## Resolved Questions

- **Q1**：记忆层优先级 → **先补执行闭环，再同步推进工具层和记忆层**。执行闭环（`ExecutionReceipt` 回写）是所有高阶能力的"供血系统"——工具层需要它验证结果，记忆层需要它存经验，进化层需要它评分。没有闭环，Layer 4/6/7 全部是无源之水。
- **Q2**：配置方式 → **各层独立配置**。系统处于早期阶段，各层成熟度差异巨大（0% ~ 80%），统一配置是过早优化。等 Layer 1-6 都达到 60%+ 时，再考虑引入轻量级注册表。
- **Q3**：进化层启动时机 → **现在就搭数据管道，逻辑后补**。只做"数据收集"不做"数据分析"——每次执行的结果、评分、上下文都存下来，但不急着做蒸馏和优化。成本极低（多写几条 DB 记录），但当某天启动进化层时，手里已经有了数月的真实执行数据。
- **Q4**：架构文档组织 → **Sovereign 宪法不动 + Harness 独立文档 + 索引桥接**。在 `.cursorrules` 末尾加索引章节指向 `docs/harness-architecture.md`。Sovereign 的 4 条 Mandate 保持"硬约束"，Harness 7 层作为"工程实践指南"独立存在。

## Implementation Priorities

基于以上决策，推荐的实施顺序：

```
Phase 1 — 通闭环（杠杆最大）
├── 1a. ExecutionReceipt 回写到 DB
├── 1b. 进化层数据管道（experience 表 schema + 每次执行自动写入）
└── 1c. /approvals API join AgentExecutionLog，前端展示真实 governance 数据

Phase 2 — 补工具层
├── 2a. ToolRegistry 统一注册机制
├── 2b. load_performance_node 调用真实 read 工具（替代 mock）
└── 2c. 工具调用结果校验

Phase 3 — 建执行韧性
├── 3a. LangGraph conditional edge（分支/合并）
├── 3b. retry / recovery 机制
└── 3c. 统一异常处理

Phase 4 — 启高阶能力
├── 4a. 短期记忆（会话级 context buffer）
├── 4b. Agent EventBus + emitMdmEvent 实际触发
├── 4c. governance-dashboard 接真实数据
└── 4d. 结构化日志 + Tracer span

Phase 5 — 进化层逻辑
├── 5a. evaluate_session（基于积累的执行数据评分）
├── 5b. distill_pattern（从高分经验中蒸馏策略）
└── 5c. Evolution Dashboard 接真实数据
```

## Architecture Documentation Plan

```
.cursorrules                          ← 保持不变（Sovereign 宪法）
  + 末尾新增 "Harness 层级索引" 章节   ← 桥接指向下方文档

docs/harness-architecture.md          ← 新建：Harness 7 层工程实践指南
  ├── 各层定义与职责
  ├── 融合映射表（Sovereign ↔ Harness）
  ├── 各层配置说明
  └── 成熟度基线与目标
```

---

## Addendum: 终极目标倒推 — 七大能力 vs 现实差距

> **终极目标：系统不需要你手动调整，它自己就能越来越聪明。**
> **核心判断标准：10000 个卖家时，运营团队规模是否需要同比增长？**

### 七大能力成熟度

```
能力 1  统一数据基座      ███████████░░░░░░░░░  55%
能力 2  独立学习单元      ██░░░░░░░░░░░░░░░░░░  10%
能力 3  三层知识隔离      ████████░░░░░░░░░░░░  40%
能力 4  产品生命周期      ███████░░░░░░░░░░░░░  35%
能力 5  跨维度归因        ░░░░░░░░░░░░░░░░░░░░  0%
能力 6  可组合 Agent 网络 █████░░░░░░░░░░░░░░░  25%
能力 7  置信度输出        ██████░░░░░░░░░░░░░░  30%
```

### 逐项差距分析

#### 能力 1：统一数据基座 — 55%

**已有：**
- Product/Commodity/Listing 三级数据模型
- PerformanceSnapshot 具备 platform/market/brand/category/fulfillment 多维标签
- `killer-query.sql` 支持多维度切片查询
- Product 有 costPrice/msrp，Commodity 有 localBaseCost/targetMargin

**缺口：**
- 无统一利润计算公式（散落在各处，未集中）
- 无 seller 维度标签
- 无 channel（派送渠道）维度
- Product/Commodity/Listing 维度标签不统一，需多次 join 才能获得完整维度

#### 能力 2：独立学习单元 — 10%

**已有：**
- LangGraph 单一决策流程已跑通

**缺口：**
- 只有一条决策路径，所有平台/市场/品类共用同一逻辑
- 无按维度拆分的 Agent 实例
- 无联邦或分治决策架构
- 无独立的记忆/评分/进化节奏

#### 能力 3：三层知识隔离 — 40%

**已有：**
- RLS 租户隔离完整（14 张表，基于 `app.tenant_id`）
- API 层 `withTenant()` 中间件

**缺口：**
- 只有 Layer C（卖家私有隔离），缺少 Layer A（公共知识）和 Layer B（行业聚合）
- 无脱敏/匿名化逻辑
- 无跨租户聚合查询能力

#### 能力 4：产品生命周期 — 35%

**已有：**
- Product.lifecycleStage / Commodity.lifecycleStage 字段存在
- 前端 product-profile-view 展示 lifecycleStage
- RUNTIME_FACT_FIELDS 包含 lifecycle

**缺口：**
- lifecycleStage 为人工/默认值（"NEW"），非数据驱动
- 无阶段判断算法（销售趋势斜率、市场份额、评论增长率、广告效率曲线）
- 无阶段驱动的差异化策略

#### 能力 5：跨维度归因 — 0%

**完全空白。** 无归因模型、无汇率处理、无竞品监控、无因果分析。

#### 能力 6：可组合 Agent 网络 — 25%

**已有：**
- LangGraph StateGraph 基础框架
- IPlatformAgent 接口 + PlatformAgentRegistry

**缺口：**
- 8 节点全部线性串联，无 conditional edge
- 无动态子图选择
- 无 Orchestrator 编排层
- 无按任务场景组合不同 Agent 链的能力

#### 能力 7：置信度输出 — 30%

**已有：**
- rules-engine 中有 `rule.confidence` 计算
- intent-compiler 输出含 confidence 字段

**缺口：**
- ReasoningLog / AuditableIntent 无 confidence 字段
- Agent 决策输出不携带置信度
- 无 sample_size、uncertainty、unknown_factors 等不确定性指标

### Harness 7 层 × 七大能力 交叉映射

```
                    能力1  能力2  能力3  能力4  能力5  能力6  能力7
                    数据   学习   隔离   生命   归因   组合   置信
                    基座   单元   架构   周期   引擎   网络   度
Layer 1 基础层       ●             ●
Layer 2 执行层                            ●            ●
Layer 3 工具层       ●      ●                   ●
Layer 4 记忆层              ●      ●                          ●
Layer 5 协作层              ●                          ●
Layer 6 观测层       ●                    ●      ●            ●
Layer 7 进化层              ●             ●      ●            ●

● = 该 Harness 层是实现该能力的关键支撑
```

### 修订后的实施优先级

原 Phase 1-5 保持不变（聚焦 Harness 工程基础设施），新增 Phase 6-8 对接七大业务能力：

```
Phase 1-5 — Harness 工程基础设施（原计划不变）

Phase 6 — 数据基座补全
├── 6a. 统一利润计算服务（集中公式）
├── 6b. 维度标签补全（seller、channel）
└── 6c. 产品生命周期自动判断算法

Phase 7 — Agent 网络升级
├── 7a. LangGraph conditional edge + 动态子图
├── 7b. 按维度拆分的 Agent 实例（平台/市场/品类）
├── 7c. Orchestrator 编排层
└── 7d. AgentOutput 标准结构（含 confidence/sample_size/uncertainty）

Phase 8 — 高阶智能
├── 8a. 三层知识隔离（脱敏 + 聚合层 + 共享知识库）
├── 8b. 跨维度归因引擎（汇率/竞品/物流/广告因子分解）
└── 8c. 进化层蒸馏逻辑接入真实数据
```

### 终极验证标准

> 三年后，10000 个卖家时，运营团队规模是否需要同比增长？
> 如果不需要 → Harness Engineering 做对了。

## Next Steps

→ 运行 `/workflows:plan` 基于本文档生成具体实施计划
