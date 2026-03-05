# AI 编码规则

本文件是 Cursor / Claude Code / Codex 的强制编码规范。
**每次生成代码前必须对照本文件检查。**

---

## 前置检查清单

每次实现新功能前，逐项确认：

- [ ] **双轨实现？** 这个功能是否同时实现了 UI 和 MCP Tool？如果只有 UI 没有 MCP → 不完整
- [ ] **ModelRouter？** LLM 调用是否通过 ModelRouter？禁止直接写模型名称
- [ ] **媒体处理？** 是否只提取结构化信息，不长期存储原始文件？
- [ ] **Human Gate？** 支付/退款/敏感操作是否有人类确认节点？
- [ ] **知识回写？** 人工例外处理后是否触发 `KnowledgeBase.writeBack()`？
- [ ] **审计日志？** A2A/MCP 操作是否写入审计日志？
- [ ] **租户隔离？** 查询是否包含 `tenantId` 过滤？
- [ ] **Death Line？** Cognition 层代码是否调用了 `verify_brain_purity()`？
- [ ] **Raw 字段屏蔽？** AI 可访问端点是否过滤了 `rawPayload` / `rawPlatformData` / `rawData`？
- [ ] **数据质量门控？** 决策前是否检查 `dataQualityScore >= 0.7` 且 `featureFrozen = false`？

---

## 1. LLM 调用规范

```typescript
// ❌ 禁止：直接写模型名称
const result = await genAI.models.generateContent({
  model: "gemini-2.0-flash",
  contents: prompt,
});

// ✅ 正确：通过 ModelRouter
const result = await ModelRouter.call(WorkType.SUPPORT_RESPONSE, prompt);
```

`WorkType` 枚举值：

| WorkType | 用途 |
|----------|------|
| `SUPPORT_RESPONSE` | 客服对话回复 |
| `MEDIA_ANALYSIS` | 图片/视频分析 |
| `FAQ_SEARCH` | FAQ 语义搜索 |
| `KNOWLEDGE_GRAPH` | PKG 生成 |
| `SENTIMENT_ANALYSIS` | 情感分析 |
| `CONTENT_LOCALIZATION` | 内容本地化 |

ModelRouter 查 `PolicyConfig.ai_integrations` 决定实际模型。

---

## 2. 媒体文件处理规范

```typescript
// ❌ 禁止：持久化存储原始文件
await storage.save(uploadedImage);
await prisma.media.create({ data: { blob: fileBuffer } });

// ✅ 正确：分析后丢弃
const analysis = await MediaProcessor.analyzeAndDiscard(uploadedFile);
await prisma.mediaAnalysis.create({
  data: {
    sourceType: 'image',
    analysisResult: analysis.structured,
    originalFileRef: analysis.tempRef,  // TTL 24h
  },
});
```

流程：上传 → 临时存储（TTL 24h）→ AI 分析 → 持久化结构化结果 → 工单关闭后删除原始文件

---

## 3. Human Gate 规范

```typescript
// ❌ 禁止：Agent 自主完成支付
await PaymentService.charge(amount);

// ✅ 正确：返回支付链接
return { payment_url: generatePaymentLink(orderId, amount), expires_at: ... };

// ❌ 禁止：Agent 自主退款
await RefundService.process(caseId, amount);

// ✅ 正确：超阈值需人类确认
if (amount > refundThreshold) {
  return {
    requires_human_confirmation: true,
    confirmation_request_id: await createConfirmationRequest(caseId, amount),
  };
}
```

必须有 Human Gate 的操作：
- 支付（任何金额）
- 退款（超 $50，可配置）
- 个人信息变更
- 销毁商品授权

---

## 4. 知识回写规范

```typescript
// 每个人工介入的 handler 结尾必须包含：
async function handleHumanResolution(caseId: string, resolution: Resolution) {
  await prisma.supportCase.update({
    where: { id: caseId },
    data: { resolution: resolution.summary, status: 'resolved' },
  });

  // ⚠️ 必须：触发知识回写
  await KnowledgeBase.writeBack(caseId, resolution.summary, resolution.reasoning);
}
```

