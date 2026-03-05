---
date: 2026-03-02
topic: brand-portal-phase1
depends-on:
  - ../brainstorms/2026-03-02-brand-support-portal-brainstorm.md
status: completed
---

# 品牌客服门户 Phase 1 实施计划

## Overview

将 `apps/portal` 从纯前端演示（mock 数据 + 主题系统）升级为功能完整的品牌客服门户，包含：商品详情页、质保注册、AI Chat 客服（含媒体分析）、二维码追踪、说明书/FAQ、购买渠道展示。

### 当前状态

| 层 | 状态 | 说明 |
|----|------|------|
| Portal 前端 | ✅ 已有 | 4 个屏幕 + 5 套主题，全 mock 数据 |
| Portal API | ❌ 未实现 | 无面向消费者的路由 |
| Prisma 模型 | ❌ 未定义 | 无 WarrantyRegistration / SupportCase / PortalConsumer 等 |
| 实时通信 | ❌ 未实现 | 无 SSE / WebSocket |
| 媒体处理 | ❌ 未实现 | 无上传 / AI 分析 |

### 目标状态

消费者扫描商品包装上的二维码 → 进入品牌门户 → 查看商品信息 → 注册质保 → 与 AI Agent 对话解决问题 → 必要时升级人工。

### 核心约束

- 复用现有 Product × Market = Commodity 模型，不建冗余
- Agent 是第一响应者（Harness Engineering）
- 存信息不存文件（媒体 AI 分析后删除原始文件）
- 每个功能同时提供 UI + API（双轨访问，为 Phase 2 A2A 做准备）
- 一个租户多个品牌，每个品牌独立门户

---

## Sprint 划分

| Sprint | 周期 | 内容 | 交付物 |
|--------|------|------|--------|
| S1 | 1.5 周 | 数据模型 + Portal API 基础 | Prisma migration + 门户公开 API |
| S2 | 1.5 周 | 前端接入真实数据 + 域名解析 | 商品详情页 SSR + 二维码 |
| S3 | 2 周 | 质保注册 + 消费者身份 | 完整质保流程 |
| S4 | 2.5 周 | AI Chat 客服 + 媒体分析 | Agent 对话 + SSE + 媒体处理 |
| S5 | 1 周 | FAQ + 说明书 + 购买渠道 | 内容展示 + 主力 Listing 链接 |
| S6 | 1 周 | 后台管理扩展 + 集成测试 | apps/web 门户配置页 + E2E |

**总计：约 9.5 周**

---

## S1: 数据模型 + Portal API 基础（1.5 周）

### 目标

建立门户所需的全部 Prisma 模型，创建面向消费者的只读 API 层。

### 1.1 Prisma Schema 扩展

在 `packages/database/prisma/schema.prisma` 中新增以下模型：

#### BrandPortalConfig（品牌门户配置）

```
model BrandPortalConfig {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  brandId         String   @unique @db.Uuid
  customDomain    String?  @unique        // "support.novabrand.com"
  themeId         String   @default("editorial")
  logoUrl         String?
  faviconUrl      String?
  seoTitle        String?
  seoDescription  String?
  primaryColor    String?                 // 覆盖主题 accent
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(...)
  brand           Brand    @relation(...)
}
```

#### PortalConsumer（门户消费者）

```
model PortalConsumer {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  email           String
  emailVerified   Boolean  @default(false)
  name            String?
  phone           String?
  locale          String   @default("en")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(...)
  warranties      WarrantyRegistration[]
  supportCases    SupportCase[]
  feedbacks       ProductFeedback[]

  @@unique([tenantId, email])
  @@index([tenantId])
}
```

#### WarrantyRegistration（质保注册）

