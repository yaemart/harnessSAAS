# 架构决策记录（ADR）

本文件记录所有已确认的架构决策。新决策追加到末尾，已有决策只能标记 `[Superseded by ADR-xxx]`，不可删除。

---

## ADR-001: Sovereign Architecture — Death Line

**状态：** 已生效

Cognition 层（`apps/agent-py/src/nodes/`）与 Execution 层之间存在不可逾越的物理隔离。

- Cognition 层禁止导入：数据库客户端、平台 SDK、外部 API 包装器
- 每个 node 文件入口必须调用 `verify_brain_purity()`
- CI 通过 `import-linter` + `scripts/lint_death_line.py` 强制执行
- 违反 Death Line 的 PR 自动拒绝

---

## ADR-002: Four Powers 分层

**状态：** 已生效

| Power | 职责 | 位置 |
|-------|------|------|
| Intent Power | 定义 `AuditableIntent` schema | `@repo/shared-types` |
| Cognition Power | 纯函数推理 Context → Intent + ReasoningLog | `apps/agent-py/src/nodes/` |
| Constraint Power | 宪法拦截器，Hard Rules | `constitution-engine` |
| Execution Power | 平台交互，`IPlatformAgent` | `apps/agent-py/src/platforms/` |

---

## ADR-003: OODA Protocol

**状态：** 已生效

所有推理节点必须输出结构化 `ReasoningLog`：

```
Observe → Orient → Decide → Act
```

- Observe 是唯一可映射 Read-Only skills 的阶段
- 每个 ReasoningLog 写入 `AgentExecutionLog`

---

## ADR-004: 双轨访问模式（Dual-Track）

**状态：** 已生效

所有业务模块同时提供两种访问方式：

1. **REST API** — 供人类前端（`apps/web`、`apps/portal`）调用
2. **MCP Tool** — 供 Agent（内部 Agent 或消费者 Agent）调用

两者共享同一套 Service 层。**禁止出现只有界面没有 API 的功能。**

现有实现：`knowledge-graph-routes.ts` 已暴露 `/products/:id/graph/mcp` 端点。

---

## ADR-005: 媒体文件处理

**状态：** 已生效

消费者上传图片/视频的处理流程：

1. 上传到临时存储（S3/R2，TTL: 24 小时）
2. 立即触发 AI 分析，提取结构化信息
3. 结构化信息（`MediaAnalysis`）持久化存储到数据库
4. 工单关闭后删除原始文件
5. 涉及法律纠纷时延长保留（需管理员标记 `legalHold: true`）

**禁止：** 将原始媒体文件长期存储在数据库或持久对象存储中。

---

## ADR-006: Human-in-the-Loop 控制节点

**状态：** 已生效

以下操作必须有人类确认信号才能执行：

| 操作 | 阈值 | 实现 |
|------|------|------|
| 支付 | 任何金额 | 返回支付链接，消费者自行确认 |
| 退款 | > $50（可配置） | 异步等待 `human_confirmation_token` |
| 个人信息变更 | 任何 | 邮件/短信验证码确认 |
| 销毁商品授权 | 任何 | 管理员审批 |

超时未确认自动取消。Agent 永远不能自主完成支付。

---

## ADR-007: ModelRouter

**状态：** 计划中（Phase 1 实现）

所有 LLM 调用必须通过 `ModelRouter`。

```typescript
// 禁止
const result = await genAI.models.generateContent({ model: "gemini-2.0-flash", ... });

// 正确
const result = await ModelRouter.call(WorkType.SUPPORT_RESPONSE, prompt);
```

- `WorkType` 枚举定义调用类型（`SUPPORT_RESPONSE`、`MEDIA_ANALYSIS`、`FAQ_SEARCH` 等）
- Router 查 `PolicyConfig.ai_integrations` 决定使用哪个模型
- 当前过渡期：`knowledge-graph-routes.ts` 直接调用 GoogleGenAI，需迁移

---

## ADR-008: 知识回写（Knowledge Writeback）

**状态：** 已生效

每次人工处理例外后，系统必须触发回写流程：

```
人工介入 → 解决方案 → KnowledgeBase.writeBack(caseId, resolution, reasoning)
```

- 回写内容：处理逻辑、原因、结果
- 回写到：对应 Product/Market 的知识库（`KnowledgeLayerA`/`KnowledgeLayerB`）
- 目的：Agent 下次遇到相同问题可以自主解决
- 运营知识用 `KnowledgeLayerA/B`，消费者 FAQ 用 `ConsumerFAQ`

---

## ADR-009: 租户隔离

**状态：** 已生效

- 所有数据表包含 `tenantId` 字段
- API 层通过 JWT 中的 `tenantId` 自动注入查询条件
- `buildScopeFilter()` 中间件确保行级隔离
- API 凭证加密存储在租户私有空间
- 系统管理员无法访问租户业务数据

---

## ADR-010: Agent 身份验证（A2A）

**状态：** 计划中（Phase 2）