回写目标：
- 运营知识 → `KnowledgeLayerA` / `KnowledgeLayerB`
- 消费者 FAQ → `ConsumerFAQ`（如果适用）

---

## 5. 租户隔离规范

```typescript
// ❌ 禁止：无租户过滤的查询
const cases = await prisma.supportCase.findMany();

// ✅ 正确：始终包含 tenantId
const cases = await prisma.supportCase.findMany({
  where: { tenantId: auth.tenantId },
});
```

- 运营后台 API：通过 `extractUser` 中间件从 JWT 提取 `tenantId`
- 门户 API：通过域名 → `BrandPortalConfig` → `Brand.tenantId` 解析
- 所有 `findMany`/`findFirst`/`update`/`delete` 必须包含 `tenantId`

---

## 6. 认证与授权规范

### 运营后台（apps/web → apps/api）
```typescript
// 使用已有中间件链
app.use('/api/*', extractUser);
app.use('/api/*', validateScope);

// 角色检查
app.get('/admin/*', requireRole('tenant_admin'));
```

### 门户（apps/portal → apps/api）
```typescript
// 公开端点：无需认证
app.get('/portal/resolve', ...);
app.get('/portal/commodities/:id', ...);

// 消费者端点：JWT 认证
app.use('/portal/me', portalAuth);
app.use('/portal/warranties/*', portalAuth);
app.use('/portal/cases/*', portalAuth);
```

消费者 JWT payload：
```typescript
interface PortalJWTPayload {
  consumerId: string;
  brandId: string;
  tenantId: string;
  email: string;
}
```

---

## 7. API 路由规范

### 路由文件组织
```
apps/api/src/
├── portal-routes.ts       # 门户公开 API
├── portal-auth.ts         # 门户认证（OTP）
├── portal-agent.ts        # 门户 AI Chat / Agent
├── portal-media.ts        # 门户媒体上传与分析
├── mdm-primitives-routes.ts  # MDM 基础数据（已有）
├── mdm-asset-routes.ts       # MDM 资产（已有）
├── mdm-content-routes.ts     # MDM 内容（已有）
└── knowledge-graph-routes.ts  # PKG（已有）
```

### 路由注册
```typescript
// 在 server.ts 中注册
app.route('/portal', portalRoutes);
app.route('/portal/auth', portalAuthRoutes);
app.route('/portal/agent', portalAgentRoutes);
app.route('/portal/media', portalMediaRoutes);
```

---

## 8. 错误处理规范

A2A 通信的错误必须区分三种类型：

```typescript
// Agent 调用错误 — 消费者 Agent 可自行处理
throw new AgentError('INVALID_SERIAL', 'Serial number format invalid', {
  expected_format: 'XX-XXXX-XXXX',
});

// 需要人类介入 — 附带联系方式
throw new HumanRequiredError('COMPLEX_WARRANTY_DISPUTE', 'This case requires human review', {
  contact_email: portalConfig.supportEmail,
  estimated_response: '24h',
});

// 系统内部错误 — 记录日志，返回通用信息
throw new SystemError('DB_TIMEOUT', 'Service temporarily unavailable');
```

---

## 9. 命名规范

| 上下文 | 规范 | 示例 |
|--------|------|------|
| MCP Tool 方法 | `snake_case` 动词_名词 | `create_support_case` |
| Service 方法 | `camelCase` 动词 | `createSupportCase` |
| API 路由 | `kebab-case` | `/portal/qr-scan` |
| 人类控制节点 | 必须包含 `HumanGate` 或 `RequiresConfirmation` | `refundHumanGate()` |
| Prisma 模型 | `PascalCase` | `SupportCase` |
| CSS 变量（运营后台） | `--token-name` | `var(--accent)` |
| CSS 变量（门户） | `--portal-token-name` | `var(--portal-accent)` |