```
model WarrantyRegistration {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  consumerId      String   @db.Uuid
  commodityId     String   @db.Uuid
  serialNumber    String
  purchaseDate    DateTime @db.Date
  purchaseChannel String                  // "amazon" | "official" | "retail" | "other"
  expiryDate      DateTime @db.Date       // Agent 自动计算
  status          String   @default("active") // "active" | "expired" | "voided"
  activatedAt     DateTime @default(now())
  createdAt       DateTime @default(now())
  tenant          Tenant   @relation(...)
  consumer        PortalConsumer @relation(...)
  commodity       Commodity @relation(...)

  @@unique([tenantId, serialNumber])
  @@index([tenantId, consumerId])
  @@index([commodityId])
}
```

#### SupportCase（客服工单）

```
model SupportCase {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  consumerId      String?  @db.Uuid       // null = 匿名
  commodityId     String   @db.Uuid
  channel         String   @default("portal") // "portal" | "mcp_agent" | "platform"
  issueType       String?                 // "warranty" | "usage" | "defect" | "complaint" | "b2b" | "creator"
  status          String   @default("open") // "open" | "agent_handling" | "human_escalated" | "resolved" | "closed"
  priority        String   @default("normal") // "low" | "normal" | "high" | "urgent"
  agentConfidence Float?                  // 0-1, Agent 自评置信度
  assignedTo      String?                 // 人工接管时的 userId
  resolvedAt      DateTime?
  closedAt        DateTime?
  knowledgeWriteback String?              // 人工处理后的逻辑回写
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(...)
  consumer        PortalConsumer? @relation(...)
  commodity       Commodity @relation(...)
  messages        CaseMessage[]
  mediaAnalyses   MediaAnalysis[]

  @@index([tenantId, status])
  @@index([tenantId, consumerId])
  @@index([commodityId])
}
```

#### CaseMessage（工单消息）

```
model CaseMessage {
  id              String   @id @default(uuid()) @db.Uuid
  caseId          String   @db.Uuid
  role            String                  // "consumer" | "agent" | "human_operator"
  contentType     String   @default("text") // "text" | "media_ref" | "action_card" | "system"
  content         String                  // 文字内容或 JSON
  metadata        Json?                   // 附加数据（action card 详情等）
  createdAt       DateTime @default(now())
  case            SupportCase @relation(...)

  @@index([caseId, createdAt])
}
```

#### MediaAnalysis（媒体分析结果）

```
model MediaAnalysis {
  id              String   @id @default(uuid()) @db.Uuid
  caseId          String   @db.Uuid
  sourceType      String                  // "image" | "video"
  analysisResult  Json                    // AI 提取的结构化信息
  keyFrameUrls    String[] @default([])   // 关键帧 URL（非原始视频）
  confidence      Float
  originalFileRef String?                 // S3 临时存储引用（TTL 后自动失效）
  originalDeleted Boolean  @default(false)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  case            SupportCase @relation(...)

  @@index([caseId])
}
```

#### ConsumerFAQ（消费者 FAQ）

```
model ConsumerFAQ {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  commodityId     String?  @db.Uuid       // null = 品牌级通用 FAQ
  brandId         String   @db.Uuid
  question        String
  answer          String
  category        String?                 // "usage" | "warranty" | "troubleshooting" | "safety"
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant          Tenant   @relation(...)
  commodity       Commodity? @relation(...)
  brand           Brand    @relation(...)

  @@index([tenantId, brandId, commodityId])
}
```

#### ProductFeedback（产品反馈）

```
model ProductFeedback {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  consumerId      String   @db.Uuid
  commodityId     String   @db.Uuid
  feedbackType    String                  // "bug" | "feature" | "design" | "new_product" | "safety"
  title           String
  detail          String
  priority        String   @default("nice_to_have") // "nice_to_have" | "important" | "critical"
  status          String   @default("submitted") // "submitted" | "reviewed" | "aggregated" | "actioned"
  agentSummary    String?                 // Agent 提炼的摘要
  createdAt       DateTime @default(now())
  tenant          Tenant   @relation(...)
  consumer        PortalConsumer @relation(...)
  commodity       Commodity @relation(...)

  @@index([tenantId, commodityId, feedbackType])
}
```

#### QRScanEvent（二维码扫描事件）