- 消费者 Agent 调用需持有 OAuth 令牌
- 令牌包含操作范围声明（scope）
- 所有 A2A 操作写入审计日志（`AgentSession.actions`）
- 审计记录：timestamp, agent_id, consumer_id, tool_name, input_hash, output_hash, duration

---

## ADR-011: 品牌客服门户部署

**状态：** 已生效

- `apps/portal` 是独立 Next.js 应用（端口 3100）
- 一个 Tenant 可拥有多个 Brand，每个 Brand 对应一个 `BrandPortalConfig`
- 域名解析链路：`customDomain → BrandPortalConfig → Brand → Tenant`
- 主题系统：CSS 变量 + 主题注册表 + React Context 动态切换
- 已实现 5 个主题：Editorial、Minimal Mono、Tech Neon、Natural Grove、Luxury Noir

---

## ADR-012: Chat 实时通信

**状态：** 已确认（Phase 1 实现）

| 场景 | 协议 | 原因 |
|------|------|------|
| Agent 流式响应 | SSE（Server-Sent Events） | 单向流，实现简单 |
| 人工客服对话 | WebSocket | 双向实时，Phase 2 |

Agent 是第一响应者。当 `agentConfidence < threshold` 时升级到人工。

---

## ADR-013: 消费者身份

**状态：** 已确认（Phase 1 实现）

- 轻量级认证：邮箱 + OTP 验证码
- 无密码，无社交登录（Phase 1）
- JWT 令牌存储消费者身份，短期有效
- `PortalConsumer` 模型独立于运营后台 `User` 模型

---

## ADR-014: Master Data 与 AI 决策层数据隔离

**状态：** 已生效（规范层已生效；Feature Builder / 事件消费层 Phase 2 实现）

本 ADR 定义系统中主数据（Master Data）与 AI 决策层之间的完整隔离策略，是防止系统自我污染、强化错误决策的核心架构保障。

### 核心五原则（不可违反）

1. **AI 永远不读取 Raw Data** — raw 字段（`rawPayload`、`rawPlatformData`、`rawData`）不得出现在任何 AI 可访问的 API 响应中
2. **AI 永远不读取 PENDING 映射** — 所有映射查询必须显式使用 `status = 'APPROVED'`，禁止 `status != 'REJECTED'` 等反向过滤
3. **AI 只读取 APPROVED + 有效版本数据** — 成本版本查询必须包含 `WHERE now() BETWEEN effectiveFrom AND effectiveTo`
4. **主数据变更必须通过事件通知 AI** — AI 不得轮询主数据表，只能通过事件订阅感知变更
5. **AI 不允许写入主数据** — AI 层对所有 MDM 表只读，写入操作通过 Execution Layer 经人类审批执行

### 分层隔离架构

```
外部数据源层（Amazon / ERP / WMS / AMC）
        ↓
Raw Data Lake（原始数据，不可修改）
  rawPayload / rawPlatformData / rawData 字段
        ↓
Identity Resolution（生成 Pending 映射）
  ExternalIdMapping.status = PENDING
        ↓
🔒 数据治理边界（强隔离）
────────────────────────────────────────
        ↓
Master Data Registry（仅 APPROVED 可进入）
  approved_entity_mapping / approved_cost_version DB Views
        ↓
Feature Builder（仅基于已确认实体构建特征）[Phase 2]
  product_feature_daily 及衍生特征表
        ↓
AI Decision Layer（Flywheel / Profit Brain）
  只读，通过 Feature Store 访问数据
        ↓
Execution Layer（平台交互，人类审批）
```

### 隔离点规范

**隔离点 1 — Raw Data 访问禁止**

```typescript
// ❌ 禁止：AI 端点返回含 raw 字段的数据
SELECT *, rawPayload, rawPlatformData FROM ...

// ✅ 正确：AI 专属端点只暴露 approved 视图
SELECT id, entityType, globalId, sourceSystem, externalId, confidenceScore
FROM approved_entity_mapping WHERE tenantId = $tenantId
```

**隔离点 2 — Mapping 状态过滤**

```typescript
// ❌ 绝对禁止（PENDING 会混入）
WHERE mapping.status != 'REJECTED'

// ✅ 唯一正确写法
WHERE mapping.status = 'APPROVED'
  AND (effectiveTo IS NULL OR effectiveTo > now())
```

**隔离点 3 — 成本版本有效时间**

```typescript
// ❌ 禁止：无时间过滤
SELECT * FROM CostVersion WHERE productGlobalId = $id

// ✅ 正确：严格有效时间窗口
SELECT * FROM CostVersion
WHERE productGlobalId = $id
  AND effectiveFrom <= now()
  AND (effectiveTo IS NULL OR effectiveTo > now())
  AND status = 'ACTIVE'
```

**隔离点 4 — 实体冻结机制**

当以下情况发生时，系统必须在特征重建完成前阻止 AI 运行决策：
- `ExternalIdMapping` 状态变为 `REVOKED` 或 `SOFT_REVOKED`
- `CostVersion` 新版本生效
- Product 被标记为废弃

