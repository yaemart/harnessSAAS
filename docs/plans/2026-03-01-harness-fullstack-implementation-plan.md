---
date: 2026-03-01
topic: harness-fullstack-implementation
depends-on:
  - ../brainstorms/2026-03-01-harness-engineering-evaluation-brainstorm.md
  - ../brainstorms/2026-03-01-ui-role-interaction-spec-brainstorm.md
status: draft
deepened: 2026-03-01
research-agents-used:
  - IAM/RBAC 最佳实践研究
  - Agent 决策信号接入研究
  - 记忆层/进化层实现研究
  - 架构策略审查
  - 安全审查
  - 性能审查
---

# Harness Engineering 全栈实施计划

## Enhancement Summary

**深化日期：** 2026-03-01
**研究 Agent 数量：** 6 个并行研究/审查 Agent
**增强章节数：** 全部 8 个 Sprint + 技术选型 + 风险矩阵

### 关键改进

1. **Sprint 3 拆分为 3a/3b**：架构审查发现原 Sprint 3 严重超载（4 周工作量塞进 2 周），拆分后风险大幅降低
2. **新增安全加固要求**：每个 Sprint 补充了安全交付物（S2S HMAC、CORS 收紧、字段过滤双层防御等）
3. **新增性能优化要求**：发现 6 个严重性能瓶颈（连接池、事务合并、SSE 广播等），在对应 Sprint 中加入修复
4. **experience 表 Schema 前置设计**：由 Sprint 6 需求倒推 Sprint 1 的 Schema，避免后续数据迁移
5. **双栈契约统一**：新增 `packages/agent-contract` 要求，解决 Python/TypeScript 接口不一致问题
6. **测试策略补充**：每个 Sprint 加入最低测试要求

### 新发现的风险

- 当前 schema.prisma 与 migrations 不同步（紧急修复）
- `graph_runtime.py` 单文件 510 行将在 Sprint 2 崩溃（需预先拆分）
- PostgreSQL 连接池默认 10 个连接，50 并发即耗尽
- SSE EventEmitter 广播模式在 200 连接时 CPU 飙升

---

## Overview

将 4 条工作线（Harness 工程基础设施、IAM + Data Scope、角色化 UI、Agent 决策信息矩阵）交织推进，通过 **10 个 Sprint（约 18-20 周）** 将系统从"广告出价调整 MVP"升级为"自进化的跨境电商 AI 运营系统"。

### 核心约束

- Sovereign 架构（Death Line / 四权 / OODA / Constitution）保留为治理内核，不重写
- 每个 Sprint 结束时系统都比上一个 Sprint 更有价值（可感知的能力提升）
- 渐进式演进，不破坏现有功能
- **每个 Sprint 必须包含测试交付物和回滚策略**

### 4 条工作线

| 工作线 | 内容 | 来源文档 |
|--------|------|----------|
| A | Harness 工程基础设施（7 层） | harness-engineering-evaluation-brainstorm |
| B | IAM + RBAC + Data Scope | ui-role-interaction-spec-brainstorm |
| C | 角色化 UI（5 角色 × Web + Mobile） | ui-role-interaction-spec-brainstorm |
| D | Agent 决策信息矩阵（50+ 信号） | 对话中的决策信息全景图 |

---

## Sprint 0：地基 + 安全加固（约 5 天）

### 目标
所有后续 Sprint 产生的数据自动带上 userId + scope；CI 管道加固；现有 schema/migration 对齐。

### 交付物

#### 0.1 紧急修复（Day 1）

- **Schema/Migration 对齐**：运行 `prisma migrate dev` 生成对齐迁移，确保 schema 和迁移历史一致
- **graph_runtime.py 拆分**：创建 `apps/agent-py/src/nodes/` 目录，每个节点拆为独立文件，`graph_runtime.py` 只保留图构建逻辑
- **CI 加固**：将 `lint_death_line.py` 加入 CI pipeline，配置 `.importlinter` 检查

#### 0.2 Prisma Schema 新增

```prisma
model User {
  id        String      @id @default(cuid())
  email     String      @unique
  name      String
  tenantId  String      @db.Uuid
  role      String      // "system_admin" | "tenant_admin" | "operator" | "supplier" | "viewer"
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  tenant    Tenant      @relation(fields: [tenantId], references: [id])
  scopes    UserScope[]
}

model UserScope {
  id         String @id @default(cuid())
  userId     String
  tenantId   String @db.Uuid
  scopeType  String // "brand" | "category" | "platform" | "market"
  scopeValue String
  user       User   @relation(fields: [userId], references: [id])
  tenant     Tenant @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId, scopeType, scopeValue])
  @@index([userId, tenantId])
}
```