```
model QRScanEvent {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  commodityId     String   @db.Uuid
  source          String                  // "package" | "manual" | "warranty_card" | "colorbox"
  userAgent       String?
  ipCountry       String?                 // GeoIP 解析
  scannedAt       DateTime @default(now())
  tenant          Tenant   @relation(...)
  commodity       Commodity @relation(...)

  @@index([tenantId, commodityId, source])
  @@index([scannedAt])
}
```

#### 现有模型扩展

Brand 模型新增关系：
```
model Brand {
  // ... 现有字段 ...
  portalConfig    BrandPortalConfig?
  faqs            ConsumerFAQ[]
}
```

Commodity 模型新增关系：
```
model Commodity {
  // ... 现有字段 ...
  warranties      WarrantyRegistration[]
  supportCases    SupportCase[]
  faqs            ConsumerFAQ[]
  feedbacks       ProductFeedback[]
  qrScans         QRScanEvent[]
}
```

Tenant 模型新增关系：
```
model Tenant {
  // ... 现有字段 ...
  portalConfigs     BrandPortalConfig[]
  portalConsumers   PortalConsumer[]
  warranties        WarrantyRegistration[]
  supportCases      SupportCase[]
  consumerFaqs      ConsumerFAQ[]
  productFeedbacks  ProductFeedback[]
  qrScanEvents      QRScanEvent[]
}
```

### 1.2 Portal API 路由

在 `apps/api/src/` 新建 `portal-routes.ts`，挂载到 `/portal` 前缀。

#### 公开路由（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/portal/resolve` | 通过 domain 参数解析 BrandPortalConfig |
| GET | `/portal/brands/:brandId/products` | 品牌下所有商品（含 Product + Commodity） |
| GET | `/portal/commodities/:id` | 单个商品详情（含 Product DNA + 市场本地化） |
| GET | `/portal/commodities/:id/faqs` | 商品 FAQ 列表 |
| GET | `/portal/commodities/:id/media` | 商品媒体列表（说明书/视频） |
| GET | `/portal/commodities/:id/listings` | 主力 Listing 链接 |
| POST | `/portal/qr-scan` | 记录二维码扫描事件 |

#### 认证路由（需消费者身份）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/portal/auth/send-code` | 发送邮箱验证码 |
| POST | `/portal/auth/verify-code` | 验证码验证 → 返回 JWT |
| GET | `/portal/me` | 当前消费者信息 |
| POST | `/portal/warranties` | 注册质保 |
| GET | `/portal/warranties` | 我的质保列表 |
| GET | `/portal/warranties/:id` | 质保详情 |
| POST | `/portal/cases` | 创建工单 |
| GET | `/portal/cases` | 我的工单列表 |
| GET | `/portal/cases/:id` | 工单详情（含消息链） |
| POST | `/portal/cases/:id/messages` | 发送消息 |
| POST | `/portal/cases/:id/media` | 上传媒体（→ AI 分析） |
| POST | `/portal/feedbacks` | 提交产品反馈 |

#### 认证机制

- 消费者 JWT（独立于运营后台 JWT）
- 签发：`portal-consumer:{consumerId}:{tenantId}`
- 有效期：7 天，刷新机制同现有 RefreshToken 模式
- 中间件：`portalAuth()` 解析 JWT，注入 `consumerId` + `tenantId`

### 1.3 交付检查清单

- [x] Prisma migration 成功执行
- [x] 所有公开路由可通过 curl 测试
- [x] 认证路由返回正确的 401/403
- [x] seed 脚本包含 BrandPortalConfig + ConsumerFAQ 测试数据

---

## S2: 前端接入真实数据 + 域名解析（1.5 周）

### 目标

将 portal 前端从 mock 数据切换为真实 API 调用，实现域名 → 品牌解析。

### 2.1 域名解析流程

```
消费者访问 support.novabrand.com
  → Next.js middleware 读取 Host header
  → 调用 GET /portal/resolve?domain=support.novabrand.com
  → 返回 BrandPortalConfig（brandId, themeId, logoUrl, ...）
  → 注入到 PortalThemeProvider
```

