# Phase 0 实施总结文档

**版本：** Phase 0 — 极简 Snapshot 层
**日期：** 2026-03-04
**状态：** 已完成，`prisma validate` + `tsc --noEmit` 零错误

---

## 一、实施背景

系统当前处于架构构建阶段：Amazon Ads 未完整接入、Bandit 未上线、无真实多市场数据沉淀。在此阶段引入完整 Feature Builder 微服务属于过早抽象，会导致 90% 字段为 mock、聚合逻辑反复重写。

Phase 0 的核心原则：

> **"让系统真正开始跑起来"，而不是"构建完美架构"**

Phase 0 只做：`product_feature_snapshot` 扩展 + `decision_log` + `reward_log` + `entity_hash` 规范。
Phase 0 明确不做：Feature Builder 微服务、feature_registry、双轨 store、时间窗口聚合、drift detection。

---

## 二、变更清单

### 2.1 数据库 Schema（`packages/database/prisma/schema.prisma`）

#### `ProductFeatureSnapshot` 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `market` | `String?` | 市场标识，如 `US` / `JP` |
| `platform` | `String?` | 平台标识，如 `amazon` / `shopify` |
| `featureJson` | `Json?` | 灵活特征载体（JSONB），数据未成熟时避免频繁 schema 变更 |
| `writtenBy` | `String?` | 写入方标识：`profit_brain` / `mock_bandit` / `ads_module` |

> **Phase 0 多市场限制（重要）：** 当前唯一约束为 `(tenantId, productGlobalId, snapshotDate)`，**不含 `market` / `platform`**。
> 这意味着同一产品同一天只能保存一条快照记录——写入 US 数据后再写入 JP 数据，后者会覆盖前者，**多市场并存在 Phase 0 不支持**。
>
> `market` / `platform` 字段在 Phase 0 仅用于查询过滤（读时区分），不用于写入唯一性保障。
>
> **Phase 1 升级时**需将唯一约束修改为 `(tenantId, productGlobalId, snapshotDate, market, platform)` 以支持真正的多市场并存。

新增索引：
```prisma
@@index([tenantId, market, platform, snapshotDate(sort: Desc)])
```

#### 新增 `DecisionLog` 模型

记录 AI 每次决策的完整上下文，为 Bandit v1 和未来 RL 提供决策历史。

```prisma
model DecisionLog {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  entityHash      String                      // 格式：{entityType}:{globalId}
  entityType      String                      // "listing" | "product" | "campaign"
  agentId         String                      // 决策 agent 标识
  decisionType    String                      // "bid_adjust" | "price_adjust" | "pause"
  inputFeatures   Json?                       // 决策时读取的特征快照
  outputAction    Json                        // 输出动作（必填）
  confidenceScore Float?
  decidedAt       DateTime @default(now())
  tenant          Tenant   @relation(...)

  @@index([tenantId, entityHash, decidedAt(sort: Desc)])
  @@index([tenantId, agentId, decidedAt])
  @@index([tenantId, decisionType, decidedAt])
}
```

#### 新增 `RewardLog` 模型

记录决策产生的奖励信号，支持延迟归因（`decisionLogId` 可为 null）。

```prisma
model RewardLog {
  id                     String   @id @default(uuid()) @db.Uuid
  tenantId               String   @db.Uuid
  decisionLogId          String?  @db.Uuid   // 延迟归因时为 null
  entityHash             String
  rewardType             String              // "sales_lift" | "acos_drop" | "profit_delta"
  rewardValue            Float
  observedAt             DateTime
  attributionWindowHours Int      @default(24)
  rawSignal              Json?
  createdAt              DateTime @default(now())
  tenant                 Tenant   @relation(...)

  @@index([tenantId, entityHash, observedAt(sort: Desc)])
  @@index([tenantId, decisionLogId])
  @@index([tenantId, rewardType, observedAt])
}
```

#### `Tenant` 模型新增 Relations

```prisma
decisionLogs  DecisionLog[]
rewardLogs    RewardLog[]
```