#### 0.3 API 中间件（pass-through）+ 安全加固

- `extractUser`：从 `x-user-id` + `x-user-role` header 取值，**必须验证 User 在 DB 中存在且 role 匹配**
- `extractScope`：查 UserScope 表，注入当前用户的数据范围
- 审批/拒绝操作记录真实 userId
- reject API 必须携带 `rejectionReason` 字段

**安全加固（研究洞察）：**

- **生产环境 kill switch**：`NODE_ENV=production` 时拒绝 pass-through auth
- **CORS 收紧**：从 `cors()` 无参数改为白名单 origin
- **硬编码 secrets 检查**：生产环境强制要求 `RUN_INTENT_SIGNING_SECRET` 等环境变量存在
- **S2S HMAC 签名**：Python Agent ↔ TypeScript API 通信使用 HMAC-SHA256 签名验证

```typescript
// S2S 签名方案
function signS2SRequest(body: string, secret: string): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${body}`).digest('hex');
  return { timestamp, signature };
}
```

#### 0.4 性能基础修复

- **连接池配置**：从 pg 默认 `max: 10` 调整为 `max: 30`
- **LISTEN/NOTIFY 重连机制**：SSE 监听连接断开后自动重连
- **EventEmitter maxListeners**：调整为 1000+

#### 0.5 前端

- `AuthContext` + `ScopeContext`（硬编码默认用户）
- 审批拒绝弹窗增加原因选择（枚举 + 自由文本）

### 回滚策略
```typescript
const AUTH_MODE = env.AUTH_MODE || 'passthrough'; // 'full' | 'passthrough' | 'disabled'
```

### 测试要求
- [ ] extractUser 中间件单元测试（合法/非法 header）
- [ ] S2S HMAC 签名验证测试
- [ ] 迁移 up/down 测试

### 验收标准
- [ ] 审批操作记录真实 userId（不再是 dashboard-operator）
- [ ] 拒绝操作必须携带 rejectionReason
- [ ] CI 运行 `lint_death_line.py` 并通过
- [ ] `graph_runtime.py` 拆分为 `nodes/` 目录下独立文件
- [ ] 现有功能不受影响

---

## Sprint 1：执行闭环 + Tier 1 信号前 3 个（约 2 周）

### 目标
Agent 的决策有结果反馈 + 知道品类/平台/市场。

### 交付物

#### 1.1 执行闭环

- ExecutionReceipt 回写到 DB（新增 ExecutionReceipt 表）
- **experience 表 schema（由 Sprint 6 需求倒推设计）**
- /approvals API join AgentExecutionLog，返回 reasoningLog + constitution + governance
- 前端 SovereignGovernanceInsight 在审批详情中展示真实数据

#### 1.2 Experience 表 Schema（研究洞察）

experience 表设计必须支持后续记忆层和进化层的需求：

```sql
CREATE TABLE agent_experiences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(128) NOT NULL,
    trace_id        VARCHAR(128) NOT NULL,

    intent_type     VARCHAR(64) NOT NULL,
    intent_domain   VARCHAR(32) NOT NULL,
    platform        VARCHAR(32) NOT NULL,
    market          VARCHAR(16) NOT NULL,
    category_id     VARCHAR(128),

    observe_snapshot    JSONB NOT NULL,
    orient_analysis     JSONB NOT NULL,
    decide_rationale    JSONB NOT NULL,
    act_intent          JSONB NOT NULL,

    execution_status    VARCHAR(32) NOT NULL,
    execution_receipt   JSONB,
    outcome_metrics     JSONB,

    quality_score       FLOAT,
    score_breakdown     JSONB,

    -- Sprint 6 pgvector 预留列（暂不建索引）
    -- context_embedding   vector(384),

    distilled           BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_measured_at TIMESTAMPTZ
);