实现文件：`apps/portal/middleware.ts`

开发环境 fallback：`localhost:3100` → 使用 query param `?brand=xxx` 或环境变量 `DEFAULT_BRAND_ID`。

### 2.2 数据获取层

新建 `apps/portal/lib/api.ts`：
- `fetchBrandConfig(domain: string)` — SSR，缓存 5 分钟
- `fetchProducts(brandId: string)` — SSR
- `fetchCommodity(commodityId: string)` — SSR
- `fetchFAQs(commodityId: string)` — SSR
- `fetchMedia(commodityId: string)` — SSR
- `fetchListings(commodityId: string)` — SSR
- `recordQRScan(commodityId: string, source: string)` — Client

API base URL 从环境变量 `PORTAL_API_URL` 读取。

### 2.3 路由重构

将 `app/page.tsx` 的单页状态路由改为 Next.js App Router 文件路由：

```
apps/portal/app/
├── layout.tsx              # 根布局：域名解析 + ThemeProvider
├── page.tsx                # 首页：品牌产品列表
├── p/[commodityId]/
│   └── page.tsx            # 商品详情页（SSR）
├── warranty/
│   └── page.tsx            # 质保注册（SSR + Client）
├── chat/
│   └── page.tsx            # Chat 客服（CSR）
└── qr/
    └── route.ts            # 二维码重定向 + 扫描记录
```

二维码 URL 格式：`https://{domain}/qr?c={commodityId}&src={source}`
→ 记录 QRScanEvent → 302 重定向到 `/p/{commodityId}`

### 2.4 商品详情页 SSR

`app/p/[commodityId]/page.tsx`：
- Server Component，`generateMetadata()` 输出 SEO 标签
- 数据：Commodity + Product DNA + FAQ + Media + Listings
- 客户端交互：Tab 切换、FAQ 展开、反馈表单

### 2.5 交付检查清单

- [x] 域名解析 → 品牌配置 → 主题切换 完整流程
- [x] 商品详情页 SSR 正确输出 HTML（curl 验证）
- [x] 二维码扫描记录写入数据库
- [x] 开发环境 fallback 正常工作

---

## S3: 质保注册 + 消费者身份（2 周）

### 目标

实现消费者邮箱验证 + 质保注册完整流程。

### 3.1 消费者认证流程

```
消费者点击"注册质保"
  → 输入邮箱
  → POST /portal/auth/send-code → 发送 6 位验证码（邮件）
  → 输入验证码
  → POST /portal/auth/verify-code → 返回 JWT + 创建/查找 PortalConsumer
  → 前端存储 JWT 到 localStorage
  → 后续请求 Authorization: Bearer {jwt}
```

验证码有效期：10 分钟，最多 3 次尝试。

邮件发送：Phase 1 使用 console.log 输出验证码（开发模式），预留 `IEmailProvider` 接口。

### 3.2 质保注册流程

```
消费者已登录
  → 输入序列号 + 购买日期 + 购买渠道
  → POST /portal/warranties
  → Agent 自动：
    1. 验证序列号格式
    2. 查找对应 Commodity（通过 QR 扫码已知，或手动选择）
    3. 计算到期日 = purchaseDate + commodity.warrantyPeriodMonths
    4. 检查重复注册（同序列号）
    5. 创建 WarrantyRegistration
  → 返回质保详情
```

### 3.3 前端实现

重构 `screen-warranty.tsx` → `app/warranty/page.tsx`：
- Step 1：邮箱验证（如未登录）
- Step 2：序列号 + 购买日期 + 渠道
- Step 3：成功确认 + 质保详情

### 3.4 交付检查清单

- [x] 邮箱验证码发送 + 验证流程
- [x] JWT 签发 + 中间件验证
- [x] 质保注册成功 + 到期日自动计算
- [x] 重复序列号拒绝
- [x] 质保列表查询

---

## S4: AI Chat 客服 + 媒体分析（2.5 周）

