# CodexAI Ecom — Sovereign AI-Native E-Commerce Platform

## 项目性质

Agent-Native SaaS 跨境电商运营平台，包含两个面向不同用户的子系统：

1. **运营后台** (`apps/web`) — 面向品牌运营人员的 AI 驱动决策系统
2. **品牌客服门户** (`apps/portal`) — 面向消费者的品牌自有客服阵地
3. **API 服务** (`apps/api`) — Hono 后端，服务两个前端
4. **Agent 运行时** (`apps/agent-py`) — LangGraph 驱动的 AI 决策引擎

## 核心模型

```
Tenant → Brand → Product → Commodity → Listing
                              ↓
                    Product × Market = Commodity
                              ↓
                    多语言内容 / 本地售后政策 / 本地合规
```

- **Product（产品）** — 物理实体，全球唯一，SKU/功能/规格/图片通用
- **Market（市场）** — 地区 + 语言 + 币种 + 售后政策
- **Commodity（商品）** — Product × Market 的本地化实例，动态维护
- **Listing** — Commodity 在某平台上的具体上架

## 核心原则（所有代码必须遵守）

### 1. Sovereign Architecture（主权架构）

- **Death Line**：Cognition（`apps/agent-py/src/nodes/`）不得导入平台模块、数据库客户端或外部 API
- **Four Powers**：Intent Power / Cognition Power / Constraint Power / Execution Power 严格分层
- **OODA Protocol**：所有推理节点输出 Observe → Orient → Decide → Act 结构
- **每个节点必须调用 `verify_brain_purity()`**

### 2. Harness Engineering（驾驭工程）

- Agent 是第一执行者，人类是边界设定者和例外处理者
- 所有人类输入节点设计为最低摩擦（滑块 > 输入框，单选 > 填空）
- 人类的每次例外处理必须触发"回写逻辑"存入知识库
- 系统存信息而不存媒体文件（图片/视频经 AI 提取结构化信息后删除原始文件）

### 3. Agent-Native（Agent 原生）

- 业务流程从 Agent 视角设计，不是人工流程加 AI 辅助
- 每个业务模块暴露双轨：UI 界面（人类）+ MCP API（Agent）
- 所有业务逻辑必须 API 化，不能只有界面操作路径

### 4. A2A（Agent-to-Agent）通信

- 系统必须支持消费者 Agent 通过 MCP 协议调用品牌 Agent
- 支付 / 退款超阈值 / 个人信息变更永远需要人类确认信号
- 所有 A2A 交互完整记录，人类可审查

## 技术栈

| 层 | 技术 |
|----|------|
| Monorepo | pnpm + Turborepo |
| 前端（运营） | Next.js 15 + React 19 |
| 前端（门户） | Next.js 15 + React 19（独立应用，端口 3100） |
| API | Hono 4.9 + TypeScript |
| 数据库 | PostgreSQL + Prisma 7.4 |
| 队列 | pg-boss |
| Agent 运行时 | Python + FastAPI + LangGraph |
| AI | Google GenAI（通过 ModelRouter） |
| 认证 | jose（JWT） |

## 绝对禁止

- 在业务代码中写死 LLM 模型名称（必须通过 ModelRouter 查配置表）
- 长期存储用户上传的原始图片/视频
- Agent 自主完成支付操作
- 跳过人类确认的退款操作
- Cognition 层导入平台模块或数据库客户端
- 新建 CSS 变量但不在所有主题中定义
- 硬编码颜色值（运营后台必须用 `var(--token)`，门户必须用 `var(--portal-token)`）

## 品牌客服门户特有原则

- 一个租户可拥有多个品牌，每个品牌对应独立门户实例
- 门户通过域名 → BrandPortalConfig → Brand → Tenant 解析上下文
- 消费者身份：邮箱 + 验证码（轻量级，无密码）
- 二维码追踪：不同载体（包装/说明书/质保卡/彩盒）使用不同参数
- Chat 客服：Agent 是第一响应者，人工是例外处理者
- 媒体处理：AI 分析后只保留结构化信息，原始文件 TTL 后删除
