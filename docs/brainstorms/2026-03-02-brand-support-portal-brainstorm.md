---
date: 2026-03-02
topic: brand-support-portal
---

# 品牌客服门户（Brand Support Portal）

## What We're Building

一个 **Agent-Native** 的品牌客服门户系统，作为品牌与消费者建立直接关系的自有阵地。

核心模型：**Product（产品）× Market（市场）= Commodity（商品）**，在现有 MDM 体系基础上，为每个商品提供面向消费者的客服入口——包括商品详情、质保注册、AI Chat 客服、说明书/FAQ、购买渠道、产品反馈收集。

一个租户可拥有多个品牌，每个品牌对应一个独立的客服门户实例，支持租户管理员为每个品牌配置独立域名。

部署为独立 Next.js 应用（`apps/portal`），与现有 `apps/web`（运营后台）和 `apps/api` 共享 Prisma 数据层。

## Why This Approach

### 考虑过的方案

**方案 A：子路由方案** — 在 `apps/web` 下新增 `/portal/[brand]/[product]`
- 优点：共享基础设施，开发快
- 缺点：运营后台和消费者门户耦合，无法支持租户自定义域名，安全边界模糊

**方案 B：独立应用方案** — 新建 `apps/portal`（✅ 选定）
- 优点：完全独立部署，支持租户自定义域名，消费者侧和运营侧安全隔离，可独立扩缩容
- 缺点：需要额外的部署配置
- 最适合：多品牌多租户场景，每个品牌需要独立的消费者触点

**选择理由：** 品牌门户是消费者直接访问的公开页面，与运营后台的安全模型、部署策略、性能要求完全不同。独立应用是唯一能满足"租户自定义域名"需求的方案。

## 现有系统能力盘点

### 可直接复用（无需新建）

| 能力 | 现有位置 | 门户用途 |
|------|----------|----------|
| Product 模型 | `schema.prisma` L106-142 | 产品 DNA：sku, name, imageUrls, structuredFeatures, scenarios |
| Commodity 模型 | `schema.prisma` L144-179 | 商品本地化：title, bulletPoints, warrantyPeriodMonths, localSupportContact |
| Market + MarketLanguage | `schema.prisma` L462-487 | 市场+多语言支持 |
| Brand 模型 | `schema.prisma` L89-104 | 品牌信息 |
| Listing 模型 | `schema.prisma` L181-211 | `isPrimary` 字段可标识主力 Listing |
| CommodityMedia | `schema.prisma` L644-659 | 商品视频（usage/unboxing/repair/recipe_demo） |
| Category + AttributeSchema | `schema.prisma` L519-551 | 品类特定属性（如厨电菜谱数量） |
| Knowledge Graph MCP API | `knowledge-graph-routes.ts` L103-145 | 结构化产品数据输出 |
| AI 商品生成 | `knowledge-graph-routes.ts` L225-318 | 本地化 title/bulletPoints 生成 |
| Platform + Listing CRUD | `mdm-asset-routes.ts` | 平台链接管理 |
| PolicyConfig | `schema.prisma` L331-347 | 可存储品牌级/产品级售后政策 |

### 需要新增的能力

| 能力 | 说明 |
|------|------|
| **BrandPortalConfig** | 品牌门户配置：域名、Logo、主题色、SEO |
| **WarrantyRegistration** | 质保注册：序列号、购买日期、渠道、自动计算到期日 |
| **SupportCase** | 客服工单：消费者/Agent 发起，消息链，媒体分析结果 |
| **MediaAnalysis** | 媒体分析结构化信息：AI 提取的损坏/异常描述，关键帧 |
| **ProductFeedback** | 产品改进意见：消费者提交，Agent 自动归类聚合 |
| **QRCodeConfig** | 二维码配置：载体类型（包装/说明书/质保卡/彩盒），追踪参数 |
| **PortalConsumer** | 门户消费者身份：邮箱/手机，关联质保和工单 |
| **AgentSession (A2A)** | 消费者 Agent 会话：OAuth 令牌、操作范围、审计日志 |
| **KnowledgeWriteback** | 知识回写：人工处理例外后的逻辑回写 |

## Key Decisions

### D1: 部署架构 — 独立应用 `apps/portal`
- 独立 Next.js 应用，通过 `apps/api` 的 API 访问数据
- 支持租户自定义域名（通过 BrandPortalConfig 配置）
- 消费者侧无需登录即可浏览商品信息，质保注册/Chat 需要轻量身份验证

### D2: 核心模型复用 — Product × Market = Commodity
- 完全复用现有 MDM 层的 Product/Commodity/Market/Listing 模型
- 门户前台只读访问这些数据，不新建冗余模型
- 后台商品维护在现有 `apps/web` 的 Products/Assets 页面扩展

### D3: Chat 通信 — SSE + WebSocket 双轨
- SSE：Agent 流式响应（消费者 ↔ 品牌 Agent）
- WebSocket：人工实时对话（升级后消费者 ↔ 运营人员）
- 统一消息存储在 SupportCase.messages

### D4: 媒体文件 — 存信息不存文件
- 消费者上传图片/视频 → AI 立即分析提取结构化信息
- 结构化信息永久存储（MediaAnalysis）
- 原始文件临时存储（TTL），工单关闭后删除
- 人工介入时可调取原始文件（需权限，记录日志）

### D5: Agent Native — Agent 是第一响应者
- Chat 入口默认由 Agent 处理，不是排队等人工
- Agent 处理 80% 标准问题（质保查询、FAQ、退换货流程）
- 超出置信度阈值才升级人工
- 人工处理完毕后强制触发知识回写