### 目标

实现 Agent-Native 的 Chat 客服系统，包含 SSE 流式响应和媒体 AI 分析。

### 4.1 Chat 架构

```
消费者发送消息
  → POST /portal/cases/:id/messages
  → 写入 CaseMessage（role: "consumer"）
  → 触发 Agent 处理（异步）
  → Agent 通过 SSE 流式返回响应
  → 写入 CaseMessage（role: "agent"）
  → 前端实时显示
```

SSE 端点：`GET /portal/cases/:id/stream`
- 消费者连接后持续接收 Agent 消息
- 事件类型：`message` | `typing` | `action_card` | `escalation` | `done`

### 4.2 Agent 处理层

在 `apps/api/src/` 新建 `portal-agent.ts`：

```typescript
async function handleConsumerMessage(caseId: string, message: string): Promise<void> {
  // 1. 加载上下文：Commodity + Warranty + 历史消息
  // 2. 识别问题类型（warranty/usage/defect/complaint/b2b/creator）
  // 3. 匹配 FAQ 知识库
  // 4. 生成响应（通过 ModelRouter）
  // 5. 评估置信度
  // 6. 置信度 < 阈值 → 升级人工
  // 7. 写入 CaseMessage + 更新 SupportCase.agentConfidence
  // 8. 通过 SSE 推送给消费者
}
```

ModelRouter 调用：使用 `WorkType.PORTAL_SUPPORT_RESPONSE`，查配置表决定模型。

### 4.3 媒体分析流程

```
消费者上传图片/视频
  → POST /portal/cases/:id/media（multipart/form-data）
  → 原始文件上传到 S3/R2 临时存储（TTL: 7 天）
  → 触发 AI 分析：
    图片 → 损坏类型 + 位置 + 严重度 + 人为概率
    视频 → 异常类型 + 触发条件 + 关键帧提取
  → 创建 MediaAnalysis（结构化信息永久保留）
  → 创建 CaseMessage（contentType: "media_ref"，引用 MediaAnalysis.id）
  → SSE 推送分析结果给消费者
```

Phase 1 媒体分析：使用 Gemini Vision API（通过 ModelRouter）。

### 4.4 人工升级流程

```
Agent 置信度 < 阈值（默认 0.6）
  → SupportCase.status = "human_escalated"
  → 创建 CaseMessage（role: "system", content: "升级人工"）
  → SSE 推送 escalation 事件
  → 消费者看到"正在转接人工客服"
  → 运营人员在 apps/web 的统一收件箱看到工单
```

Phase 1 人工处理：在 `apps/web` 新增 `/support` 页面，显示升级工单列表。
人工回复后强制触发知识回写：`SupportCase.knowledgeWriteback` 必填。

### 4.5 前端实现

重构 `screen-chat.tsx` → `app/chat/page.tsx`：
- SSE 连接管理（EventSource）
- 消息列表实时更新
- 媒体上传 + 分析结果展示
- Agent action card 渲染
- "Request Human" 按钮

### 4.6 交付检查清单

- [x] 消费者发送消息 → Agent 流式响应
- [x] 媒体上传 → AI 分析 → 结构化结果展示
- [x] 置信度低于阈值 → 自动升级人工
- [x] apps/web 运营后台可查看升级工单
- [x] 人工处理后知识回写

---

## S5: FAQ + 说明书 + 购买渠道（1 周）

### 目标

完善商品详情页的内容展示功能。

### 5.1 FAQ 智能搜索

- 前端搜索框输入 → 调用 `GET /portal/commodities/:id/faqs?q=xxx`
- API 端：先精确匹配，再语义搜索（Phase 1 用 LIKE 模糊匹配，Phase 2 升级向量搜索）
- FAQ 展开/折叠交互

### 5.2 说明书展示

复用 `CommodityMedia` 模型（type: "usage" | "assembly" | "repair"）：
- PDF 说明书：直接链接打开
- 视频教程：嵌入播放器
- 在线版说明书：Markdown 渲染（如有）