响应链路：
```
entity.mapping.revoked 事件
  → 标记受影响 Product（featureFrozen: true）
  → 暂停该 Product 的广告优化
  → 触发 Feature Builder 重算
  → 重算完成 → 解除冻结 → 恢复 AI 决策
```

### 读写权限隔离

| 层级 | 读权限 | 写权限 |
|------|--------|--------|
| Raw Data 字段 | 仅 Ingestion 服务 | 仅 Ingestion 服务 |
| Master Data 表 | Governance 角色 + AI（通过 approved 视图）| 仅 Governance 角色 |
| Feature Store | Feature Builder + AI | 仅 Feature Builder |
| AI Decision Layer | 只读 Feature Store | 禁止写入任何主数据 |

**AI 层允许调用的端点：**
```
GET /api/masterdata/products?status=active
GET /api/masterdata/mappings?status=APPROVED
GET /api/features/product/{global_id}
```

**AI 层禁止调用的端点：**
```
POST /api/mappings/approve
POST /api/products/create
POST /api/cost-versions
DELETE /api/mappings/:id
```

### 数据质量门控

每个进入 AI 决策链路的特征实体必须携带质量元数据：

```typescript
interface FeatureQualityMeta {
  dataQualityScore: number;      // 0.0–1.0，< 0.7 时跳过优化
  mappingConfidence: number;     // ExternalIdMapping.confidenceScore
  lastVerifiedTime: DateTime;    // 特征最后验证时间
  featureFrozen: boolean;        // 实体冻结中时为 true
}
```

AI 节点决策前必须检查：

```python
if quality_meta.data_quality_score < 0.7:
    return skip_optimization(reason="data_quality_below_threshold")
if quality_meta.feature_frozen:
    return skip_optimization(reason="entity_frozen_pending_rebuild")
```

### Flywheel / Bandit 身份绑定规范

- **Flywheel** 核心 ID 必须使用 `Product_Global_ID`，禁止使用 `ASIN`、`SKU`、`ERP Code`
- **Bandit arm** 必须定义为 `Arm_ID = Listing_Global_ID`，禁止使用 `ASIN`
- 原因：ASIN merge 事件会污染以 ASIN 为 key 的学习历史

### 异常场景防护

| 异常类型 | 触发事件 | 必须执行的操作 |
|---------|---------|--------------|
| Mapping 被 REVOKED | `entity.mapping.revoked` | 冻结实体 → 暂停广告 → 重建特征 → 恢复 |
| 成本版本变更 | `entity.cost.updated` | 失效旧特征 → 重算利润特征 → 通知 AI |
| ASIN merge | `product.updated` (changedFields: asin) | 合并 Bandit 权重 → 重建历史特征 |
| 误映射回滚 | `entity.mapping.revoked` (mode: MANUAL) | 清空受影响 Bandit 权重 → 标记需重新学习 |

### 当前实现状态

| 机制 | 状态 | 位置 |
|------|------|------|
| MappingStatus enum（PENDING/APPROVED/REVOKED）| 已实现 | `schema.prisma` |
| `approved_entity_mapping` DB View | 已实现 | `mdm-mapping-routes.ts` |
| `approved_cost_version` DB View | 已实现 | `mdm-asset-routes.ts` |
| `CostVersion.effectiveFrom/To` 字段 | 已实现 | `schema.prisma` |
| `MappingHistory` 审计链 | 已实现 | `schema.prisma` |
| MDM 事件类型定义 | 已实现 | `mdm-events.ts` |
| Death Line（AI 禁止写数据库）| 已实现 | `_shared.py` + `lint_death_line.py` |
| Feature Builder / Feature Store | **未实现** | Phase 2 |
| 事件消费端（agent-py 订阅）| **未实现** | Phase 2 |
| `dataQualityScore` / `lastVerifiedTime` 字段 | **未实现** | Phase 2 |
| 实体冻结机制 | **未实现** | Phase 2 |
| Mapping 回滚 API | **未实现** | Phase 2 |
| 持久化事件总线（Kafka/Redis）| **未实现** | Phase 2 |

---

## 文件结构概览

```
codexAIecom_0228/
├── apps/
│   ├── web/           # 运营后台（Next.js 15, port 3000）
│   ├── portal/        # 品牌客服门户（Next.js 15, port 3100）
│   ├── api/           # Hono API 服务（port 4000）
│   └── agent-py/      # LangGraph Agent 运行时（Python）
├── packages/
│   ├── database/      # Prisma schema + migrations
│   ├── shared-types/  # 共享 TypeScript 类型
│   └── ui/            # 共享 UI 组件
├── scripts/           # CI/lint 脚本
├── docs/
│   ├── brainstorms/   # 脑暴文档
│   └── plans/         # 实施计划
├── PROJECT.md         # 项目身份（本文件系列）
├── ARCHITECTURE.md    # 架构决策（本文件）
├── DOMAIN_MODEL.md    # 域模型
├── MCP_SPEC.md        # MCP 接口规范
└── AI_CODING_RULES.md # AI 编码规范
```
