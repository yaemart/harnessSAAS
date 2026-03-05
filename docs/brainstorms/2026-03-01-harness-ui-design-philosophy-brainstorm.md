---
date: 2026-03-01
topic: harness-ui-design-philosophy
depends-on:
  - 2026-03-01-harness-engineering-evaluation-brainstorm.md
  - 2026-03-01-ui-role-interaction-spec-brainstorm.md
status: draft
---

# Harness UI 设计哲学与终极规格

> 本文档是 UI 交互规格的**上层设计哲学**，回答"为什么这样设计"而非"具体怎么做"。
> 具体页面线框图见 `ui-role-interaction-spec-brainstorm.md`，实施计划见 `harness-fullstack-implementation-plan.md`。

---

## Section 0 — UI 设计哲学：神经接口，不是仪表盘

### 核心命题

传统仪表盘是**数据的展示窗口**——把指标摆出来，人类自己判断、自己决策、自己执行。

Harness UI 是**人与自进化系统之间的神经接口**——系统判断什么需要人类注意力，人类的每个回应都在训练系统变得更聪明。

```
传统仪表盘                          Harness UI（神经接口）
─────────────────────              ─────────────────────
人找数据                            系统找人
人做判断                            系统做判断，人做校准
操作后系统忘记                       操作后系统记住并学习
所有人看同一个界面                    每个角色看到自己的神经末梢
数据是终点                          数据是飞轮的燃料
```

### 神经接口三维定义

三个维度共同构成完整的神经接口，缺一不可：

#### 维度 1：系统主动推送（传入神经）

系统判断什么需要人类注意力，主动推送，人类只需要回应。

| 传统仪表盘 | Harness UI |
|-----------|-----------|
| 人打开页面，浏览 50 个图表 | Agent 推送 3 件紧急事项到你面前 |
| 人判断哪个指标异常 | Agent 已经判断好异常，告诉你为什么异常 |
| 人决定优先级 | Agent 按紧急程度排好序 |

**工程映射：** Layer 5 协作层 EventBus → SSE 推送 → 前端待办队列

#### 维度 2：透明窗口（信任建立器）

让人类看懂 Agent 在想什么，建立信任。没有信任，人类不会授权更多自动化。

| 传统仪表盘 | Harness UI |
|-----------|-----------|
| 显示结果数字 | 显示推理过程（OODA 链） |
| "ACOS 是 42%" | "ACOS 飙升至 42%，因为竞品 B 降价导致点击分流，建议暂停该广告组" |
| 无置信度概念 | "置信度 87%，基于过去 7 天 2,341 次点击数据" |

**工程映射：** Layer 6 观测层 → ReasoningLog + OODA 可视化 + 置信度展示

#### 维度 3：双向反馈循环（传出神经 → 进化燃料）

人类的每个操作都是喂给系统的训练信号。UI 要让用户意识到「我的每个动作都在教 Agent」。

| 传统仪表盘 | Harness UI |
|-----------|-----------|
| 点击"确认"，完事 | 点击"执行"→ 系统记录"人类同意此类决策" |
| 点击"取消"，无后续 | 点击"拒绝"→ **必须选原因** → 系统学到"这类场景人类不认可" |
| 修改参数，系统不知道为什么 | 修改参数 → 系统对比原始建议与人类修正，学习偏差模式 |

**工程映射：** Layer 7 进化层 → rejectionReason 收集 → experience 表 → distill_pattern

### 飞轮效应

三个维度形成自增强飞轮：

```
推送引起注意 → 透明建立信任 → 信任授权更多自动化
      ↑                                    │
      │                                    ↓
  系统变聪明 ← 进化层蒸馏模式 ← 反馈驱动进化
```

**量化验证：** 飞轮是否转起来的核心指标是「自动执行比例」——
- Sprint 4 后：30%（人类还在大量校准）
- Sprint 8 后：70%（系统已学会大部分场景）
- 终极目标：90%+（人类只处理真正的边缘案例）

### 五大反模式消灭清单

| # | 反模式 | 传统仪表盘表现 | Harness UI 对策 | 验证方式 |
|---|--------|--------------|----------------|---------|
| 1 | **被动展示** | 数据摆在那里，不告诉你该做什么 | Agent 主动推送待办 + 建议 + 原因 | 首页零图表，全是待办卡片 |
| 2 | **信息过载** | 50 个图表，无优先级 | Agent 按紧急程度排序，低优先级折叠 | Operator 首页 ≤ 5 条紧急待办 |
| 3 | **无反馈闭环** | 用户操作后系统不记录不学习 | 每次操作写入 experience 表，拒绝必须选原因 | experience 表日增记录数 > 0 |
| 4 | **千人一面** | 所有角色看同一界面 | 5 角色 × 独立页面集 × 字段级过滤 | Supplier 永远看不到售价 |
| 5 | **数据是终点** | 展示完就结束了 | 数据 → 建议 → 操作 → 反馈 → 进化 | Evolution Dashboard 有真实学习曲线 |

**最致命的反模式是 #3（无反馈闭环）**——它直接杀死 Layer 7 进化层。进化层当前只有 5% 成熟度，最大瓶颈就是没有数据。每一个被忽略的用户反馈，都是进化层损失的一条训练信号。

### 交互规格四字段标准

**所有页面的交互规格必须使用统一的四字段结构。** 这不是文档格式偏好，而是确保每个交互都能回答"它如何融入 Harness 体系"。

| 字段 | 含义 | 示例 |
|------|------|------|
| **触发条件** | 什么情况下触发这个交互 | Agent 检测到利润率转负 |
| **用户做什么** | 用户的具体操作 | 点击 View RCA 按钮 |
| **系统响应** | 系统如何回应 | 展开根因分析面板，显示 3 个贡献因素 |
| **Harness 层** | 对应哪个 Harness 层 | Layer 6 观测层 |

**AUTO 标签规则：** 当交互由系统自动触发（无需用户操作）时，必须在 Harness 层前标注 `AUTO`。

示例：

```
Layer 2 · Execution
AUTO   One-tap execute        ← 用户点一下，系统自动执行全部
▼
Layer 7 · Evolution
       Reject (REQUIRED: reason)  ← 用户必须提供原因
▼
Layer 5 · Collaboration
       Ask agent              ← 用户主动追问
▼
Layer 7 · Evolution
       Mark as 'Worth Learning'   ← 用户标记有价值的案例
▼
Layer 4 · Memory
AUTO   14-day outcome push    ← 系统 14 天后自动推送结果
▼
```

AUTO 交互的前端实现要求：
- 不需要用户确认弹窗（除非 Constitution 拦截）
- 执行后显示 toast 通知而非阻塞式弹窗
- 写入 experience 表时标记 `trigger: auto`

### 铁律视觉强制规范

**每个角色的铁律不仅是后端逻辑，必须在 UI 层有持续可见的视觉提醒。** 前端开发不能把铁律当成"可选的 UX 优化"——它们是系统进化的燃料，必须强制执行。

#### 铁律提示条规范

每个涉及铁律的 UI 组件，必须包含一条**橙色/琥珀色提示条**，使用 `warning` token（`#FBBF24`），持续可见（不可关闭）：