### 5.3 菜谱/使用教程

复用 `CommodityMedia`（type: "recipe_demo"）：
- 按品类动态显示（厨电显示菜谱，其他品类显示使用教程）
- 品类判断：通过 `Category.code` 匹配

### 5.4 购买渠道

- 主力 Listing：`Listing` 表中 `isPrimary = true` 的记录
- 直购入口：`BrandPortalConfig` 中配置的官方商城链接
- B2B 询价：静态链接（Phase 2 实现表单）
- 红人合作：静态链接（Phase 2 实现表单）

### 5.5 交付检查清单

- [x] FAQ 搜索 + 展开/折叠
- [x] 说明书 PDF 链接 + 视频嵌入
- [x] 菜谱按品类动态显示
- [x] 主力 Listing 链接正确展示
- [x] 购买渠道按钮可点击

---

## S6: 后台管理扩展 + 集成测试（1 周）

### 目标

在 `apps/web` 运营后台新增门户管理功能，完成端到端测试。

### 6.1 apps/web 新增页面

#### /portal-config — 品牌门户配置

- 品牌列表 → 点击进入门户配置
- 配置项：域名、主题选择（ThemeSelector 组件）、Logo、SEO
- 主题预览（内嵌 iframe 或截图）

#### /support — 客服工单管理

- 工单列表（筛选：状态、品牌、商品、优先级）
- 工单详情：消息链 + 媒体分析结果 + Agent 建议
- 人工回复 + 知识回写表单
- 工单关闭

#### /portal-config/faqs — FAQ 管理

- 按品牌/商品组织的 FAQ CRUD
- 排序拖拽
- 批量导入

#### /portal-config/qr — 二维码管理

- 按商品生成二维码（4 种载体）
- 下载印刷版（SVG/PNG）
- 扫码统计面板

### 6.2 Seed 数据

扩展 `apps/api/src/seed-harness.ts`：
- 创建 BrandPortalConfig（NOVA 品牌）
- 创建 ConsumerFAQ（ChefPro X3 的 5 条 FAQ）
- 创建 PortalConsumer（测试消费者）
- 创建 WarrantyRegistration（测试质保记录）

### 6.3 集成测试

- 完整流程：扫码 → 商品详情 → 质保注册 → Chat → 升级人工 → 关闭工单
- API 测试：所有 portal 路由的 happy path + error path
- 主题切换：至少 2 个主题下验证所有页面

### 6.4 交付检查清单

- [x] 门户配置页可切换主题
- [x] 工单管理页可查看/回复/关闭工单
- [x] FAQ 管理 CRUD 正常
- [x] 二维码扫码统计面板
- [x] Seed 数据完整
- [x] 端到端流程通过

---

## 技术选型

| 需求 | 选型 | 理由 |
|------|------|------|
| 实时通信（Agent→消费者） | SSE | 单向流式，Agent 友好，无需 WebSocket 复杂性 |
| 实时通信（人工↔消费者） | WebSocket（Phase 2） | Phase 1 先用轮询，Phase 2 升级 |
| 媒体临时存储 | S3/R2 + lifecycle policy | 自动过期删除，Phase 1 可用本地 /tmp + cron |
| AI 媒体分析 | Gemini Vision API（通过 ModelRouter） | 复用现有 AI 集成 |
| 邮件验证码 | console.log（Phase 1）→ Resend/SES（Phase 2） | 先跑通流程 |
| 二维码生成 | `qrcode` npm 包 | 轻量，支持 SVG/PNG |
| JWT 签发 | `jose`（已有依赖） | 复用现有 auth 基础设施 |

---

## 文件变更清单

### 新建文件

