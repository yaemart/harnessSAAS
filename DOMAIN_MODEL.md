# 核心域模型

本文件描述系统中所有实体及其关系。Prisma schema 是 source of truth，本文件是人类/AI 可读的概览。

---

## 实体关系总览

```
Tenant
  ├── Brand[]
  │     ├── Product[]
  │     │     └── Commodity[] (= Product × Market)
  │     │           ├── Listing[] (= Commodity × Platform)
  │     │           ├── CommodityMedia[]
  │     │           ├── WarrantyRegistration[]
  │     │           ├── SupportCase[]
  │     │           ├── ConsumerFAQ[]
  │     │           ├── ProductFeedback[]
  │     │           └── QRScanEvent[]
  │     └── BrandPortalConfig (1:1)
  ├── Market[]
  │     └── MarketLanguage[]
  ├── Platform[]
  │     └── PlatformFulfillmentMode[]
  ├── Category[] (self-referencing tree)
  ├── User[] (运营人员)
  └── PolicyConfig[]

PortalConsumer (独立于 User)
  ├── WarrantyRegistration[]
  ├── SupportCase[]
  └── ProductFeedback[]
```

---

## 已有模型（Prisma 中已定义）

### Tenant
```
id, code, name, status, createdAt, updatedAt
```
租户是最顶层隔离单元。所有业务数据通过 `tenantId` 关联。

### Brand
```
id, tenantId, code, name, description, logoUrl, websiteUrl
@@unique([tenantId, code])
```
一个租户可拥有多个品牌。

### Product（产品）
```
id, tenantId, brandId, categoryId, sku, name
structuredFeatures: Json     # PKG L2 - 功能特性
scenarios: Json              # PKG L3 - 使用场景
targetIntents: Json          # PKG L4 - 用户意图
competitiveEdges: Json       # PKG L5 - 竞争优势
@@unique([tenantId, sku])
```
全球唯一的物理产品。PKG（Product Knowledge Graph）五层结构由 AI 生成。

### Market（市场）
```
id, tenantId, code, name, currency, timezone
```
地区维度。关联 `MarketLanguage` 支持多语言。

### Commodity（商品）= Product × Market
```
id, tenantId, productId, marketId, language
title, bulletPoints: string[]
warrantyPeriodMonths: Int
@@unique([productId, marketId, language])
```
产品进入新市场时自动创建。所有面向消费者的内容都在 Commodity 层。

### Listing = Commodity × Platform
```
id, tenantId, commodityId, platformId
externalListingId, status, isPrimary
@@unique([platformId, externalListingId])
```
`isPrimary` 标记主力 Listing，门户只展示主力 Listing 的购买链接。

### CommodityMedia
```
id, tenantId, commodityId
mediaType, url, altText, sortOrder
```
商品图片/视频素材引用（非原始文件存储）。

### Category
```
id, tenantId, code, name, parentId (self-ref)
```
层级品类树。

---

## 新增模型（Phase 1 计划）

### BrandPortalConfig
```
id, brandId (unique 1:1), tenantId
customDomain: String?        # 自定义域名
themeId: String              # 主题 ID（editorial/minimal-mono/tech-neon/...）
logoUrl: String?
faviconUrl: String?
seoTitle: String?
seoDescription: String?
primaryColor: String?        # 覆盖主题主色
welcomeMessage: String?
supportEmail: String?
isActive: Boolean
```

### PortalConsumer（消费者）
```
id, email (unique per brand scope)
name: String?
phone: String?
locale: String
brandId                      # 消费者归属品牌
verifiedAt: DateTime?
lastLoginAt: DateTime?
```
独立于运营后台 `User`。认证方式：邮箱 + OTP。

### WarrantyRegistration（质保注册）
```
id, consumerId, commodityId, tenantId
serialNumber: String
purchaseDate: DateTime
expiryDate: DateTime         # Agent 根据 warrantyPeriodMonths 自动计算
channel: String              # 购买渠道（Amazon/官网/...）
proofOfPurchaseRef: String?  # 临时存储引用
status: 'active' | 'expired' | 'voided'
```

### SupportCase（工单）
```
id, consumerId, commodityId, tenantId
channel: 'portal' | 'mcp_agent' | 'platform'
issueType: String            # 分类（warranty/defect/usage/...）
status: 'open' | 'agent_handling' | 'human_escalated' | 'resolved' | 'closed'
agentConfidence: Float?      # Agent 处理置信度
resolution: String?
knowledgeWriteback: String?  # 人工处理后的回写内容
```

### CaseMessage（工单消息）
```
id, caseId
role: 'consumer' | 'agent' | 'human_support'
contentType: 'text' | 'media_ref' | 'system'
content: String
```

### MediaAnalysis（媒体分析结果）
```
id, caseId, tenantId
sourceType: 'image' | 'video'
analysisResult: Json         # AI 提取的结构化信息
keyFrameUrls: String[]       # 关键帧 URL
confidence: Float
originalFileRef: String      # 临时存储引用（TTL 后自动失效）
deletedAt: DateTime?         # 原始文件删除时间
```

### ConsumerFAQ
```
id, brandId, commodityId?, tenantId
question: String
answer: String
category: String             # 分类标签
sortOrder: Int
isPublished: Boolean
```
面向消费者的 FAQ。与运营知识库 `KnowledgeLayerA/B` 分离。

### ProductFeedback（产品反馈）
```
id, consumerId, commodityId, tenantId
feedbackType: 'praise' | 'complaint' | 'suggestion' | 'question'
detail: String
sentiment: Float?            # AI 分析情感分数
```

### QRScanEvent（二维码扫描事件）
```
id, commodityId, tenantId
source: 'packaging' | 'manual' | 'warranty_card' | 'box'
userAgent: String?
ipCountry: String?
scannedAt: DateTime
```

---

## 执行与审计模型（已有）

### AgentExecutionLog
```
id, tenantId, nodeId, inputHash, outputHash
reasoningLog: Json           # OODA 结构
duration, createdAt
```

### ExecutionReceipt
```
id, executionLogId
platformId, action, result, proof
```

### ApprovalQueue
```
id, tenantId, intentId
status: PENDING | APPROVED | REJECTED | EXPIRED
approvedBy, approvedAt
```

---

## Phase 2 预留模型

### AgentSession（A2A 会话）
```
id, agentId, consumerId
scope: String[]              # 授权操作范围
token: String
actions: AgentAction[]       # 完整操作记录
humanConfirmations: HumanConfirmation[]
```

### HumanConfirmation（人类确认记录）
```
id, sessionId, operationType
requestedAt, confirmedAt?, expiredAt?
status: 'pending' | 'confirmed' | 'rejected' | 'expired'
```