| 角色 | 铁律 | 提示条文案 | 出现位置 |
|------|------|-----------|---------|
| Operator | 拒绝必须选原因 | `⚠ Reject requires reason selection — feeds Layer 7 evolution` | 每张 Inbox 卡片的 Reject 按钮旁 |
| Tenant Admin | 授权中心不可跳过 | `⚠ New agent capabilities default to BLOCK — explicit authorization required` | Agent Authority 页面顶部 |
| System Admin | 看不到租户业务数据 | `⚠ Tenant business data is isolated — only aggregate metrics visible` | 所有 /admin/* 页面顶部 |
| Supplier | 售价利润不可见 | `⚠ Pricing and margin data is restricted — supplier view only` | 供应商门户顶部 |
| Viewer | 零操作 | `⚠ Read-only view — no actions available` | /reports 页面顶部 |

#### 提示条 CSS 规范

```css
.iron-law-banner {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border-left: 3px solid var(--warning);
  color: var(--warning);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
```

#### 为什么这很重要

Inbox 里每张拒绝卡片都有橙色提示条 `⚠ Reject requires reason selection — feeds Layer 7 evolution`。这告诉前端开发：

1. **这不是可选的 UX 优化** — 这是系统进化的燃料
2. **必须强制执行** — 没有原因的拒绝 = Layer 7 丢失一条训练信号
3. **视觉提醒必须持续可见** — 不能被用户关闭或隐藏
4. **文案必须解释"为什么"** — `feeds Layer 7 evolution` 让用户理解自己的操作在训练系统

---

## Section 1 — System Admin：平台运营中心

### 角色本质

System Admin 是**平台的神经外科医生**——维护神经接口本身的健康，但永远不触碰通过接口传输的具体业务数据。

### 铁律

> **看不到任何单一租户的具体业务数据** → Layer C 隔离的 UI 强制执行

这不是"不应该看到"，是"技术上不可能看到"：
- API 层：admin 端点只返回聚合/脱敏数据，SQL 查询不包含 `WHERE tenant_id = ?` 的单租户过滤
- 前端：租户列表显示公司名和聚合指标，但绝不显示具体 SKU、价格、利润、销量、广告数据
- 绝对排除字段：costPrice、msrp、profitMarginPct、sales、acos、roas、spend、supplierCode

### 路由结构

所有 System Admin 页面统一在 `/admin/` 路径下：

| 页面 | 路由 | 主 Harness 层 |
|------|------|--------------|
| 平台运营中心 | `/admin/platform` | Layer 6 观测层 |
| 租户管理 | `/admin/tenants` | Layer 1 基础层 |
| 知识层控制台 | `/admin/knowledge` | Layer 7 进化层 |
| Agent 监控 | `/admin/agent-monitor` | Layer 2 执行层 |
| 隔离审计 | `/admin/isolation-audit` | Layer 1 基础层 |

### 五大工作台

#### 1.1 平台运营中心 (`/admin/platform`)

**设计隐喻：** 飞机驾驶舱——正常时不需操作，出问题立即定位。

**实时健康指标行（顶部横排 StatBadge）：**

| 指标组 | 具体指标 |
|--------|---------|
| 租户 | 活跃租户数 · 今日新增 · 30 日流失率 |
| Agent | 执行总量 · 平均置信度 · 错误率 |
| 知识层 | Layer B 模式数 · 本周新增 · 平均样本量 |
| 性能 | API 响应 P50 / P95 / P99 |

**告警中心（三级告警）：**
- 🔴 严重：RLS 隔离失效 / Agent 错误率 > 5%
- 🟡 警告：某租户成本数据 30 天未更新
- 🟢 信息：新模式蒸馏完成，已推送 47 租户

**进化追踪面板（System Admin 独有）：**
- 本周 Layer C → Layer B 蒸馏了几个模式
- 各品类知识覆盖度热力图（品类 × 市场矩阵）
- 推送效果：模式被执行率 · 平均效果提升

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 新租户审批 | Layer 1 基础层 |
| 知识层审核 | Layer 7 进化层 |
| RLS 隔离审计 | Layer 1 基础层 |
| 蒸馏参数调控 | Layer 7 进化层 |

**神经接口体现：** 告警是系统主动推送的，不是 Admin 主动巡检发现的。Mobile 端只推 🔴 严重告警。

#### 1.2 租户管理 (`/admin/tenants`)

**设计原则：** 管理所有卖家租户的生命周期。

**租户列表（表格视图）：**

| 列 | 说明 |
|----|------|
| 公司名 | 租户名称 |
| 订阅层级 | Free / Pro / Enterprise |
| 活跃产品数 | 聚合数量（不显示具体产品） |
| 本月 Agent 调用量 | 聚合数量 |
| 健康评分 | 三维复合评分 |
| 风险标记 | 异常标记 |

**健康评分（三维复合）：**
- 数据完整性：成本数据是否齐全、是否过期
- Agent 使用深度：授权了多少能力、自动执行比例
- 利润覆盖率：多少产品有完整利润计算

**风险标记（自动检测）：**
- 未上传成本数据（> 30 天）
- 建议从不执行（Operator 拒绝率 > 90%）
- 账单逾期

**租户详情（点击展开）：**
- 订阅管理：套餐升降级 · 到期日
- 用量统计：API 调用 · 存储 · Agent 执行次数
- 违规记录：数据异常 · 合规问题

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 暂停账户 | Layer 1 基础层 |
| 套餐变更 | Layer 1 基础层 |

**关键限制：** 即使暂停租户，也看不到该租户的具体业务数据。操作基于系统指标和健康评分，不基于业务判断。

#### 1.3 知识层控制台 (`/admin/knowledge`)

**设计原则：** 系统「在学什么」「学得好不好」的可视化。

**Layer A 公共知识（手动管理）：**
- 平台规则库：亚马逊政策 / 各国法规 / 季节规律
- 手动编辑，有版本历史
- 变更自动通知受影响租户

**Layer B 聚合知识（蒸馏管理）：**
- 已蒸馏模式列表：品类 · 市场 · 置信度 · 样本量
- 蒸馏队列：待审核的候选模式 → 批准 / 拒绝 / 修改
- 效果追踪：某模式推送 N 户 → 执行率 → 平均效果提升

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 发布新 Layer A 规则 | Layer 7 进化层 |
| 审批 Layer B 模式 | Layer 7 进化层 |

**神经接口体现：** 进化层自动从 Layer C（租户私有数据）中蒸馏候选模式到 Layer B（聚合知识），System Admin 审核后推送给符合条件的租户。这是 Layer 7 → Layer 4 的知识回流通道。

#### 1.4 Agent 监控 (`/admin/agent-monitor`)

**设计原则：** 跨租户的 Agent 执行全景——确保 Agent 行为在全局范围内健康。

**全局 Agent 执行仪表盘：**
- 今日执行总量 · 成功率 · 平均延迟
- 按 Agent 类型分布：广告优化 / 定价 / 库存 / 内容 / 竞品
- 异常检测：某类 Agent 错误率突增 → 自动告警

**租户级 Agent 健康度（匿名化）：**
- 各租户 Agent 使用热力图（Tenant #N，不显示公司名）
- 高拒绝率租户标记（Operator 拒绝率 > 80% → 可能 Agent 不适配该品类）
- 执行结果分布：自动执行 vs 人工确认 vs 被拒绝

**Circuit Breaker 状态：**
- 当前熔断的 Agent 列表 · 熔断原因 · 恢复条件
- 手动 Kill Switch：紧急停止某类 Agent 的全局执行

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 查看 Agent 执行全景 | Layer 2 执行层 |
| 触发 Kill Switch | Layer 2 执行层 |
| 查看熔断状态 | Layer 6 观测层 |

#### 1.5 隔离审计 (`/admin/isolation-audit`)

**设计原则：** 证明数据隔离在正常工作——这是 SaaS 平台的信任基石。

**RLS 策略审计：**
- 所有数据库表的 RLS 策略覆盖率（目标 100%）
- 新表自动检测：新建表未配置 RLS → 🔴 严重告警
- 策略变更历史：谁改了什么、什么时候改的

**字段隔离验证：**
- Supplier 角色 API 响应抽样检查：是否包含 price/margin/profit 字段
- System Admin 角色 API 响应抽样检查：是否包含单租户业务数据
- 自动化测试报告：上次运行时间 · 通过率 · 失败项

**跨租户数据泄露检测：**
- 定期扫描：是否有 API 端点返回了非当前租户的数据
- 异常访问日志：某用户尝试访问非授权数据的记录

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 查看 RLS 覆盖率 | Layer 1 基础层 |
| 处理隔离告警 | Layer 1 基础层 |
| 查看审计报告 | Layer 6 观测层 |

### Mobile 优先级：📋 中等

仅接收 🔴 严重告警推送。所有配置操作必须在 Web 端完成——高风险操作需要大屏确认。

---

## Section 2 — Tenant Admin：人机协作边界的定义者

### 角色本质

Tenant Admin 是**Agent 的立法者**——决定系统的「自主程度」。Agent 授权中心是人机协作边界的 UI 体现：授权越精准，Agent 自动化比例越高，人力成本越低。

### 铁律

> **Agent 授权中心决定系统的「自主程度」** → Layer 2 执行层边界

这是人机协作边界的 UI 体现。新 Agent 能力默认关闭，必须在授权中心显式配置授权级别。

### 路由结构

| 页面 | 路由 | 主 Harness 层 | Sidebar Badge |
|------|------|--------------|--------------|
| 经营全景看板 (Overview) | `/dashboard` | Layer 6 观测层 | — |
| Agent 授权中心 (Agent Authority) | `/settings/agent-authority` | Layer 2 执行层 | — |
| 成本档案管理 (Cost Profiles) | `/products/costs` | Layer 3 工具层 | `N stale` (STALE+MISSING 数) |
| 平台与渠道对接 (Integrations) | `/settings/integrations` | Layer 1 基础层 | — |
| 团队权限管理 (Team & Permissions) | `/settings/team` | Layer 1 基础层 | — |

### 五大工作台

#### 2.1 经营全景看板 (`/dashboard`)

**设计原则：** 一屏看懂整个公司的跨境经营状况（True profit across all channels）。

**核心数字行（置顶，4 个 StatBadge）：**

| 指标 | 示例值 | 说明 |
|------|--------|------|
| TRUE PROFIT | $18,420 | 本月真实利润（扣除所有成本后） |
| MARGIN | 22.4% | 利润率 |
| GMV | $82,200 | 总销售额 |
| VS LAST MONTH | +$2,140 (+13%) | 环比变化 |

底部元信息行：`Updated 2h ago · 4 platforms · confidence 87%`

**产品健康矩阵（散点图）：**
- X 轴：利润率，Y 轴：销售趋势
- 点击任意数据点 → 直接进入产品工作台
- 四象限标签及产品计数：

| 象限 | 标签 | 含义 | 示例 |
|------|------|------|------|
| ⭐ Star | maintain | 高利润 + 高增长 | 8 products |
| 🚀 Rising | scale | 低利润 + 高增长 | 5 products |
| ⚠️ Drain | intervene | 低利润 + 低增长 | 3 products |
| 💡 Potential | nurture | 高利润 + 低增长 | 6 products |

**需要你关注（Needs Your Attention，三级卡片）：**

| 级别 | 示例 | 置信度 | 操作 |
|------|------|--------|------|
| 🔴 CRITICAL | BT Headphones X1 — Profit margin turned negative (−4.2%) | 91% | View RCA |
| 🟡 WARNING | DE Market · All SKUs — Q4 restock window closes in 12 days | 78% | View Plan |
| 🟢 INFO | Shopify Channel — ROAS 7-day avg beats Amazon by 34%, consider budget shift | 72% | Review |

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| Tap profit number → 利润详情 | Layer 3 工具层 |
| Tap attention card → 处理待关注 | Layer 6 观测层 |
| AI summary → 查看效能 | Layer 4 记忆层 |

**与 Viewer 经营大屏的关系：** 共享数据查询和图表组件，但 Tenant Admin 版本包含"Needs Your Attention"区域（可操作）和 AI 今日摘要，Viewer 版本纯展示零按钮。实现上同一组件通过 `role` prop 切换渲染模式。

#### 2.2 Agent 授权中心 (`/settings/agent-authority`)

**设计原则：** Define what agents can do autonomously vs. require approval.

**执行规则表（Execution Rules）：**

| Action | Range | Level | Config |
|--------|-------|-------|--------|
| Price adjustment | < 5% | 🟢 AUTO | Edit |
| Price adjustment | 5 – 15% | 🟡 CONFIRM | Edit |
| Price adjustment | > 15% | 🔴 BLOCK | locked |
| Ad budget change | < 20% | 🟢 AUTO | Edit |
| Ad budget change | 20 – 50% | 🟡 CONFIRM | Edit |
| Restock execution | Any | 🔴 BLOCK | locked |
| Supplier communication | Any | 📝 DRAFT | locked |
| New market expansion | Any | 🟡 CONFIRM | locked |
| Product delisting | Any | 🔐 2FA REQUIRED | locked |

**五级授权体系（设计稿细化）：**

| 级别 | 含义 | UI 标签 |
|------|------|---------|
| 🟢 AUTO | Agent 直接执行，不需人工确认 | 绿色标签 |
| 🟡 CONFIRM | Agent 建议，Operator 确认后执行 | 黄色标签 |
| 📝 DRAFT | Agent 草拟内容，人工审核后发送 | 蓝色标签 |
| 🔴 BLOCK | 必须人工发起，Agent 不得自动触发 | 红色标签 |
| 🔐 2FA REQUIRED | 需要二次身份验证才能执行 | 紫色标签 |

每条规则可设置：适用产品范围 / 适用市场范围。`locked` 表示该规则不可由 Tenant Admin 降级（系统强制）。

**执行日志（Execution Log）：**

示例格式：
```
Today 09:14 · PricingAgent · AUTO
  Price −3.2% · BT Headphones X1 · Amazon US
  ↳ ROAS +11% after 24h

Today 08:30 · AdAgent · CONFIRM
  Pause 3 keywords · total saving $420/mo
  ↳ Approved by @wang

Yesterday · ProfitAgent · CONFIRM
  Profit alert: margin below 10%
  ↳ Rejected — seasonal dip expected
```

每条日志包含：时间 · Agent 名称 · 授权级别 · 操作摘要 · 结果/后续反馈。

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 调整自动执行阈值 | Layer 2 执行层 |
| 查看执行历史 | Layer 4 记忆层 |

**神经接口体现：** 授权中心从三级扩展为五级（AUTO / CONFIRM / DRAFT / BLOCK / 2FA REQUIRED），更精确地定义人机协作边界。DRAFT 级别适用于供应商沟通等需要人类审核内容质量的场景，2FA REQUIRED 适用于产品下架等不可逆操作。

#### 2.3 成本档案管理 (`/products/costs`)

**设计原则：** Profitability engine fuel — stale data = wrong decisions.

**数据新鲜度状态表（Data Freshness Status）：**

| Product | COGS/unit | Last Updated | Status |
|---------|-----------|-------------|--------|
| BT Headphones X1 | $8.50 | 2 days ago | 🟢 OK |
| LED Desk Lamp Pro | $12.20 | 34 days ago | 🟡 STALE |
| Yoga Mat Ultra | — | Never | 🔴 MISSING |
| Cable Organiser Set | $3.10 | 8 days ago | 🟢 OK |

状态规则：OK（< 30 天）· STALE（> 30 天，标红）· MISSING（从未录入，标红+警告）

**成本录入表单（Cost Entry，per product）：**

| 字段 | 必填 | 说明 | 单位 |
|------|------|------|------|
| COGS per unit | ✅ required | Factory price + QC | $ |
| Inbound shipping | ✅ required | Freight ÷ order value | % of COGS |
| FBA / warehouse fee | ✅ required | Per-unit fulfilment | $/unit |
| Platform fee | ✅ required | Commission rate | % |
| Return rate | ✅ required | Historical average | % |
| Target margin | optional | Used for autopilot pricing | % |

**成本健康检查：**
- 当前成本 → 各平台/市场的保本价是多少
- 敏感性分析：「如果 COGS 涨 10%，哪些产品会转亏？」
- 批量更新：Excel 模板导入（Bulk import）

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| Save cost profile | Layer 3 工具层（AUTO） |
| Bulk import | Layer 3 工具层 |

#### 2.4 平台与渠道对接 (`/settings/integrations`)

**设计原则：** Agent 的数据生命线——没有平台连接，整个系统就是空壳。

**这是 Tenant Admin 入驻后的第一个操作页面。** 新租户 onboarding 流程应引导到此页面完成至少一个平台连接。

**平台连接（Marketplaces）：**

| 平台 | API 类型 | 数据范围 |
|------|---------|---------|
| Amazon (Seller Central / Vendor Central) | SP-API | 订单 · Listing · 广告 · FBA 库存 · 退货 · 财务 |
| Walmart | Marketplace API | 订单 · Listing · 广告 · WFS 库存 |
| Shopify | Admin API + Storefront API | 订单 · 产品 · 库存 · 折扣 · 客户 |
| TikTok Shop | Open API | 订单 · 产品 · 广告 · 达人合作 |
| Wayfair | Partner Home API | 订单 · 库存 · 退货 · CastleGate 物流 |

每个平台连接卡片显示：
- 连接状态指示灯（🟢 Connected / 🟡 Token Expiring / 🔴 Disconnected / Error）
- 上次同步时间 + 同步频率
- 数据覆盖范围（哪些模块已开启同步）
- 「Test Connection」按钮

**3PL 物流伙伴对接：**

| 3PL 服务商 | API 类型 | 数据范围 |
|-----------|---------|---------|
| ShipBob | REST API | 入库 · 出库 · 库存快照 · 运费账单 |
| Deliverr / Flexport | REST API | 入库 · 库存分布 · 配送时效 · 费用 |
| 自有仓 / 海外仓 | WMS API 或手动导入 | 入库 · 出库 · 库存盘点 · 仓储费 |

每个 3PL 连接卡片显示：
- 连接状态 + 上次同步时间
- 当前库存总量 · 在途数量
- 本月仓储费 / 配送费汇总
- 异常提醒：库存差异 > 阈值 · 入库延迟

**WMS 仓库管理对接：**

| 仓库类型 | 对接方式 | 关键数据 |
|---------|---------|---------|
| Amazon FBA (FBA Inbound) | SP-API 自动 | FBA 库存 · 入库计划 · 长期仓储费 · 移除订单 |
| Walmart WFS | Marketplace API | WFS 库存 · 入库状态 |
| 海外仓 (自营/第三方) | WMS API / SFTP | 库存快照 · 入出库记录 · 仓储费 |
| 中转仓 | 手动录入 / Excel 导入 | 在途库存 · 预计到仓时间 |

仓库全局视图：
- 库存分布地图（哪个仓有多少货）
- 库龄分析（超 90 天 / 超 180 天 / 超 365 天库存占比）
- 补货建议触发条件配置（安全库存天数 × 日均销量）

**ERP 系统对接：**

| ERP 系统 | API 类型 | 同步方向 | 数据范围 |
|---------|---------|---------|---------|
| NetSuite | SuiteTalk / REST | 双向 | 采购单 · 应付账款 · 库存成本 · 总账 |
| SAP Business One | Service Layer | 双向 | 采购单 · 库存 · 财务凭证 |
| QuickBooks Online | REST API | 单向推送 | 销售收入 · 费用 · 利润报表 |
| 金蝶 / 用友 | Open API | 双向 | 采购 · 库存 · 财务 |

ERP 对接关键设计：
- 字段映射配置（系统 SKU ↔ ERP 物料编码 · 系统供应商 ↔ ERP 供应商）
- 同步冲突处理规则（ERP 优先 / 系统优先 / 手动解决）
- 同步日志：每次同步的成功/失败/跳过记录，可按时间范围查询

**全局关键交互：**
- 添加新连接 → 引导式 OAuth 授权流程（Marketplace / 3PL）或 API Key 配置（WMS / ERP）
- Token 即将过期 → 系统主动推送到 Tenant Admin 待办 + 邮件提醒
- 连接中断 → 影响范围分析（"此连接断开将影响 X 个产品的库存/成本数据更新"）
- 同步异常 → 自动重试 3 次后升级为告警，显示失败原因和建议操作

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 连接新平台 / 3PL / WMS / ERP | Layer 1 基础层 |
| 查看同步状态与健康度 | Layer 6 观测层 |
| Token 过期 / 连接中断处理 | Layer 1 基础层 |
| 字段映射与冲突规则配置 | Layer 3 工具层 |
| 库存分布与库龄分析 | Layer 6 观测层 |

**神经接口体现：** 集成对接不是一次性配置——系统持续监控所有连接的健康度，主动预警 Token 过期、API 限流和同步异常，并量化断连的业务影响。Agent 的数据质量直接取决于这些连接的稳定性，所以系统会在经营全景看板的"需要你关注"区域推送连接异常（如"Amazon SP-API Token 将在 3 天后过期，影响 247 个产品的数据更新"）。

#### 2.5 团队权限管理 (`/settings/team`)

**设计原则：** 精确控制每个成员能看到什么、能做什么。

**成员管理：**
- 成员列表：姓名 · 角色 · 负责产品/市场 · 最后登录
- 邀请新成员：发送链接 · 设置角色 · 限定数据范围

**角色配置：**
- 预设角色：运营专员 / 广告优化师 / 仓储专员 / 财务只读
- 自定义角色：按功能模块勾选权限
- 数据范围：只能看分配的产品 + 市场

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 添加运营人员 | Layer 1 基础层 |
| 操作审计 | Layer 1 基础层 |

### Mobile 优先级：⚡ 高

核心场景：
- 查看经营全景（核心数字行 + 需要你关注）
- 处理 Agent 授权变更请求（三级开关式交互）
- 审批团队成员邀请

---

## Section 3 — Operator：进化层最珍贵的数据源

### 角色本质

Operator 是**Agent 的教练**——日常与 Agent 协作，每一次执行/修改/拒绝都是在训练 Agent。Operator 的判断力是整个系统最珍贵的资源，UI 的设计目标是**最大化捕获这些判断力**。

### 铁律

> **拒绝 Agent 建议时必须强制选原因** → Layer 7 进化层燃料

这不是"建议选原因"，是"不选就无法完成拒绝操作"。拒绝原因是进化层最珍贵的训练数据——它告诉系统"在什么场景下，人类认为 Agent 的判断是错的，以及错在哪里"。

### Operator 的两种操作模式

1. **响应模式（主要，80%+）**：回应 Agent 推送的待办——执行/修改/拒绝/延后。首页即待办中心。
2. **主动模式（辅助）**：Operator 主动发起操作（产品工作台允许直接操作）。主动操作同样经过 Constitution 检查，写入 experience 表标记 `source: manual`。

进化层同时从两种模式中学习。

### 路由结构

| 页面 | 路由 | 主 Harness 层 | Sidebar Badge |
|------|------|--------------|--------------|
| 智能待办中心 (Inbox) | `/inbox` | Layer 5 协作层 | `N`（待处理数） |
| 产品工作台 (Products) | `/products/{id}` | Layer 3-6 多层 | — |
| 多平台运营矩阵 (Platform Matrix) | `/platforms` | Layer 3 工具层 | — |
| 广告中心 (Ads) | `/ads` | Layer 2 执行层 | — |

### 四大工作台

#### 3.1 智能待办中心 (`/inbox`)

**设计原则：** Agent-pushed decisions. You process, not search.

**待办列表（Today — N items），三级卡片：**

示例卡片结构：
```
🔴 CRITICAL · ProfitAgent · 2h ago
BT Headphones X1
Profit margin −4.2% — 3 contributing factors identified
[91%]  [View RCA] [Adjust Costs] [Dismiss]

🟡 WARNING · InventoryAgent · 6h ago
DE Market · Q4 Prep
Restock window: 12 days remaining. Suggested qty: 800 units via DHL.
[78%]  [Draft PO] [Modify] [Reject]
⚠ Reject requires reason selection — feeds Layer 7 evolution

🟢 INFO · AdAgent · 1h ago
LED Desk Lamp Pro
Pause 3 low-ROAS keywords. Est. saving: $420/mo with <2% revenue impact.
[85%]  [Execute] [Modify] [Reject]
⚠ Reject requires reason selection — feeds Layer 7 evolution
```

**每张卡片必须包含：**
- Agent 名称 + 时间戳（ProfitAgent · 2h ago）
- 级别标签（CRITICAL / WARNING / INFO）
- 产品/市场上下文
- 建议摘要（1-2 句，含具体数字）
- 置信度百分比
- 上下文相关的操作按钮（不同类型卡片按钮不同）
- Reject 按钮旁的警告提示：`⚠ Reject requires reason selection — feeds Layer 7 evolution`

**拒绝时强制选择原因（铁律交互）：**

```
拒绝原因（必选）：
○ 数据不准确 — Agent 依据的数据有误或过时
○ 市场情况特殊 — 我对市场趋势的判断与 Agent 不同
○ 公司策略限制 — 建议与当前公司战略冲突
○ 其他 — [自由文本]

补充说明（可选）：
[                                          ]

⚡ 这些拒绝原因是 Layer 7 最珍贵的训练数据
```

**关键设计决策：**
- 拒绝原因是**枚举 + 自由文本**，枚举保证数据可聚合分析，自由文本捕获细节
- 修改参数时，系统自动记录「原始建议值 vs 人类修正值」，这个 delta 是进化层的隐式训练信号
- 「追问 Agent」触发 Layer 5 协作层对话，追问结果也写入 experience 表
- **14-day outcome push**：执行操作 14 天后，系统自动推送结果反馈（如"ROAS +11% after 24h"），形成闭环

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| One-tap execute（一键执行） | Layer 2 执行层（AUTO） |
| Reject (REQUIRED: reason) | Layer 7 进化层 |
| Ask agent（追问） | Layer 5 协作层 |
| Mark as 'Worth Learning' | Layer 7 进化层 |
| 14-day outcome push | Layer 4 记忆层（AUTO） |

**Mobile 交互：** 左滑 = 执行，右滑 = 拒绝（弹出原因选择底部弹窗）。这是 Mobile 端最高频的操作。

#### 3.2 产品工作台 (`/products/{id}`)

**设计原则：** All operations for one product, one screen.

**Product Header（sticky，始终可见）：**

示例：
```
BT Headphones X1    [GROWTH]    Health 74    3 inbox items

PROFIT/MO    MARGIN     ROAS      STOCK DAYS
$4,820       19.2%      3.4×      22d
```

| 指标 | 示例值 | 说明 |
|------|--------|------|
| 产品名 | BT Headphones X1 | — |
| 生命周期阶段 | GROWTH | 动态标签（LAUNCH/GROWTH/MATURE/DECLINE） |
| Health 评分 | 74 | 0-100 综合健康度 |
| Inbox items | 3 | 该产品待处理的 Agent 建议数 |
| PROFIT/MO | $4,820 | 本月利润 |
| MARGIN | 19.2% | 利润率 |
| ROAS | 3.4× | 综合广告回报率 |
| STOCK DAYS | 22d | 库存剩余天数 |

**六个 Tab：**

| Tab | 名称 | 核心内容 | Agent 交互 |
|-----|------|---------|-----------|
| 1 | **Profit** | Cross-platform true profit · cost waterfall chart · platform-by-platform margin comparison · confidence label on profit figure (based on cost data completeness) | 'Why did profit change?' → triggers RCA Agent |
| 2 | **Channels** | Tab per platform: Amazon US · Amazon DE · Shopify · TikTok Shop. Per platform: listing status · monthly data · ad overview · stock. Platform-specific actions in isolated panels | 平台专属操作区 |
| 3 | **Ads** | Cross-platform ad spend · composite ROAS · attribution breakdown · A/B test tracker: which creative/copy performing better | Ad Agent recommendation card (with confidence) |
| 4 | **Supply Chain** | Stock level per warehouse · daily velocity · stockout date forecast · restock suggestion: qty · timing · confidence · supplier options | AI-drafted PO email → human edits → human clicks Send (**never auto**) |
| 5 | **Social** | Content calendar · per-platform publish schedule · KOL tracker: spend → attributed revenue → renew Y/N | AI copy/hashtag suggestions → human edits before publishing |
| 6 | **After-Sales** | Review cluster analysis: issue type · frequency · trend · return reason auto-classification → supplier feedback task | V2 roadmap: pain points from reviews + competitor gaps |

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| Trigger RCA（触发根因分析） | Layer 6 观测层 |
| Execute ad recommendation | Layer 2 执行层 |
| Draft PO email | Layer 5 协作层 |
| Add operator note | Layer 4 记忆层 |

#### 3.3 多平台运营矩阵 (`/platforms`)

**设计原则：** 同一产品在所有平台的横向对比，发现跨平台机会。

**平台矩阵表：**
- 行：产品，列：各平台（亚马逊 US/EU/JP · Shopify · TikTok）
- 指标切换：售价 · 利润率 · 广告花费 · ROAS · 库存天数 · 评分
- 颜色编码：🟢 优于均值 · 🔴 低于均值 · ⚪ 数据不足

**跨平台洞察（Agent 生成）：**
- 「亚马逊 DE 利润比 US 低 15%，主要原因：运费 + 退货率」
- 「Shopify ROAS 连续 7 天高于亚马逊，建议预算迁移」
- 一键发起跨平台归因分析

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 跨平台价格对齐 | Layer 3 工具层 |
| 库存分配优化 | Layer 4 记忆层 |

#### 3.4 广告中心 (`/ads`)

**设计原则：** 跨产品的广告全局视图——产品工作台的 Ads Tab 是单产品视角，这里是全局视角。

**全局广告仪表盘：**
- 总广告花费 · 综合 ROAS · 各平台贡献占比
- 按平台拆分：Amazon PPC / Shopify Ads / TikTok Ads / Walmart Ads
- 预算消耗进度 vs 计划

**Agent 广告建议队列：**
- 跨产品的广告优化建议（与 Inbox 中的 AdAgent 卡片联动）
- 批量操作：一次性执行多条低风险建议

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 查看广告全局数据 | Layer 6 观测层 |
| 批量执行广告建议 | Layer 2 执行层 |

### Mobile 优先级：🏆 最高

Operator 是 Mobile 端最重要的角色。核心场景：
- 随时处理 Agent 紧急待办（左滑执行 / 右滑拒绝）
- 快速查看产品状态（简化版产品卡片，非六 Tab）
- 审批队列（卡片式，滑动操作）
- 追问 Agent（语音输入 → 文字转换）

---

## Section 4 — Supplier：严格隔离的供应商门户

### 角色本质

Supplier 是**供应链的末端节点**——只需要知道"生产什么、多少、什么时候交"。绝对不需要知道卖多少钱、赚多少利润。

### 铁律

> **UI 层强制隔离，供应商绝对看不到售价/利润/平台信息** → Layer 1 基础层

不能只靠后端，前端也要强制：
- **后端**：Supplier 角色的 token 调用任何 API 端点，响应自动过滤 price/margin/profit/sales/acos/roas 等字段
- **前端**：Supplier 视图组件中不存在这些字段的渲染代码（不是隐藏，是代码中不存在）

### 路由结构

| 页面 | 路由 | 主 Harness 层 |
|------|------|--------------|
| 供应商门户 | `/supplier/{token}` | Layer 1 基础层 |

**访问方式：** 无需注册账号，通过专属链接（含 token）访问。每个供应商一个唯一 token。

### 供应商门户（单页面，多区域）

#### 4.1 待报价需求

**设计原则：** 供应商看到的是清晰的采购需求，可以在线报价。

**需求卡片内容：**
- 产品规格 · 采购数量 · 期望交期 · 截止报价时间
- 质量要求 · 包装规格 · 认证要求（CE / FCC / FDA）

**在线报价表单：**
- 单价 · 最小起订量 · 交货期 · 备注

#### 4.2 进行中订单

**设计原则：** 供应商主动更新生产进度，运营人员实时可见。

**订单卡片内容：**
- 已确认订单详情 · 生产进度更新（供应商填写）
- 预计发货日 · 上传质检报告
- 直接消息：与运营人员沟通

#### 4.3 严格数据隔离（UI 层强制）

| ✅ 能看到 | ❌ 绝对看不到 |
|----------|-------------|
| 产品规格 | 销售价格 |
| 采购数量 | 销售量 |
| 交期要求 | 利润 / 利润率 |
| 质量反馈 | 平台信息（Amazon/Shopify 等） |
| 自己的报价历史 | 竞品信息 |
| | 其他供应商信息 |
| | 卖家公司财务数据 |

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 提交报价 | Layer 3 工具层 |
| 更新生产进度 | Layer 4 记忆层 |
| 上传质检报告 | Layer 3 工具层 |

### Mobile 优先级：⚡ 高

工厂人员用手机确认订单、更新生产进度。界面极简，大按钮，适合车间环境操作。
- 报价表单：大输入框 + 大提交按钮
- 进度更新：拖拽滑块或大按钮切换状态
- 质检上传：直接调用手机相机拍照上传

---

## Section 5 — Viewer：零操作的价值展示窗

### 角色本质

Viewer 是**系统价值的见证者**——老板/投资人用 30 秒看懂全局，重点看 Agent 创造了多少价值。

### 铁律

> **零操作按钮——所有数字背后有 AI 效能数据，帮助投资人理解系统价值** → Layer 6 观测层

零操作意味着：
- 前端无任何 POST/PUT/DELETE 调用，纯 GET
- 无编辑、删除、确认、拒绝按钮
- 无表单、无输入框
- 唯一允许的"操作"：导出报告（PDF / Excel）

### 路由结构

| 页面 | 路由 | 主 Harness 层 |
|------|------|--------------|
| 高管看板 | `/reports` | Layer 6 观测层 |

### 高管看板（单页面，多区域）

#### 5.1 核心 KPI（首屏）

**设计原则：** 30 秒内获取公司经营全貌。

- 本月真实利润 · 利润率 · GMV · vs 目标完成率
- MoM（月环比）· YoY（年同比）对比 · 趋势箭头
- 数据截至时间（让 Viewer 知道数字是实时的）

#### 5.2 经营健康矩阵

- 各品类利润贡献饼图
- 各市场表现对比（收入 · 利润率 · 增长率）
- 产品健康分布：明星 / 成长 / 问题 / 退出 各几个

#### 5.3 AI 系统效能（投资人视角）

**这是 Viewer 页面的核心差异化——不只是经营数字，而是展示 AI 系统的价值。**

- Agent 建议执行率 · 平均置信度
- 系统自动处理了多少操作（折算人工时节省）
- 「与使用前相比，运营效率提升 X%」

#### 5.4 可导出报告

- 月度经营报告 PDF
- 财务汇总 Excel（可对接财务软件）
- AI 效能报告（给投资人展示系统价值）

**交互场景 → Harness 层映射：**

| 交互 | Harness 层 |
|------|-----------|
| 查看月度报告 | Layer 6 观测层 |
| 下钻某品类 | Layer 6 观测层 |

**与 Tenant Admin 经营全景看板的关系：** Viewer 的高管看板与 Tenant Admin 的 `/dashboard` 共享数据查询和图表组件，但 Viewer 版本：
- 无"需要你关注"区域（那是可操作的）
- 无 AI 今日摘要中的"待确认决策"链接
- 新增"AI 系统效能"区域（投资人视角）
- 新增"可导出报告"区域
- 实现上同一组件通过 `role` prop 切换渲染模式

### Mobile 优先级：⚡ 高

老板手机看数据。大字体、大数字、大趋势。30 秒看懂。
- 核心 KPI 卡片式布局，一屏一个大数字
- 左右滑动切换品类/市场
- 下拉刷新获取最新数据

---

## Section 5.5 — Frontend Design Tokens

> **来源：** 高保真 UI 设计稿（CrossBorder OS Frontend Dev Spec v1.0）

### 核心色板（Dark Mode 基准）

| Token | 值 | 用途 |
|-------|------|------|
| `bg-primary` | `#111113` | 页面背景 |
| `bg-card` | `#1E1E22` | 卡片/面板背景 |
| `border` | `#2A2A2E` | 边框/分割线 |
| `text-primary` | `#F0F0F2` | 主文字 |
| `text-secondary` | `#9898A0` | 辅助文字 |
| `accent-blue` | `#4F8EF7` | 主强调色（链接/选中态） |
| `success` | `#34D399` | 成功/健康/正增长 |
| `warning` | `#FBBF24` | 警告/需关注 |
| `danger` | `#EF4444` | 危险/严重/负增长 |

### 与现有 CSS 变量的映射关系

设计稿的 Design Tokens 需与 `globals.css` 中已有的 CSS 变量体系对齐：

| 设计稿 Token | 对应 CSS 变量 | 说明 |
|-------------|-------------|------|
| `bg-primary` | `--bg-primary` | 已存在，需确认值一致 |
| `bg-card` | `--panel-bg` | 已存在 |
| `border` | `--panel-border` | 已存在 |
| `text-primary` | `--text-primary` | 已存在 |
| `text-secondary` | `--text-secondary` | 已存在 |
| `accent-blue` | `--accent` | 已存在 |
| `success` | `--success` | 已存在 |
| `warning` | `--warning` | 已存在 |
| `danger` | `--danger` | 已存在 |

### 设计稿中的具体数据示例（用于开发参考）

**Platform Operations 健康指标行：**

| 指标 | 示例值 | 趋势 |
|------|--------|------|
| Active Tenants | 247 | +12 this week |
| Agent Executions/day | 14,302 | +8% MoM |
| Avg Confidence | 0.81 | ↑ from 0.74 |
| Error Rate | 0.3% | < 1% target |
| Layer B Patterns | 1,847 | +23 this week |
| API P95 Latency | 142ms | < 200ms SLA |

**Knowledge Layer Console — Layer A 公共知识表格结构：**

| Domain | Platform | Market | Confidence | Valid Until |
|--------|----------|--------|------------|-------------|
| Platform Rules | Amazon | US | — | Ongoing |
| Market Reg | All | DE | — | 2025-12-31 |
| Seasonal Trend | All | All | 0.92 | Q4 2025 |
| Logistics SLA | FBA | US | 0.88 | Ongoing |

**Knowledge Layer Console — Layer B 蒸馏队列卡片结构：**

| 模式描述 | 置信度 | 样本量 | 操作 |
|---------|--------|--------|------|
| 3C · Amazon US · Growth Stage: increase ad budget 15% when rank drops >5 positions | 79% | 67 cases | Approve |
| Home · EU · Q4: pre-position inventory 45 days ahead yields +23% GMV | 84% | 112 cases | Approve |
| Fashion · TikTok · Launch: 3 short videos/week outperforms 1 long video | 61% | 28 cases | Review |

**Evolution Tracker 品类覆盖度示例：**

| 品类 · 市场 | 案例数 | 状态 | 置信度覆盖 |
|------------|--------|------|-----------|
| 3C Electronics · Amazon US | 847 | healthy | 78% |
| Home & Garden · EU Markets | 412 | growing | 61% |
| Fashion · TikTok Shop | 183 | early | 34% |
| Sports · Shopify | 94 | insufficient | 19% |

---

## Section 6 — Harness 层映射表

### 设计原则

每个 UI 元素都必须能回答：「它对应哪个 Harness 层？为什么这样设计？」

如果一个 UI 元素无法映射到任何 Harness 层，它就不应该存在。

### 完整映射表

#### Layer 7 进化层 — UI 元素

| UI 元素 | 角色 | 为什么属于进化层 |
|---------|------|----------------|
| 拒绝原因选择器 | Operator | 人类反馈是蒸馏模式的核心输入 |
| 修改参数对比（原始 vs 修正） | Operator | 隐式训练信号，学习人类偏好偏差 |
| Evolution Dashboard 学习曲线 | System Admin / Viewer | 展示系统进化速度 |
| Agent 决策准确率 | Viewer | 基于 Operator 反馈计算，证明进化有效 |
| 蒸馏模式列表 | System Admin | 查看系统自动提取的决策模式 |

#### Layer 6 观测层 — UI 元素

| UI 元素 | 角色 | 为什么属于观测层 |
|---------|------|----------------|
| 置信度标签 | Operator | 让人类知道 Agent 有多确定 |
| 依据样本量 | Operator | 让人类判断数据是否充分 |
| OODA 推理链展开 | Operator | 完整的推理过程透明化 |
| AI 效能报告 | Viewer / Tenant Admin | Agent 价值的量化观测 |
| Harness 7 层健康度 | System Admin | 系统整体可观测性 |
| 经营大屏所有图表 | Viewer | 业务指标的观测窗口 |
| 利润报表归因分析 | Operator | 利润变动因素的可观测分解 |

#### Layer 5 协作层 — UI 元素

| UI 元素 | 角色 | 为什么属于协作层 |
|---------|------|----------------|
| 待办推送通知 | Operator | Agent → 人类的协作请求 |
| SSE 实时更新 | 所有角色 | Agent 执行状态的实时同步 |
| 「Agent 正在做什么」区域 | Operator | 人机协作的实时状态 |
| 审批队列 | Operator / Tenant Admin | 人类 → Agent 的协作响应 |
| 采购订单确认 | Supplier | 供应链节点间的协作 |

#### Layer 4 记忆层 — UI 元素

| UI 元素 | 角色 | 为什么属于记忆层 |
|---------|------|----------------|
| 产品驾驶舱历史对比 | Operator | 调取历史决策对比当前 |
| 规则版本历史 | Tenant Admin | Constitution 的记忆 |
| 公共知识库 | System Admin | Layer A 公共记忆 |
| 趋势分析异常标注 | Viewer | 历史异常的记忆 |

#### Layer 3 工具层 — UI 元素

| UI 元素 | 角色 | 为什么属于工具层 |
|---------|------|----------------|
| Agent 执行记录（已完成操作） | Operator | 工具调用的结果展示 |
| 多平台运营矩阵 | Operator | 跨平台工具调用对比 |
| 工具成功率指标 | System Admin | 工具层健康度 |

#### Layer 2 执行层 — UI 元素

| UI 元素 | 角色 | 为什么属于执行层 |
|---------|------|----------------|
| Agent 授权中心开关 | Tenant Admin | 定义 Agent 执行边界 |
| 执行阈值配置 | Tenant Admin | 自动/人工的分界线 |
| 安全限额配置 | Tenant Admin | 执行的安全上限 |
| Kill Switch | System Admin | 执行的紧急制动 |
| Agent 监控仪表盘 | System Admin | 全局 Agent 执行健康度 |
| Circuit Breaker 状态 | System Admin | Agent 执行的熔断保护 |
| 待办状态流转（执行/修改/拒绝） | Operator | 执行层的状态机 |

#### Layer 1 基础层 — UI 元素

| UI 元素 | 角色 | 为什么属于基础层 |
|---------|------|----------------|
| 租户管理 | System Admin | 多租户隔离 |
| 隔离审计（RLS 覆盖率 + 字段验证） | System Admin | 数据隔离的持续验证 |
| 团队管理 + 角色分配 | Tenant Admin | 身份与权限 |
| 平台与渠道对接 | Tenant Admin | 数据源的基础连接 |
| Supplier 字段过滤（售价/利润不可见） | Supplier | 数据隔离 |
| System Admin 数据脱敏 | System Admin | 租户数据隔离 |
| 登录/认证 | 所有角色 | 身份验证 |

### 交叉验证矩阵

```
                    SysAdmin  TenantAdmin  Operator  Supplier  Viewer
Layer 7 进化层        ●          ○           ●                   ○
Layer 6 观测层        ●          ●           ●                   ●
Layer 5 协作层                   ●           ●         ●
Layer 4 记忆层        ●          ○           ●                   ○
Layer 3 工具层        ○          ●           ●
Layer 2 执行层        ●          ●           ●
Layer 1 基础层        ●          ●                     ●

● = 核心交互（该角色通过 UI 深度操作该层）
○ = 只读观测（该角色可以看到该层的数据，但不操作）
```

---

## Section 7 — 终极验收标准

### 两列对比表：做好了 vs 没做好

| 维度 | ✅ 系统做好了 | ❌ 没做好 |
|------|-------------|----------|
| **Operator 智能待办** | `/inbox` 三级分组（🔴紧急/🟡重要/🟢优化），每张卡片含摘要+置信度+数据新鲜度+风险+推理链，支持执行/修改/拒绝/延后/追问/标记学习 | 打开首页看到 50 个图表，不知道先看哪个，需要自己判断哪个指标异常 |
| **拒绝反馈** | 拒绝时强制选原因（数据不准确/市场情况特殊/公司策略限制/其他）+ 自由文本，不选不能完成拒绝 | 拒绝就是一个确认按钮，点完就没了，系统不知道为什么被拒绝 |
| **Agent 透明度** | 每条建议可展开完整推理链+数据依据，显示已知风险和不确定因素 | 只显示"建议暂停广告组"，不解释为什么 |
| **置信度** | "置信度 82%，基于 47 个案例，数据新鲜度 2 天前"，低置信度有 ⚠️ 标记 | 所有建议看起来一样重要，无法区分 Agent 有多确定 |
| **产品工作台** | `/products/{id}` 六 Tab（利润全景+各平台运营+广告管理+供应链+社媒内容+售后升级），一键触发 RCA Agent，AI 草拟采购邮件 | 产品页只有基础信息卡片，需要在多个页面间跳转拼凑全貌 |
| **跨平台矩阵** | `/platforms` 行=产品列=平台，指标切换+颜色编码，Agent 生成跨平台洞察 | 每个平台独立看板，无法横向对比同一产品在不同平台的表现 |
| **Tenant Admin 授权** | 五级授权（AUTO/CONFIRM/DRAFT/BLOCK/2FA REQUIRED），执行规则表含 Action+Range+Level+Config，执行日志含 Agent 名称+结果反馈 | Agent 能力默认全开，或者没有授权中心，Agent 想做什么就做什么 |
| **成本数据** | Data Freshness Status 表（OK/STALE/MISSING），6 字段录入（COGS+Inbound+FBA+Platform fee+Return rate+Target margin），sidebar badge 显示 stale 数 | 利润 = 售价 - 采购价，忽略佣金/物流/仓储/退货/汇率/税务 |
| **经营全景** | 产品健康矩阵（四象限），AI 今日摘要，三级"需要你关注"推送 | 50 个图表，无优先级，不知道先看哪个 |
| **System Admin 隔离** | 看到"Tenant #47 Agent 连续失败 5 次"，看不到该租户卖什么产品 | 看到"XX公司的 Wireless Earbuds 利润下降 20%" |
| **Supplier 门户** | `/supplier/{token}` 无需注册，看到产品规格+数量+交期+认证要求，可在线报价+更新进度+上传质检，绝对看不到售价/利润/平台/竞品/其他供应商 | 需要注册账号，或看到"PO-2026-0847，Wireless Earbuds，售价 $39.99，利润率 28%" |
| **Viewer 高管看板** | `/reports` 首屏核心 KPI（利润+利润率+GMV+目标完成率+MoM/YoY），零操作按钮，可导出 PDF/Excel | 经营大屏有"编辑""删除""确认"按钮，或者数据太多看不懂 |
| **AI 效能展示** | AI 系统效能区域：Agent 执行率+置信度+人工时节省+「运营效率提升 X%」，可导出 AI 效能报告给投资人 | 没有 AI 效能数据，老板不知道 Agent 有什么用 |
| **Mobile Operator** | 手机上左滑执行、右滑拒绝，3 秒处理一条待办 | 手机上打开桌面版页面，字太小，按钮点不到 |
| **Mobile Supplier** | 手机上大按钮确认订单、更新进度，车间环境可操作 | 需要打开电脑才能确认订单 |
| **进化层数据** | experience 表日增 100+ 条记录，含拒绝原因分布分析 | experience 表为空，或只有执行记录没有拒绝原因 |
| **飞轮转速** | 自动执行比例从 30% → 70%，Operator 处理量逐月下降 | 自动执行比例停滞，Operator 处理量随租户增长线性增加 |
| **10000 卖家测试** | 运营团队 20 人管 10000 卖家（1:500） | 运营团队 1000 人管 10000 卖家（1:10） |

### 铁律验证清单

| # | 铁律 | 验证方法 | 失败后果 |
|---|------|---------|---------|
| 1 | Operator 拒绝必须选原因 | 用 Operator token 调用 reject API 不带 rejectionReason → 返回 400 | Layer 7 进化层无燃料 |
| 2 | Tenant Admin 授权中心不能跳过 | 新增 Agent 能力后，检查默认状态 → 必须为 disabled | Agent 失控风险 |
| 3 | System Admin 看不到单一租户数据 | 用 system_admin token 调用所有 API → 响应中无单租户业务字段 | 数据泄露 |
| 4 | Supplier 双重隔离售价利润 | 用 supplier token 调用所有 API → 响应中无 price/margin/profit 字段 | 商业机密泄露 |
| 5 | Viewer 零操作按钮 | 用 viewer token 调用任何 POST/PUT/DELETE → 返回 403 | 权限越界 |

### 量化终极指标

| 指标 | 当前 | Sprint 4 后 | Sprint 8 后 | 终极目标 |
|------|------|------------|------------|---------|
| Agent 决策准确率 | 未知 | > 60% | > 85% | > 95% |
| 自动执行比例 | 0% | 30% | 70% | 90%+ |
| Operator 日均处理待办数 | N/A | 50 条 | 20 条 | < 5 条 |
| 拒绝原因填写率 | 0% | 100% (强制) | 100% (强制) | 100% (强制) |
| 每租户运维人力比 | 1:10 | 1:50 | 1:500 | 1:5000 |
| Viewer 30 秒理解率 | 未知 | > 70% | > 90% | > 95% |
| experience 表日增记录 | 0 | > 100 | > 1000 | > 10000 |

---

## Key Decisions

1. **神经接口三维缺一不可**：推送 + 透明 + 反馈构成飞轮，缺任何一环都转不起来
2. **最致命反模式是无反馈闭环**：直接杀死 Layer 7 进化层，优先级最高
3. **5 条铁律是工程强制的**：不是设计建议，是 API 层 + 前端双重强制
4. **每个 UI 元素必须映射到 Harness 层**：无法映射的元素不应存在
5. **Mobile 优先级分层**：Operator 最高，System Admin 最低
6. **成本档案是利润引擎的燃料**：8 大成本项缺一不可，手动项超过更新周期 1.5 倍时主动提醒
7. **拒绝原因是枚举 + 自由文本**：枚举保证可聚合，自由文本捕获细节
8. **Operator 有两种操作模式**：响应模式（主要，回应 Agent 推送）+ 主动模式（辅助，手动发起操作），两者都写入 experience 表但标记不同 source
9. **Tenant Admin 与 Viewer 共享经营数据组件**：同一组件通过 role prop 切换渲染模式，不是两套独立页面

## Open Questions

（无——所有关键问题已在对话中确认）

## Next Steps

→ 运行 `/workflows:plan` 基于本文档 + 现有实施计划生成具体 UI 实现计划