CREATE INDEX idx_exp_tenant_domain ON agent_experiences(tenant_id, intent_domain);
CREATE INDEX idx_exp_platform_market ON agent_experiences(platform, market);
CREATE INDEX idx_exp_created ON agent_experiences(created_at DESC);
CREATE INDEX idx_exp_undistilled ON agent_experiences(distilled) WHERE distilled = FALSE;
```

**关键设计决策：**
- OODA 四阶段完整保存（observe/orient/decide/act），与现有 `ReasoningLog` 一一对应
- `quality_score` 预留给 Sprint 7 的 `evaluate_session`
- pgvector 列暂注释，Sprint 6 时通过迁移添加
- 按月分区策略在 Sprint 5 前规划

#### 1.3 Tier 1 信号前 3 个（已有数据模型，只需 join）

| 信号 | 实现方式 | 影响 |
|------|----------|------|
| 品类上下文 | Agent 读取 product.categoryId，注入 OODA Observe | 按品类调整策略权重 |
| 平台上下文 | Agent 读取 listing.platform | 区分 Amazon/Walmart/TikTok 逻辑 |
| 市场上下文 | Agent 读取 commodity.market | 区分 US/DE/JP 行为 |

#### 1.4 进化层数据管道

- 只收集不分析：每次执行的结果、评分、上下文都存入 experience 表
- 使用 PgBoss 异步写入（不阻塞主决策流程）

#### 1.5 性能优化

- **withTenant 事务合并**：将同一请求内的多个 `withTenant` 调用合并为单个事务（从 6 个事务 → 1 个，DB 连接占用减少 ~80%）
- **isCircuitOpen 修复**：在 `AgentExecutionLog` 上新增 `targetKey` 列替代 LIKE 全表扫描

### 测试要求
- [ ] ExecutionReceipt 写入/读取集成测试
- [ ] experience 表写入集成测试
- [ ] /approvals API 返回完整 governance 数据的集成测试

### 验收标准
- [ ] ExecutionReceipt 写入 DB 并可查询
- [ ] /approvals 返回完整 governance 数据
- [ ] Agent 决策日志包含品类/平台/市场信息
- [ ] experience 表有数据写入
- [ ] POST /run 端到端 DB 事务数 ≤ 2

---

## Sprint 2：工具层 + Tier 1 信号后 3 个 + Agent 决策升级（约 2 周）

### 目标
Agent 调用真实工具，按品类/生命周期走不同策略，输出置信度。

### 交付物

#### 2.1 双栈契约统一（研究洞察）

新增 `packages/agent-contract/`：

```
packages/agent-contract/
├── openapi.yaml          # 统一 API 契约
├── schemas/
│   ├── tool-call.yaml    # 工具调用 schema
│   ├── agent-state.yaml  # Agent 状态 schema
│   └── platform.yaml     # 平台能力 schema
```

确保 Python 和 TypeScript 之间的接口始终一致。

#### 2.2 工具层

- ToolRegistry 统一注册机制（注册、调用计数、错误率统计）
- load_performance_node 调用真实 read 工具（替代 _mock_performance_for_listing）
- 工具调用结果 schema 校验
- Brain 按 get_capabilities() 选平台
- **工具层 API 端点复用 Sprint 0 的 pass-through auth**（Sprint 3a 统一升级）

#### 2.3 Tier 1 信号后 3 个（需要新字段和计算逻辑）

| 信号 | 实现方式 | 影响 |
|------|----------|------|
| 生命周期判断 | 多信号加权评分算法（见下方） | 不同阶段不同策略 |
| 真实利润率 | 集中利润计算公式（8 大成本项） | 知道 ACOS 容忍上限 |
| 评论评分 | 新增 reviewScore/reviewCount 字段 | 低评分时抑制广告 |

#### 2.4 产品生命周期自动判断算法（研究洞察）

四阶段判定模型，基于多信号加权评分：

| 阶段 | 核心信号 | 权重最高的指标 |
|------|---------|-------------|
| **导入期** | 上架天数 < 90天，评论总数 < 50，销量爬坡中 | `days_since_launch` |
| **成长期** | 30天销量斜率 > 3%，评论周增 > 20%，ACOS 改善 | `sales_slope_30d` |
| **成熟期** | 销量斜率 ≈ 0，评论增长稳定，ACOS 稳定 | `abs(slope) < 2%` |
| **衰退期** | 销量斜率 < -3%，ACOS 恶化，退货率 > 8% | `sales_slope_30d` + `acos_trend` |

#### 2.5 真实利润计算公式（研究洞察）

完整成本项（8 大类）：

| 类别 | 成本项 | 占售价比例 | Agent 信号名 |
|------|-------|-----------|-------------|
| 平台佣金 | Referral Fee | 8-17% | `referral_fee_rate` |
| 配送费 | FBA Fulfillment | $3-10/件 | `fba_fee_per_unit` |
| 仓储费 | Monthly Storage | $0.78-2.40/ft³ | `storage_cost_per_unit` |
| 广告费 | PPC Spend | 5-25% (TACoS) | `tacos`, `acos` |
| 头程物流 | Inbound Shipping | 10-20% | `inbound_cost_per_unit` |
| 退货 | Returns + Processing | 2-8% | `return_rate`, `return_cost` |
| 汇率 | FX Loss | 1-3% | `fx_loss_rate` |
| 税务 | VAT/GST + Income Tax | 5-25% | `vat_rate`, `tax_rate` |

#### 2.6 Agent 决策升级

- **LangGraph conditional edge**：按品类/生命周期走不同分支

```
entry → supervisor → listing → load_perf → lifecycle_detect → signal_enrich → router
                                                                                 │
                    ┌────────────┬────────────┬────────────┬────────────────────┘
                    ▼            ▼            ▼            ▼            ▼
               launch_decide  decline_decide  emergency  social_decide  standard_decide
                    │            │            │            │            │
                    └────────────┴────────────┴────────────┴────────────┘
                                              ▼
                                    risk_check → constitution → freshness → execute → END