---

### 2.2 新增文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `apps/api/src/entity-hash.ts` | 新建 | entity_hash 规范工具函数 |
| `apps/api/src/feature-routes.ts` | 新建（本轮重写） | Feature Store API 路由 |
| `apps/api/src/mdm-isolation-handler.ts` | 新建 | MDM 事件隔离响应处理器 |

---

### 2.3 修改文件

| 文件 | 变更摘要 |
|------|---------|
| `packages/database/prisma/schema.prisma` | ProductFeatureSnapshot 扩展 4 字段；新增 DecisionLog、RewardLog；Tenant 加两个 relation |
| `apps/api/src/server.ts` | 注册 `/features` 路由；注册 `MdmIsolationHandler` 事件处理器；引入新 import |
| `apps/api/src/mdm-events.ts` | 新增 `MasterDataEventHandler` 接口契约；新增 `registerMasterDataHandlers` 工具函数 |
| `apps/api/src/mdm-mapping-routes.ts` | 新增 `POST /mdm/mappings/:id/rollback` 端点；`GET /mdm/mappings` 屏蔽 `rawPayload` / `candidatePayload` |
| `apps/api/src/mdm-asset-routes.ts` | `GET /mdm/listings`、`GET /mdm/listings/unmapped`、`GET /mdm/sku-mappings` 改用显式 `select`，屏蔽 raw 字段 |
| `apps/agent-py/src/nodes/validate_freshness.py` | 新增数据质量门控逻辑（`dataQualityScore < 0.7` → SKIP；`featureFrozen` → SKIP） |
| `AI_CODING_RULES.md` | 新增 §14 Master Data 隔离规范、§15 Flywheel/Bandit 身份绑定规范、§16 entity_hash 规范 |
| `scripts/lint_death_line.py` | 新增 Rule 3（warning 级）：检出 ASIN/SKU/ERP Code 作为 dict key 的用法 |
| `ARCHITECTURE.md` | 新增 ADR-014：Master Data 与 AI 决策层数据隔离 |

---

## 三、API 文档

**Base URL：** `/features`
**认证：** Header `x-tenant-id: {tenantId}` 或 query `?tenantId={tenantId}`（所有端点必须）

---

### 3.1 写入产品特征快照

```
POST /features/product/:globalId/snapshot
```

**Path Params：**
- `globalId` — `Product.id`（内部 UUID，非 ASIN）

**Request Body：**

```json
{
  "snapshotDate": "2026-03-04",          // 必填，ISO date
  "dataQualityScore": 0.85,              // 必填，0.0–1.0
  "mappingConfidence": 0.92,             // 必填，0.0–1.0
  "totalSales": 12500.00,                // 选填
  "totalAdSpend": 1800.00,               // 选填
  "profit": 3200.00,                     // 选填
  "inventory": 240,                      // 选填
  "acos": 0.144,                         // 选填
  "roas": 6.94,                          // 选填
  "market": "US",                        // 选填
  "platform": "amazon",                  // 选填
  "featureJson": {                       // 选填，灵活特征载体
    "category_rank": 142,
    "review_score": 4.7,
    "competitor_price_gap": -0.08
  },
  "writtenBy": "profit_brain",           // 选填，写入方标识
  "sourceMapping": "mapping-uuid-..."   // 选填
}
```

**Response 201：**

```json
{
  "snapshot": {
    "id": "uuid",
    "tenantId": "uuid",
    "productGlobalId": "uuid",
    "snapshotDate": "2026-03-04T00:00:00.000Z",
    "dataQualityScore": 0.85,
    ...
  }
}
```

**注意：** 同一 `(tenantId, productGlobalId, snapshotDate)` 组合执行 upsert；写入时同步更新 `Product.dataQualityScore` 和 `Product.lastVerifiedAt`。

---

### 3.2 读取产品特征快照