### D6: A2A 通信 — MCP 标准接口
- 公开工具（无需授权）：产品信息、FAQ、说明书
- 身份验证工具：质保查询、创建工单、选择方案
- 人类确认工具：支付、大额退款
- 所有 A2A 操作写入审计日志

### D7: 多品牌隔离 — 一个租户多个门户
- 一个 Tenant 可有多个 Brand
- 每个 Brand 可配置独立的 BrandPortalConfig（域名、Logo、主题）
- 门户通过域名 → BrandPortalConfig → Brand → Tenant 解析租户上下文
- 数据隔离复用现有 Tenant 级 RLS

### D8: 二维码追踪 — 载体区分
- 不同载体（包装盒/说明书/质保卡/彩盒）使用不同二维码参数
- 二维码 URL 格式：`https://{portal-domain}/p/{commodity-id}?src={source}`
- 追踪扫码来源、时间、地理位置
- 后台可分析各载体扫码率

### D9: 实现范围 — Phase 1 核心 + Chat
Phase 1 包含：
1. 商品详情页（复用 Commodity 数据）
2. 质保注册（WarrantyRegistration）
3. AI Chat 客服（SupportCase + 媒体分析）
4. 二维码生成与追踪
5. 后台商品维护扩展
6. 说明书 + FAQ 查看
7. 购买渠道展示（主力 Listing 链接）

Phase 2（后续）：
- A2A MCP 接口
- Google MCP Agent 下单对接
- 产品意见收集与聚合
- B2B 询价 / 红人合作入口
- 消费者 Agent OAuth 体系

## Harness Engineering 原则贯穿

| 原则 | 在门户中的体现 |
|------|----------------|
| Agent 是第一执行者 | Chat 默认 Agent 响应，人工是例外 |
| 人类设定边界 | 运营人员配置售后政策、置信度阈值、升级规则 |
| 最低摩擦输入 | 质保注册：扫码自动锁定商品，只需填序列号+购买日期 |
| 知识回写 | 每次人工处理例外后强制回写处理逻辑 |
| 存信息不存文件 | 媒体 AI 分析后只保留结构化信息 |
| 双轨访问 | 每个功能同时提供 UI（人类）+ MCP API（Agent） |

## Agent-to-Agent 设计原则

| 层级 | 设计 |
|------|------|
| 只读操作 | 全部开放（产品信息/FAQ/说明书/质保政策） |
| 写操作 | 需消费者 Agent OAuth 令牌 + scope 验证 |
| 敏感操作 | 支付/退款超阈值 → 必须有人类确认信号 |
| 审计 | 所有 A2A 操作完整记录（timestamp, agent_id, consumer_id, tool, input_hash, output_hash） |
| 未来假设 | 系统假设大量消费者将通过自己的 Agent 处理售后 |

## Open Questions

（无）

## Resolved Questions

### RQ1: 消费者身份体系 ✅
**决定：** 邮箱+验证码（轻量级），不做密码注册。Phase 1 最低摩擦，后续可扩展 OAuth/社交登录。

### RQ2: 原始媒体文件的临时存储方案 ✅
**决定：** S3/R2 + lifecycle policy。工单关闭后 24h 自动删除原始文件，法律纠纷标记的延长保留。

### RQ3: Chat 消息的持久化策略 ✅
**决定：** 文字消息永久保留（存储成本低），MediaAnalysis 结构化信息永久保留，原始媒体文件按 TTL 策略删除。

### RQ4: 门户前端的 SSR vs CSR ✅
**决定：** Next.js App Router 混合渲染。商品详情页 SSR（SEO 需要），Chat 页 CSR（实时交互），质保注册页 SSR + Client Components。

### RQ5: 与现有 Knowledge Layer 的关系 ✅
**决定：** 新建 ConsumerFAQ 模型，面向消费者、按商品组织。现有 KnowledgeLayerA/B 保持面向运营/Agent 的定位不变。

## Implementation Progress

### Phase 0: Portal Template System (✅ Complete)
- `apps/portal/` — 独立 Next.js 应用，端口 3100
- 主题系统架构：theme-registry + CSS 变量契约 + ThemeContext
- 第一个主题 `editorial` — 基于 nova-brand-portal.html 原型
- 四个核心屏幕组件：首页、商品详情、Chat、质保注册
- 主题选择器组件 + 主题创建指南文档

### 文件清单
```
apps/portal/
├── app/
│   ├── globals.css          # 主题无关的全局重置
│   ├── layout.tsx           # 根布局，导入主题 CSS + Google Fonts
│   └── page.tsx             # 主入口，屏幕路由 + ThemeProvider
├── components/
│   ├── portal-nav.tsx       # 导航栏（品牌名+强调字母）
│   ├── screen-home.tsx      # 首页（Hero + 产品网格）
│   ├── screen-product.tsx   # 商品详情（侧边栏 + FAQ/Manual/Recipes/Feedback）
│   ├── screen-chat.tsx      # Chat 客服（Agent 消息 + 媒体分析展示）
│   ├── screen-warranty.tsx  # 质保注册（三步流程）
│   └── theme-selector.tsx   # 主题选择器（租户后台用）
├── lib/themes/
│   ├── theme-registry.ts    # 主题注册表（id, name, fonts, cssClass）
│   ├── portal-theme-context.tsx  # React Context（themeId, brandName）
│   ├── editorial.css        # Editorial 主题完整 CSS
│   └── THEME_GUIDE.md       # 新增主题指南
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Next Steps

→ `/workflows:plan` for Phase 1 implementation (API integration, real data, Prisma schema extensions)