---

## 10. 前端规范

### 运营后台（apps/web）
- 严格遵循 `ui-design-system.mdc` 中的 CSS 变量规范
- 颜色只用 `var(--token)`，禁止硬编码 `#hex` 或 `rgba()`
- 圆角用 `var(--border-radius-*)`，阴影用 `var(--panel-shadow)`

### 门户（apps/portal）
- 使用 `--portal-*` 命名空间的 CSS 变量
- 主题通过 `PortalThemeProvider` + CSS class 切换
- 新增 CSS 变量必须在所有 5 个主题文件中定义
- 字体通过 `googleFontsUrl` 动态加载，禁止在 layout 中硬编码 `<link>`

---

## 11. 测试要求

每个 MCP Tool 必须有：

1. **正常 Agent 调用测试** — 验证正确输入返回正确输出
2. **越权操作被拒绝测试** — 验证无权限/跨租户被拒绝
3. **需要人类确认场景测试** — 验证超阈值操作返回 `requires_human_confirmation`
4. **审计日志写入测试** — 验证调用记录写入审计表

---

## 12. Death Line 规范（Agent 运行时）

```python
# apps/agent-py/src/nodes/ 下的每个文件必须：
from ._shared import verify_brain_purity
verify_brain_purity()

# 禁止导入：
import psycopg2          # ❌ 数据库客户端
import boto3              # ❌ 平台 SDK
from ..platforms import   # ❌ 执行层模块
```

CI 通过 `scripts/lint_death_line.py` 和 `import-linter` 强制执行。

---

## 13. 违规修正协议

当 AI 生成了违反本文件规则的代码时：

1. 识别违反了哪条规则
2. 修正代码
3. **更新本文件**：在对应规则下添加"常见违规"示例，防止下次重犯

```markdown
### 常见违规（持续更新）
- 2026-03-xx: 在 portal-agent.ts 中直接调用 gemini-2.0-flash → 已修正为 ModelRouter
- 2026-03-xx: SupportCase 查询缺少 tenantId → 已添加租户过滤
```

---

## 14. Master Data 隔离规范

### Mapping 状态过滤

```typescript
// ❌ 绝对禁止：反向过滤导致 PENDING 混入
WHERE mapping.status != 'REJECTED'

// ✅ 唯一正确写法：显式 APPROVED + 有效时间
WHERE mapping.status = 'APPROVED'
  AND (effectiveTo IS NULL OR effectiveTo > now())
```

### 成本版本有效时间查询

```typescript
// ❌ 禁止：无时间窗口查询，历史成本会污染当前利润计算
const cost = await prisma.costVersion.findFirst({
  where: { productGlobalId: id },
});

// ✅ 正确：严格有效时间窗口
const cost = await prisma.costVersion.findFirst({
  where: {
    productGlobalId: id,
    status: 'ACTIVE',
    effectiveFrom: { lte: new Date() },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
  },
  orderBy: { effectiveFrom: 'desc' },
});
```

### AI 端点 raw 字段屏蔽

```typescript
// ❌ 禁止：AI 端点返回含 raw 字段的响应
const listing = await prisma.listing.findFirst({ where: { id } });
// rawPlatformData 泄露给 AI

// ✅ 正确：AI 专属端点只暴露 approved 视图，显式排除 raw 字段
const listing = await prisma.listing.findFirst({
  where: { id, tenantId },
  select: {
    id: true, tenantId: true, commodityId: true, platformId: true,
    externalListingId: true, title: true, isPrimary: true,
    status: true, mappingStatus: true, createdAt: true, updatedAt: true,
    // rawPlatformData 显式不出现在 select 中
  },
});
```

### 数据质量门控