```
GET /features/product/:globalId/latest?days=30&market=US&platform=amazon
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `days` | number | 30 | 查询最近 N 天，最大 90 |
| `market` | string | — | 过滤市场，如 `US` |
| `platform` | string | — | 过滤平台，如 `amazon` |

**过滤规则：** 只返回 `dataQualityScore >= 0.7` 的快照（低质量数据不暴露给 AI）。

**租户隔离：** 查询在包含 `SET LOCAL app.tenant_id` 的事务中执行，同时在应用层 `WHERE tenantId = ?` 过滤，双重保障防止跨租户泄漏。

**Response 200：**

```json
{
  "productGlobalId": "uuid",
  "days": 30,
  "market": "US",
  "platform": "amazon",
  "count": 28,
  "snapshots": [
    {
      "id": "uuid",
      "snapshotDate": "2026-03-04T00:00:00.000Z",
      "totalSales": "12500.00",
      "totalAdSpend": "1800.00",
      "profit": "3200.00",
      "inventory": 240,
      "acos": "0.1440",
      "roas": "6.9400",
      "dataQualityScore": 0.85,
      "mappingConfidence": 0.92,
      "market": "US",
      "platform": "amazon",
      "featureJson": { ... },
      "writtenBy": "profit_brain",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### 3.3 写入决策日志

```
POST /features/decision
```

**Request Body：**

```json
{
  "entityType": "product",               // 必填："listing" | "product" | "campaign"
  "globalId": "uuid",                    // 必填：Product.id / Listing.id（内部 UUID）
  "agentId": "profit-brain-v1",          // 必填
  "decisionType": "bid_adjust",          // 必填："bid_adjust" | "price_adjust" | "pause"
  "outputAction": {                      // 必填
    "bidChangePercent": 0.12,
    "newBid": 1.45
  },
  "inputFeatures": {                     // 选填，决策时读取的特征快照
    "acos_7d": 0.18,
    "profit_30d": 3200
  },
  "confidenceScore": 0.78               // 选填
}
```

**Response 201：**

```json
{
  "decision": {
    "id": "uuid",
    "entityHash": "product:uuid",        // 自动构建，格式 {entityType}:{globalId}
    "entityType": "product",
    "agentId": "profit-brain-v1",
    "decisionType": "bid_adjust",
    "outputAction": { ... },
    "decidedAt": "2026-03-04T10:00:00.000Z"
  }
}
```

**校验规则：** `entityHash` 由系统内部通过 `buildEntityHash()` 构建，调用方只需传 `entityType` + `globalId`；禁止传入 ASIN / SKU / ERP Code 作为 `globalId`。

---

### 3.4 写入奖励信号

```
POST /features/reward
```

**Request Body：**

```json
{
  "entityHash": "product:uuid",          // 必填，格式 {entityType}:{globalId}
  "rewardType": "acos_drop",             // 必填："sales_lift"|"acos_drop"|"profit_delta"
  "rewardValue": 0.034,                  // 必填，奖励值（可负）
  "observedAt": "2026-03-04T12:00:00Z", // 必填，实际观测时间
  "decisionLogId": "uuid",              // 选填，延迟归因时可为 null
  "attributionWindowHours": 24,          // 选填，默认 24
  "rawSignal": {                         // 选填，原始信号
    "acos_before": 0.18,
    "acos_after": 0.146
  }
}
```

**Response 201：**

```json
{
  "reward": {
    "id": "uuid",
    "entityHash": "product:uuid",
    "rewardType": "acos_drop",
    "rewardValue": 0.034,
    "observedAt": "2026-03-04T12:00:00.000Z",
    "attributionWindowHours": 24,
    "createdAt": "..."
  }
}
```

**校验规则：** 写入前执行 `assertEntityHash()` 校验，格式不合法（包括传入 ASIN）返回 400。

---

### 3.5 Mapping 回滚（隔离保护端点）

```
POST /mdm/mappings/:id/rollback
```

**权限：** `tenant_admin` 或 `system_admin`

**Request Body：**

```json
{
  "reason": "误映射高销量产品到错误 Product，需要回滚"
}
```

**Response 200：**

```json
{
  "status": "ROLLED_BACK",
  "item": { ... },
  "affectedGlobalId": "uuid"
}
```

**行为：** 将 Mapping 状态设为 `REVOKED`，写入 `MappingHistory`（action: `ROLLBACK`），并发出 `entity.mapping.revoked` 事件，触发 `MdmIsolationHandler.onMappingRevoked()` 自动冻结关联 Product。

---

## 四、entity_hash 规范

### 格式

```
{entityType}:{uuid}
```

`entityType` 枚举：`listing` | `product` | `campaign`

`uuid` 必须是合法的 UUID 格式（正则 `/^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i`）。`buildEntityHash()` 和 `assertEntityHash()` 均执行 UUID 格式校验——传入 ASIN（如 `B01NABCD123`）、SKU、ERP Code 等非 UUID 字符串将直接抛出 `Error`，返回 HTTP 400。

### 工具函数（`apps/api/src/entity-hash.ts`）

```typescript
import { buildEntityHash, parseEntityHash, assertEntityHash } from './entity-hash.js';

// 构建
const hash = buildEntityHash('product', product.id);
// → "product:550e8400-e29b-41d4-a716-446655440000"

// 解析
const parsed = parseEntityHash('product:uuid');
// → { entityType: 'product', globalId: 'uuid' } | null

// 校验（不合法时抛出 Error）
assertEntityHash(req.entityHash);
```

### 禁止使用外部 ID

```typescript
// ❌ 禁止
buildEntityHash('product', product.asin)
buildEntityHash('listing', listing.externalListingId)

// ✅ 正确
buildEntityHash('product', product.id)
buildEntityHash('listing', listing.id)
```

---

## 五、事件隔离机制（`MdmIsolationHandler`）

服务启动时通过 `registerMasterDataHandlers(new MdmIsolationHandler(prisma))` 自动注册，响应三类主数据变更事件：

| 事件 | 触发条件 | 自动执行 |
|------|---------|---------|
| `entity.mapping.revoked` | Mapping 被撤销（含 rollback） | Product 设 `featureFrozen=true`, `featureFrozenReason='mapping_revoked'`；写入 `SecurityAuditEvent` |
| `entity.cost.updated` | 成本版本变更 | 将该产品所有 `productFeatureSnapshot.dataQualityScore` 清零，触发重算；写入 `SecurityAuditEvent` |
| `product.updated` (asin 变更) | ASIN merge/split | Product 设 `featureFrozen=true`, `featureFrozenReason='asin_changed'`；写入 `SecurityAuditEvent` |

### 数据质量门控（`validate_freshness.py`）

AI 推理节点在 `validate_freshness_node` 阶段检查：

```python
DATA_QUALITY_THRESHOLD = 0.7

if data_quality_score < DATA_QUALITY_THRESHOLD:
    return { "outcome": { "status": "SKIPPED_LOW_QUALITY", ... } }

if feature_frozen:
    return { "outcome": { "status": "SKIPPED_ENTITY_FROZEN", ... } }
```

---

## 六、迁移指南

### 6.1 数据库迁移

> 当数据库连接可用时，执行：

```bash
cd /path/to/project
npx prisma migrate dev \
  --schema packages/database/prisma/schema.prisma \
  --name "phase0_feature_store_decision_reward_logs"
```

迁移将创建：
- `ProductFeatureSnapshot` 表新增 4 列（`market`, `platform`, `feature_json`, `written_by`）及新索引
- 新增 `DecisionLog` 表
- 新增 `RewardLog` 表

**回滚（如需）：**

> ⚠️ 不要使用 `--to-empty`，那会生成 Drop 所有表的 SQL，导致全库数据丢失。
>
> 正确做法是手动编写精确反向 DDL，仅回滚 Phase 0 引入的变更：

```sql
-- Phase 0 精确回滚脚本（仅删除本次新增内容，不影响其他表）

-- 1. 删除 RewardLog 表
DROP TABLE IF EXISTS "RewardLog";

-- 2. 删除 DecisionLog 表
DROP TABLE IF EXISTS "DecisionLog";

-- 3. 移除 ProductFeatureSnapshot 新增的 4 列
ALTER TABLE "ProductFeatureSnapshot"
  DROP COLUMN IF EXISTS "market",
  DROP COLUMN IF EXISTS "platform",
  DROP COLUMN IF EXISTS "featureJson",
  DROP COLUMN IF EXISTS "writtenBy";

-- 4. 删除新增索引
DROP INDEX IF EXISTS "ProductFeatureSnapshot_tenantId_market_platform_snapshotDate_idx";
```

执行前务必在非生产环境验证，并确认已备份数据库。

### 6.2 调用方接入指南

**Profit Brain / Ads Module 写入特征快照：**

```typescript
// 每天结束时写入当日特征
await fetch('/features/product/{productGlobalId}/snapshot', {
  method: 'POST',
  headers: { 'x-tenant-id': tenantId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    snapshotDate: '2026-03-04',
    dataQualityScore: 0.85,
    mappingConfidence: 0.92,
    market: 'US',
    platform: 'amazon',
    totalSales: 12500,
    totalAdSpend: 1800,
    profit: 3200,
    featureJson: { category_rank: 142, review_score: 4.7 },
    writtenBy: 'profit_brain',
  }),
});
```

**AI Agent 写入决策：**

```typescript
import { buildEntityHash } from './entity-hash.js';

// 先构建 hash，再调用 API
// feature-routes 会在内部重新 build，只需传 entityType + globalId
await fetch('/features/decision', {
  method: 'POST',
  headers: { 'x-tenant-id': tenantId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'product',
    globalId: product.id,      // Product.id（UUID），禁止传 ASIN
    agentId: 'profit-brain-v1',
    decisionType: 'bid_adjust',
    outputAction: { bidChangePercent: 0.12, newBid: 1.45 },
    inputFeatures: { acos_7d: 0.18, profit_30d: 3200 },
    confidenceScore: 0.78,
  }),
});
```

**写入奖励信号（观测到效果后）：**

```typescript
import { buildEntityHash } from './entity-hash.js';

const entityHash = buildEntityHash('product', product.id);

await fetch('/features/reward', {
  method: 'POST',
  headers: { 'x-tenant-id': tenantId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityHash,
    rewardType: 'acos_drop',
    rewardValue: 0.034,
    observedAt: new Date().toISOString(),
    decisionLogId: previousDecisionId,  // 可选，有则传
    attributionWindowHours: 24,
  }),
});
```

### 6.3 lint 检查接入

CI 中已有 `python3 scripts/lint_death_line.py`，本次新增 Rule 3 为 **warning 级（非阻断）**，ASIN-as-key 被检出时输出黄色警告但不阻断构建。

如需将 Rule 3 升级为阻断，在 `lint_death_line.py` 中将 warning 计入 `total_errors` 即可。

---

## 七、Phase 1 升级触发条件

满足以下**全部**条件后再推进 Phase 1：

- [ ] Amazon Ads API 真实接入并稳定运行
- [ ] `product_feature_snapshot` 累计 ≥ 30 天真实数据
- [ ] 能计算真实 7d / 30d 聚合指标（ACOS、利润、GMV）
- [ ] Bandit v1 准备上线，需要稳定在线特征

Phase 1 将引入：`feature_registry`、按 `market`/`platform` 分区的 online feature 表、简单 offline 聚合表。

---

## 八、验收记录

| 检查项 | 结果 | 时间 |
|--------|------|------|
| `prisma validate` | 通过 | 2026-03-04 |
| `prisma generate` | 通过 | 2026-03-04 |
| `tsc --noEmit` (apps/api) | 零错误 | 2026-03-04 |
| ASIN-as-key lint 检出 | 正确触发 warning | 2026-03-04 |
| 存量违规 `support_tools.py` (httpx) | 预存在，非本次引入 | — |