| 文件 | Sprint | 说明 |
|------|--------|------|
| `packages/database/prisma/migrations/xxx_portal_models/` | S1 | 新模型 migration |
| `apps/api/src/portal-routes.ts` | S1 | 门户 API 路由 |
| `apps/api/src/portal-auth.ts` | S3 | 消费者认证逻辑 |
| `apps/api/src/portal-agent.ts` | S4 | Chat Agent 处理层 |
| `apps/api/src/portal-media.ts` | S4 | 媒体上传 + AI 分析 |
| `apps/portal/middleware.ts` | S2 | 域名解析中间件 |
| `apps/portal/lib/api.ts` | S2 | API 数据获取层 |
| `apps/portal/app/p/[commodityId]/page.tsx` | S2 | 商品详情页 |
| `apps/portal/app/warranty/page.tsx` | S3 | 质保注册页 |
| `apps/portal/app/chat/page.tsx` | S4 | Chat 页 |
| `apps/portal/app/qr/route.ts` | S2 | 二维码重定向 |
| `apps/web/app/portal-config/page.tsx` | S6 | 门户配置页 |
| `apps/web/app/support/page.tsx` | S6 | 工单管理页 |
| `apps/web/components/portal-config-dashboard.tsx` | S6 | 门户配置组件 |
| `apps/web/components/support-dashboard.tsx` | S6 | 工单管理组件 |

### 修改文件

| 文件 | Sprint | 变更 |
|------|--------|------|
| `packages/database/prisma/schema.prisma` | S1 | 新增 8 个模型 + 3 个模型扩展关系 |
| `apps/api/src/server.ts` | S1 | 挂载 `/portal` 路由 |
| `apps/api/src/seed-harness.ts` | S6 | 新增门户 seed 数据 |
| `apps/portal/app/layout.tsx` | S2 | 域名解析 + 动态 ThemeProvider |
| `apps/portal/app/page.tsx` | S2 | 从单页状态路由改为 SSR 首页 |
| `apps/web/components/sidebar-nav.tsx` | S6 | 新增 Portal Config / Support 导航 |

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Gemini Vision API 分析质量不稳定 | 中 | 中 | 设置 confidence 阈值，低于阈值直接升级人工 |
| SSE 连接在移动端不稳定 | 中 | 低 | 前端自动重连 + 消息去重（messageId） |
| 邮箱验证码被滥用 | 低 | 中 | 同一邮箱 1 分钟限 1 次，同 IP 10 分钟限 5 次 |
| 大量二维码扫描写入压力 | 低 | 低 | QRScanEvent 使用 pg-boss 异步写入 |
| 多品牌域名解析缓存一致性 | 低 | 中 | BrandPortalConfig 缓存 5 分钟 + 手动刷新按钮 |

---

## Phase 2 预留接口

以下设计在 Phase 1 中预留但不实现：

| 能力 | Phase 1 预留 | Phase 2 实现 |
|------|-------------|-------------|
| A2A MCP 接口 | API 路由结构兼容 MCP Tool 格式 | 标准 MCP Server |
| 消费者 Agent OAuth | JWT 中预留 `agentId` 字段 | OAuth 2.0 授权流 |
| WebSocket 人工对话 | SSE 单向 + 轮询 | 双向 WebSocket |
| 产品反馈聚合 | ProductFeedback 写入 | Agent 自动聚合 + 推送 |
| Google MCP 下单 | 购买渠道链接 | MCP Agent 对接 |
| B2B 询价表单 | 静态链接 | 表单 + CRM 对接 |

---

## 验收标准

Phase 1 完成时，以下场景必须端到端可用：

1. **扫码进入**：消费者扫描包装二维码 → 自动进入对应商品详情页
2. **浏览信息**：查看商品介绍、FAQ、说明书、菜谱（厨电）
3. **注册质保**：邮箱验证 → 填写序列号 → 自动激活 → 查看质保状态
4. **AI 客服**：发送文字/图片 → Agent 分析回复 → 展示媒体分析结果
5. **升级人工**：Agent 无法解决 → 自动升级 → 运营后台可见 → 人工回复
6. **知识回写**：人工处理后 → 强制填写处理逻辑 → 存入工单
7. **多品牌**：不同品牌使用不同主题 → 域名解析正确
8. **购买渠道**：主力 Listing 链接可点击跳转