```

- **置信度输出**（研究洞察）：基于 6 因子加权计算

| 因子 | 权重 | 说明 |
|------|------|------|
| 样本量充分性 | 25% | 30 次点击最低可信，300+ 高置信 |
| 数据新鲜度 | 20% | 线性衰减，2×TTL = 0 |
| 信号完整性 | 20% | 可用信号 / 期望信号 |
| 信号一致性 | 15% | 多信号是否指向同一方向 |
| 决策幅度惩罚 | 10% | 大幅变动 → 低置信 |
| 规则合规 | 10% | Constitution 违规惩罚 |

- **置信度等级与行为映射**：

| 置信度 | 等级 | Agent 行为 |
|--------|------|-----------|
| ≥ 0.85 | HIGH | 自动执行 |
| 0.60-0.85 | MEDIUM | 执行但标记复核 |
| 0.40-0.60 | LOW | 需人工审批 |
| < 0.40 | VERY_LOW | 拒绝执行，请求更多数据 |

- Constitution 扩展：规则条件支持品类/平台/市场维度
- **Prompt 注入防护**：Agent 输入 sanitize（检测 injection patterns）
- **Intent Schema 强校验**：Zod schema 硬编码 deltaPct 上下限（-30% ~ +30%）

#### 2.7 数据预加载优化（研究洞察）

在 Node.js 端预加载所有 Agent 需要的数据，一次性传给 Python，消除 Agent 执行期间的 HTTP 回调：

```typescript
const agentContext = await withTenantBatch(tenantId, async (tx) => {
  const [performance, policy, constitution, listing] = await Promise.all([
    tx.performanceSnapshot.findFirst({ where: { listingId, tenantId } }),
    resolveParams(tx, { tenantId, brandId, productId }),
    loadActiveConstitution(tx, tenantId),
    tx.listing.findFirst({ where: { id: listingId, tenantId } }),
  ]);
  return { performance, policy, constitution, listing };
});
```

### 测试要求
- [ ] ToolRegistry 注册/调用/统计单元测试
- [ ] 生命周期检测算法单元测试（4 个阶段各 2 个用例）
- [ ] 利润计算公式单元测试
- [ ] 置信度计算单元测试
- [ ] conditional edge 路由集成测试

### 验收标准
- [ ] _mock_performance_for_listing 不再被调用
- [ ] 不同品类的产品走不同的决策分支
- [ ] Agent 输出包含 confidence 和 sample_size
- [ ] ToolRegistry.get_stats() 返回调用统计
- [ ] lifecycleStage 基于数据自动计算（不再永远是 "NEW"）
- [ ] Agent 端到端延迟 < 500ms（数据预加载后）

---

## Sprint 3a：完整 IAM（约 2 周）

### 目标
系统有真实的认证和授权能力。

### 交付物

#### 3a.1 认证方案（研究洞察）

**推荐：自建 JWT（jose 库）而非 NextAuth v5**

原因：后端是 Hono（非 Next.js API Routes），NextAuth v5 的 Hono adapter 不成熟。

- JWT 签名算法：RS256（非对称），API 只需公钥验证
- Access Token：15 分钟有效期，存内存（不存 localStorage）
- Refresh Token：7 天滑动窗口，HttpOnly + Secure + SameSite=Strict Cookie
- Token 旋转：每次 refresh 旧 token 失效，发新 token
- Token 家族检测：重用已撤销的 refresh token → 撤销整个家族

**JWT Payload 结构：**

```typescript
interface JWTPayload {
  sub: string;          // userId
  iss: string;          // "harness-auth"
  aud: string;          // "harness-api"
  iat: number;
  exp: number;
  jti: string;          // 防重放
  tid: string;          // tenantId
  role: Role;
  scopes: string[];     // ["brand:uuid1", "category:uuid2"]
}
```

#### 3a.2 API Auth Middleware（所有端点接入）

- JWT 验证中间件（Hono middleware）
- RoleGuard（页面级权限守卫）
- **UserScope 内存缓存**（LRU Cache，5 分钟 TTL，99%+ 命中率）
- Service-to-service auth 路径保留（HMAC 签名，与用户 JWT 分开）
- **Feature flag 回滚**：`AUTH_MODE` 环境变量支持降级到 pass-through

#### 3a.3 前端

- 登录页
- 导航按角色过滤
- Token 自动刷新机制

### 测试要求
- [ ] JWT 签发/验证/过期/刷新完整测试链
- [ ] 5 个角色的权限矩阵测试（每角色 5+ 端点）
- [ ] Token 重用检测测试
- [ ] Feature flag 降级测试

### 回滚策略
```typescript
const AUTH_MODE = env.AUTH_MODE || 'full'; // 'full' | 'passthrough' | 'disabled'
```

### 验收标准
- [ ] 5 个角色登录后看到不同的导航
- [ ] 未认证请求返回 401
- [ ] Token 过期后自动刷新
- [ ] S2S 通信不受用户 JWT 影响

---

## Sprint 3b：角色化 UI 第一批 + 字段/数据过滤（约 2 周）

### 目标
系统第一次有"不同人看到不同东西"的能力。

### 交付物

#### 3b.1 FieldFilter（Supplier 字段过滤）

**必须 API 层 + DB 层两者都做（研究洞察）：**

- **API 层**：响应拦截中间件，递归移除 `SUPPLIER_HIDDEN_FIELDS`（costPrice, msrp, profitMarginPct, sales, normalizedRoas, acos, spend 等）
- **DB 层**：Prisma select 白名单，Supplier 查询时只 select 允许的字段
- **集成测试**：用 Supplier token 请求任意端点，响应 JSON 中不得包含任何隐藏字段

#### 3b.2 Data Scope 过滤（Brand 维度）

**三层防御架构（研究洞察）：**

1. **中间件注入 Scope**：从 DB 加载 UserScope（缓存），不信任客户端传入
2. **查询构建器自动注入 WHERE**：`buildScopeFilter(auth)` 为所有查询添加 `brandId IN (...)`
3. **PostgreSQL RLS**：最终防线，通过 GUC 变量传入 scope

**防绕过检查清单：**
- 客户端传入的 brandId/categoryId 必须与 user scope 交叉验证
- 禁止在 URL query 中传入 scope 参数覆盖服务端 scope
- system_admin 和 tenant_admin 有全租户访问权

#### 3b.3 角色化 UI 第一批

| 角色 | 页面 | 核心交互 |
|------|------|----------|
| Operator | Agent 待办中心（首页重建） | 执行/修改/拒绝 + 置信度 + 拒绝原因 |
| Tenant Admin | Agent 授权中心 | Agent 能力开关 + 阈值配置 |
| Viewer | 经营大屏 | 营收/利润汇总 + AI 效能报告 |

### 测试要求
- [ ] Supplier 字段过滤集成测试（所有端点）
- [ ] Data Scope 隔离测试（Operator A 不能看到 Operator B 的 brand 数据）
- [ ] Viewer 页面零操作按钮验证

### 验收标准
- [ ] Supplier 视图无 price/margin 字段（API + 前端双重验证）
- [ ] Viewer 页面零操作按钮
- [ ] Operator 拒绝时必须选原因
- [ ] Agent 授权中心新能力默认关闭
- [ ] Data Scope 过滤在所有查询端点生效

---

## Sprint 4：执行韧性 + EventBus 基础 + 基础监控（约 2 周）

### 目标
Agent 更稳定，有事件通信基础，有基础监控。

### 交付物

#### 4.1 执行韧性

- retry / recovery 机制（指数退避，最多 3 次）
- 统一异常处理框架（错误码 + 结构化日志）
- Agent 自我审查（REVIEWING 状态）
- **Agent 速率限制 + 累计限额**（研究洞察）：每租户每日最大操作次数 + 累计金额上限

#### 4.2 EventBus 基础（从 Sprint 5 提前）

- Agent EventBus 基础实现（事件定义 + emit）
- `intent.completed` / `intent.failed` 事件
- retry 失败后触发 `intent.failed` 事件

#### 4.3 基础监控（研究洞察）

- Agent 执行成功/失败率 metric
- API 端点响应时间 metric
- PgBoss 队列深度告警
- **审计日志哈希链**：每条审计记录包含前一条的 hash，防篡改

#### 4.4 Tier 2 信号接入

| 信号 | 数据源 | 决策影响 |
|------|--------|----------|
| CTR / CVR | PerformanceSnapshot | 区分出价问题 vs 内容问题 |
| 竞品价格 | 外部数据源接入 | 定价策略核心输入 |
| 退货率 | 平台 API | 隐性成本 |
| 在途库存 | 供应链系统 | 有在途时可更激进 |
| 季节性/大促日历 | 公共知识库 | 提前准备 |
| 汇率 | 外部 API | 利润波动因素 |

### 测试要求
- [ ] retry 机制测试（模拟 1/2/3 次失败后成功）
- [ ] 速率限制测试（超过限额时拒绝执行）
- [ ] EventBus 事件发布/订阅测试

### 验收标准
- [ ] Agent 执行失败后自动重试（最多 3 次，指数退避）
- [ ] 异常有统一的错误码和日志格式
- [ ] CTR/CVR 参与决策逻辑
- [ ] 审计日志哈希链完整性可验证

---

## Sprint 5：角色化 UI 第二批 + 协作层消费端（约 2 周）

### 目标
5 个角色都有核心页面，EventBus 消费端接入。

### 交付物

#### 5.1 角色化 UI 第二批

| 角色 | 页面 |
|------|------|
| Operator | 产品驾驶舱、利润报表 |
| Tenant Admin | Constitution 管理、团队管理 |
| System Admin | 平台运维看板 |
| Supplier | 采购订单看板 |

#### 5.2 协作层消费端

- EventBus 消费端接入（前端 SSE 推送）
- **SSE 按 tenantId 分组**（研究洞察）：从 O(N) 广播 → O(M) 精确推送
- **SSE 连接限制**：每租户最多 10 个 SSE 连接
- governance-dashboard 接真实数据
- Data Scope 扩展到 Category 维度

#### 5.3 experience 表分区规划

- 按月分区（`PARTITION BY RANGE (created_at)`）
- 自动分区管理（pg_partman 或手动 DDL）
- 90 天前的数据归档策略

### 测试要求
- [ ] 5 个角色页面的 E2E 测试（Playwright）
- [ ] SSE 推送集成测试
- [ ] Category scope 过滤测试

### 验收标准
- [ ] 5 个角色都有核心工作页面
- [ ] Agent 执行完成/失败时触发事件并推送到前端
- [ ] governance-dashboard 展示真实数据（不再是 mock）
- [ ] Operator 可按 Category 过滤数据

---

## Sprint 6：记忆层 + 观测层增强（约 2 周）

### 目标
Agent 能回忆过去的决策和结果。

### 交付物

#### 6.1 pgvector 迁移

- 安装 pgvector 扩展（`CREATE EXTENSION vector`）
- 为 experience 表添加 `context_embedding vector(384)` 列
- HNSW 索引（`m=16, ef_construction=64`）

**关键决策（研究洞察）：**
- 使用 384 维而非 1536 维（内存减少 75%）
- 分区表上每个分区独立建 HNSW 索引
- pgvector 在 < 5000 万条时足够，无需引入外部向量数据库

#### 6.2 记忆层

- **短期记忆**：会话级 context buffer（LangGraph checkpoint）
- **长期记忆**：experience 表查询（基于 Sprint 1 积累的数据）
- **语义检索**：先用元数据过滤（tenant_id + domain + 时间范围），再做向量搜索

```sql
SELECT * FROM agent_experiences
WHERE tenant_id = $1
  AND intent_domain = $2
  AND created_at > NOW() - INTERVAL '90 days'