```typescript
// ❌ 禁止：AI 直接使用未检查质量的产品数据进行决策
await runOptimization(product);

// ✅ 正确：决策前检查质量元数据
if (!product.dataQualityScore || product.dataQualityScore < 0.7) {
  return { skipped: true, reason: 'data_quality_below_threshold' };
}
if (product.featureFrozen) {
  return { skipped: true, reason: product.featureFrozenReason ?? 'entity_frozen' };
}
await runOptimization(product);
```

---

## 15. Flywheel / Bandit 身份绑定规范

### 核心规则

- **Flywheel** 核心 ID 必须使用 `Product_Global_ID`（`Product.id`），禁止使用 `ASIN`、`SKU`、`ERP Code`
- **Bandit arm** 必须定义为 `Arm_ID = Listing_Global_ID`（`Listing.id`），禁止使用 `ASIN`

### 原因

ASIN 是平台级外部 ID，同一物理产品可能在 Amazon 上有多个 ASIN，且 ASIN 可发生 merge/split。以 ASIN 为 key 会导致：
- 跨平台数据污染（同一产品在 Amazon US / Amazon JP 的 ASIN 不同）
- ASIN merge 事件打乱 Bandit 学习历史，无法恢复

### 常见违规

```typescript
// ❌ 禁止：以 ASIN 为 Flywheel key
const flywheelData = await getFlywheelData(product.asin);

// ✅ 正确：以 Product_Global_ID 为 key
const flywheelData = await getFlywheelData(product.id);

// ❌ 禁止：以 ASIN 为 Bandit arm
const arm = `arm:${listing.externalListingId}`; // externalListingId 是 ASIN

// ✅ 正确：以 Listing.id（内部全局 ID）为 arm
const arm = `arm:${listing.id}`;
```

---

## 16. entity_hash 规范（Phase 0 Feature Store）

### 格式

```
{entityType}:{globalId}
```

`entityType` 只允许：`listing` | `product` | `campaign`

### 必须使用工具函数

```typescript
import { buildEntityHash, assertEntityHash } from './entity-hash.js';

// ✅ 正确：写入 DecisionLog / RewardLog / Bandit arm
const hash = buildEntityHash('product', product.id);

// ✅ 正确：从外部入参写入前校验
assertEntityHash(req.entityHash); // 不合法时抛出 Error
```

### 禁止使用外部 ID 作为 key

```typescript
// ❌ 禁止：以 ASIN 作为 entityHash key 部分
const hash = `product:${product.asin}`;

// ❌ 禁止：以 SKU 作为 entityHash key 部分
const hash = `listing:${listing.externalListingId}`;

// ❌ 禁止：以 ERP Code 作为 entityHash key 部分
const hash = `product:${product.erpCode}`;
```

### 原因

- ASIN / SKU / ERP Code 是平台级外部 ID，会随 merge/split 变化
- 以外部 ID 为 key 会导致 Bandit 学习历史污染，且不可恢复
- 只有内部 `Product.id` / `Listing.id`（UUID）是稳定的跨平台身份

### Phase 0 写入范围

所有以下场景必须使用 `buildEntityHash()`：
- `POST /features/decision` → `entityHash`
- `POST /features/reward` → `entityHash`
- Bandit arm ID
- RL replay key（Phase 2）

---

## 启动 Prompt 模板

每次开始新功能时使用：

```
请阅读以下文件后再开始编码：
- PROJECT.md（项目原则）
- ARCHITECTURE.md（架构决策）
- DOMAIN_MODEL.md（数据模型）
- MCP_SPEC.md（A2A 接口规范）
- AI_CODING_RULES.md（编码规则）

现在需要实现：[功能描述]

检查清单（实现前确认）：
□ 是否同时实现 UI 和 MCP Tool？
□ LLM 调用是否通过 ModelRouter？
□ 媒体文件是否只提取信息不长期存储？
□ 支付/退款是否有人类确认节点？
□ 人工例外处理后是否触发知识回写？
□ A2A 操作是否写入审计日志？
□ 查询是否包含租户隔离？
□ Death Line 是否完整？
```