ORDER BY context_embedding <=> $3::vector
LIMIT 10;
```

- **Embedding 路径**（研究洞察）：`Python (generate embedding) → HTTP → TypeScript API → pgvector`

#### 6.3 ObservationSet 扩展（研究洞察）

从扁平 Dict 升级为分层信号域（Layered Signal Domains）：

```
StructuredObservationSet
├── ads: AdsSignals (roas, acos, ctr, cvr, cpc, tacos...)
├── inventory: InventorySignals (inventory_days, reorder_point...)
├── competitor: CompetitorSignals (competitor_price_avg, buybox_win_rate...)
├── customer: CustomerSignals (review_rating, return_rate...)
├── financial: FinancialSignals (profit_margin_pct, fx_rate...)
├── market: MarketSignals (bsr_rank, season_window...)
├── product: ProductSignals (days_since_launch, listing_quality...)
└── lifecycle: LifecycleSignalDomain (stage, confidence, sales_slope...)
```

每个信号自带元数据（observed_at, freshness, source, confidence），支持：
- `signal_completeness()` 计算信号完整性
- `stale_signals()` 列出过期信号
- `to_flat_snapshot()` 向后兼容旧版 Constitution 规则

#### 6.4 观测层增强

- 结构化日志（requestId + tenantId + traceId + userId）
- Tracer span（关键节点埋点）
- System Admin：Harness 层级监控页面

### 测试要求
- [ ] pgvector 迁移 up/down 测试
- [ ] 语义检索准确性测试（给定上下文，检索到相关历史案例）
- [ ] StructuredObservationSet 序列化/反序列化测试
- [ ] 向后兼容 to_flat_snapshot() 测试

### 验收标准
- [ ] Agent 决策时可查询相似历史案例
- [ ] 日志包含完整的 trace 链路
- [ ] System Admin 可看到 Harness 7 层健康度
- [ ] 语义检索延迟 < 50ms

---

## Sprint 7：进化层 + Tier 3 信号（约 2 周）

### 目标
Agent 从经验中学习，越来越聪明。

### 交付物

#### 7.1 进化层

- **evaluate_session**（研究洞察）：6 维加权评分

| 维度 | 权重 | 说明 |
|------|------|------|
| 目标达成度 | 30% | 执行成功 + 业务指标改善 |
| 执行效率 | 15% | 步骤数、延迟 |
| 工具使用合理性 | 15% | 观察阶段数据充分性 |
| 自我修正能力 | 10% | 考虑替代方案、重试后成功 |
| 风险合规 | 15% | Constitution 通过率 |
| 业务影响 | 15% | 销售/利润变化 |

- **distill_pattern**（研究洞察）：三阶段蒸馏流水线
  1. HDBSCAN 聚类发现自然模式群
  2. 决策树规则提取（max_depth=4，保证可解释性）
  3. 验证并入库（置信度 > 0.7，样本量 > 10）

- **apply_pattern**：分级自动化框架

| 模式 | 条件 | 行为 |
|------|------|------|
| SHADOW | 新模式 | 仅记录，不影响决策 |
| SUGGEST | 置信度 ≥ 0.6，样本 ≥ 10 | 建议，需人工确认 |
| AUTO_LOW | 置信度 ≥ 0.8，样本 ≥ 30 | 低风险自动应用 |
| AUTO_FULL | 置信度 ≥ 0.9，样本 ≥ 100 | 完全自动应用 |

**安全护栏：**
- 连续 3 次失败自动降级到 SUGGEST
- 超过 90 天未验证的模式自动衰减
- HIGH/CRITICAL 风险操作始终需要人工审批

- Evolution Dashboard 接真实数据

#### 7.2 Tier 3 信号接入

- 关键词级别数据
- 差评关键词分析
- 竞品排名/评论/新品动态
- 供应商交期可靠度

### 测试要求
- [ ] evaluate_session 评分函数单元测试（各维度边界值）
- [ ] 蒸馏流水线集成测试（给定 100 条经验，能提取模式）
- [ ] 模式应用安全门控测试（各级别条件验证）

### 验收标准
- [ ] evaluate_session 对历史执行数据评分
- [ ] 至少蒸馏出 5 个可复用的决策模式
- [ ] Evolution Dashboard 展示真实学习曲线
- [ ] Agent 在高置信度场景下应用已学模式
- [ ] 模式降级/衰减机制正常工作

---

## Sprint 8：高阶能力（约 2-4 周）

### 目标
系统具备完整的自进化能力。

### 交付物

#### 8.1 三层知识隔离（研究洞察）

| 层 | 内容 | 隔离方式 | 安全要求 |
|----|------|---------|---------|
| Layer A（公共） | 平台规则、季节趋势、通用策略 | 无租户 ID，所有人可读 | 变更需双人审批 |
| Layer B（行业聚合） | 脱敏后的跨租户统计 | industry_category 隔离 | K-匿名（≥5 租户）+ 差分隐私 |
| Layer C（卖家私有） | SKU、价格、利润、策略 | RLS 强制 tenant_id 隔离 | FORCE ROW LEVEL SECURITY |

**脱敏规则：**
- 绝对排除字段：costPrice, msrp, profitMarginPct, supplierCode, apiCredentials, contactEmail
- 数值字段加 ±5% 拉普拉斯噪声
- 聚合使用中位数（抗异常值）而非均值

#### 8.2 冷启动策略（研究洞察）

新租户三阶段渐进：

| 阶段 | 经验量 | 知识权重 | 探索率 | 最大调价幅度 |
|------|--------|---------|--------|------------|
| Cold | < 50 | A:50% B:40% C:10% | 30% | 5% |
| Warming | 50-500 | A:30% B:30% C:40% | 15% | 8% |
| Mature | > 500 | A:10% B:20% C:70% | 5% | 12% |

#### 8.3 其他高阶能力

- 跨维度归因引擎
- 可组合 Agent 网络（Orchestrator + 动态子图）
- Mobile 端交付
- System Admin：公共知识管理

### 验收标准
- [ ] 跨租户聚合知识可查询（脱敏）
- [ ] 新租户冷启动使用行业基准（不从零开始）
- [ ] 归因引擎可分解利润变动的因素
- [ ] Agent 链可按任务动态组合
- [ ] Operator Mobile 端可左滑执行/右滑拒绝

---

## 技术选型

| 领域 | 选型 | 理由 | 研究验证 |
|------|------|------|----------|
| 认证 | **自建 JWT（jose 库）** | Hono 后端非 Next.js API Routes，NextAuth v5 adapter 不成熟 | ✅ 安全研究确认 |
| 状态机 | LangGraph | 已有基础，支持 conditional edge | ✅ 决策信号研究验证 |
| 事件总线 | PostgreSQL LISTEN/NOTIFY + 内存 EventEmitter | 已有 SSE 基础，渐进增强 | ⚠️ 需加重连机制 |
| 向量检索 | pgvector (384 维 HNSW) | 不引入新依赖，< 5000 万条足够 | ✅ 性能研究确认 |
| 结构化日志 | pino | Hono 生态兼容，JSON 格式 | ✅ |
| 蒸馏算法 | HDBSCAN + 决策树 | 无需预设 K，规则可解释 | ✅ 记忆层研究确认 |
| Mobile | 待评估（PWA 优先） | Sprint 8 前决定 | - |

---

## 风险与缓解（增强版）

| 风险 | 影响 | 缓解策略 | 来源 |
|------|------|----------|------|
| **Schema/Migration 不同步** | 极高 | Sprint 0 Day 1 对齐 | 架构审查 |
| **Sprint 3 超载** | 高 | 拆分为 3a + 3b | 架构审查 |
| **PostgreSQL 连接池耗尽** | 高 | Sprint 0 调整 max:30+ | 性能审查 |
| **withTenant 事务过多** | 高 | Sprint 1 合并事务 | 性能审查 |
| **Pass-through auth 安全漏洞** | 高 | 生产 kill switch + DB 验证 | 安全审查 |
| **S2S 通信无鉴权** | 高 | Sprint 0 HMAC 签名 | 安全审查 |
| **SSE 广播风暴** | 中 | Sprint 5 按 tenantId 分组 | 性能审查 |
| **graph_runtime.py 单文件膨胀** | 中 | Sprint 0 拆分 | 架构审查 |
| **Python/TS 接口不一致** | 中 | Sprint 2 agent-contract | 架构审查 |
| IAM 改造影响 100+ 端点 | 中 | Sprint 0 pass-through，Sprint 3a 渐进 | 原计划 |
| 真实平台 API 不稳定 | 中 | Sprint 4 retry/recovery | 原计划 |
| 进化层数据不足 | 中 | Sprint 0 就开始收集 | 原计划 |
| **pgvector 内存 (3600 万条)** | 中 | 384 维 + 分区 + 归档 | 性能审查 |
| **审计日志可篡改** | 中 | Sprint 4 哈希链 | 安全审查 |
| **Prompt 注入** | 中 | Sprint 2 输入 sanitize | 安全审查 |
| **CORS 全开** | 中 | Sprint 0 收紧 | 安全审查 |
| Category 树形 Scope 复杂 | 低 | 分配时展开存储 | 原计划 |
| Constitution 扩展到约束人 | 低 | 复用现有引擎 | 原计划 |

---

## 数据库迁移路线图

| Sprint | 新增/修改模型 | 迁移复杂度 | 关键注意 |
|--------|--------------|-----------|---------|
| S0 | +User, +UserScope, Tenant 加 relation, Schema 对齐 | 中 | 先对齐再新增 |
| S1 | +ExecutionReceipt, +Experience, AgentExecutionLog 加 targetKey | 中 | experience schema 由 S6 倒推 |
| S2 | +ToolCallLog, Product 加 reviewScore | 低 | |
| S3a | User 加 auth 字段 | 低 | |
| S3b | 无 | 无 | |
| S4 | AgentExecutionLog 加 retry 字段 | 低 | |
| S5 | +AgentEvent, experience 分区, UserScope 扩展 category | 中 | 分区需停机窗口 |
| S6 | experience 加 vector 列 + HNSW 索引 | **高** | 需确认 pgvector 扩展可用 |
| S7 | +DistilledPattern, +PatternApplication | 中 | |
| S8 | +KnowledgeLayerA, +KnowledgeLayerB | 中 | |

**预估：10-12 次迁移，每次迁移必须包含 rollback SQL。**

---

## 终极验证标准

> 三年后，10000 个卖家时，运营团队规模是否需要同比增长？
> 如果不需要 → Harness Engineering 做对了。

### 量化指标

| 指标 | 当前 | Sprint 4 后 | Sprint 8 后 |
|------|------|------------|------------|
| Agent 决策准确率 | 未知 | > 60% | > 85% |
| 自动执行比例 | 0% | 30% | 70% |
| 端到端决策延迟 | > 1s | < 500ms | < 300ms |
| 每租户运维人力 | 1:10 | 1:50 | 1:500 |
| 新租户冷启动时间 | N/A | 7 天 | 1 天 |
