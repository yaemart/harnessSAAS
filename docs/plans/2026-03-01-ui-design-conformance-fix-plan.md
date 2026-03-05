---
date: 2026-03-01
topic: ui-design-conformance-fix
depends-on:
  - ../brainstorms/2026-03-01-harness-ui-design-philosophy-brainstorm.md
  - 2026-03-01-harness-fullstack-implementation-plan.md
status: draft
deepened: 2026-03-01
deepened-round-2: 2026-03-01
research-agents-used:
  - "Round 1: Mobile swipe gestures best practices"
  - "Round 1: AI transparency & explainability UX patterns"
  - "Round 1: Frontend performance analysis (10 areas)"
  - "Round 2: Next.js App Router route groups + RBAC middleware"
  - "Round 2: SSE single-connection multiplexing architecture"
  - "Round 2: Security audit (18 vulnerabilities found)"
  - "Round 2: Architecture strategy review"
  - "Round 2: Deep performance analysis (6 new areas)"
  - "Round 2: Pattern recognition & anti-pattern detection"
---

# UI 设计哲学符合性修复计划

## Enhancement Summary

**深化日期：** 2026-03-01（Round 1 + Round 2）
**研究 Agent 数量：** Round 1: 4 个 | Round 2: 6 个 = 共 10 个并行 Agent
**增强章节数：** Phase 0-3 全部增强 + 新增 4 个章节

### Round 2 关键发现

1. **4 个 CRITICAL 安全漏洞**：FALLBACK_USER 未认证=Operator、前端隔离可完全绕过、Supplier Token 无安全体系、Phase 0-2 安全真空期 4-6 周
2. **架构决策确认**：5 路由组不合并（Tenant Admin ≠ Operator）、组合模式替代 role prop、Sprint 5 引入 Zustand
3. **SSE 完整架构**：`@microsoft/fetch-event-source` + PostgreSQL LISTEN/NOTIFY + Tenant-Scoped EventEmitter + React Query 缓存失效
4. **Next.js 三层安全防御**：Middleware（jose JWT）→ Server Component → Database RLS，CVE-2025-29927 防护
5. **统一组件模式**：RoleGuard、ConfidenceBadge、InteractionTag、AgentSuggestionCard、DataState 5 个共享组件
6. **Server Component 优化**：Viewer `/reports` 和 Supplier `/supplier/{token}` 可为 Server Component，减少 JS bundle

### Round 1 关键改进（保留）

1. **10 个性能风险识别 + 优化策略**：SSE 单连接多路复用、路由按角色分组、Tab 懒加载、虚拟化列表、主题 FOUC 消除
2. **Mobile 手势库选型确定**：Motion (motion/react) 做卡片滑动 + react-modal-sheet 做 Bottom Sheet，56px+ 工业级触摸目标
3. **AI 透明度 UX 模式**：置信度三色系统、OODA 渐进式披露、拒绝反馈"教学式"文案、14 天结果闭环
4. **P0 优先行动清单**：SSE 多路复用、路由分组、主题 FOUC 内联脚本——必须在 Sprint 3b 前完成

### 新发现的风险（Round 1 + Round 2 合并）

**CRITICAL（Round 2 新增）：**
- C-1: 前端隔离可被 React DevTools / Network 面板完全绕过
- C-2: Supplier Token 无过期/撤销/暴力破解防护
- C-3: Phase 0-2 安全真空期 4-6 周（header 可伪造）
- C-4: FALLBACK_USER 将未认证用户视为 Operator

**HIGH（Round 2 新增）：**
- H-1: SSE 事件无角色过滤，可能泄露跨角色数据
- H-2: 登录接口无速率限制
- H-4: MDM 路由 tenantId 从 header/query 获取而非 auth context
- H-6: 铁律仅 UI 强制，无后端 API 层 + CI 检查

**性能风险（Round 1，保留）：**
- SSE 在 200+ 连接时 CPU 飙升（需单连接多路复用 + tenantId 分组）
- Product Workspace 6 Tab 同时加载会导致 TTI > 2s（需 Tab 懒加载 + dynamic import）
- Inbox 14 天历史数据累积可导致内存泄漏（需分页 + LRU 缓存）
- `color-mix()` 在 Safari < 16.4 不支持（需 `@supports` fallback）
- 客户端 PDF 生成会冻结 UI 5-15 秒（需服务端生成）

---

> **目的：** 将现有 UI 从 25% 符合度提升到设计哲学文档的要求。
> **与全栈实施计划的关系：** 本计划是全栈计划中工作线 C（角色化 UI）的前置修复，聚焦于"现有代码的修正"，不涉及新后端能力的开发。后端能力（experience 表、IAM、FieldFilter 中间件等）按全栈计划的 Sprint 节奏交付。

---

## 审计基线（当前状态）

| 维度 | 符合度 | 最严重的问题 |
|------|--------|-------------|
| Section 0 神经接口 | 40% | 缺置信度展示、缺主动推送 |
| Section 1 System Admin 铁律 | **0%** | 可看到任意租户全部业务数据 |
| Section 2 Tenant Admin 铁律 | 30% | 授权中心存 localStorage，无后端强制 |
| Section 3 Operator 铁律 | 50% | 拒绝原因已实现，但产品工作台/置信度全缺 |
| Section 4 Supplier 铁律 | **0%** | 无任何字段过滤 |
| Section 5 Viewer 铁律 | 40% | 数据全 mock，零操作未严格强制 |
| Section 6 Harness 映射 | 10% | Harness 页面全硬编码 |
| Section 7 验收标准 | 15% | 15 条中仅 1 条基本达标 |

---

## 修复优先级原则

1. **铁律违反 > 功能缺失 > 体验优化**：铁律是安全底线，必须最先修
2. **前端可独立修的先修**：不依赖后端新 API 的前端修复立即执行
3. **与全栈计划 Sprint 对齐**：需要后端配合的修复，嵌入对应 Sprint
4. **设计系统合规强制**：所有新增/修改的 UI 代码必须通过 `.cursor/rules/ui-design-system.mdc` 中的 Section 9 合规检查清单。Cursor Rule 已设为 `alwaysApply: true`，AI 编码时自动加载。

### 已完成的设计系统修复（前置）

| 修复项 | 状态 |
|--------|------|
| Cursor Rule `alwaysApply` 改为 `true` | ✅ 已完成 |
| 补齐 `--accent-rgb` 变量（`:root` + `:root.dark` + 全部 8 个主题引擎） | ✅ 已完成 |
| 补齐所有主题引擎缺失的 `--text-tertiary`、`--accent-hover`、`--warning`、`--border` | ✅ 已完成 |
| `globals.css` 中硬编码颜色替换为 `color-mix()` / `var()` | ✅ 已完成 |
| Cursor Rule 新增 Section 9 合规检查清单 | ✅ 已完成 |

---

## 研究洞察：技术选型与架构决策

> 以下内容来自 3 个并行研究 Agent + 1 个性能分析 Agent 的综合结论。

### 架构决策：路由按角色分组

**必须在 Phase 0 开始前完成。** 使用 Next.js App Router 的 route groups 隔离各角色的代码：

```
app/
├── (admin)/          ← System Admin 专属
│   ├── layout.tsx    ← AdminSidebar + Platform View
│   └── admin/
│       ├── platform/
│       ├── tenants/
│       ├── knowledge/
│       ├── agent-monitor/
│       └── isolation-audit/
├── (tenant)/         ← Tenant Admin 专属
│   ├── layout.tsx    ← TenantSidebar
│   ├── dashboard/
│   └── settings/
├── (operator)/       ← Operator 专属
│   ├── layout.tsx    ← OperatorSidebar + Inbox badge
│   ├── inbox/
│   ├── products/
│   ├── platforms/
│   └── ads/
├── (supplier)/       ← Supplier 专属（极简）
│   └── supplier/[token]/
└── (viewer)/         ← Viewer 专属（零操作）
    └── reports/
```

**收益：** 各角色的 JS bundle 完全隔离，Supplier 页面不加载 Operator 的图表库。

**关键约束（Round 2 Next.js 研究 Agent）：**
- **必须保持单根布局**：`app/layout.tsx` 是唯一的 `<html>` + `<body>` 根布局。如果每个路由组各自有根布局，跨组导航会触发全页面重载（非 SPA 体验）。
- **路径前缀避免冲突**：`(admin)/dashboard` 和 `(tenant)/dashboard` 都解析为 `/dashboard`，会冲突。当前计划已正确使用 `/admin/*` 前缀。
- **共享组件放在 `app/_shared/` 或 `components/`**：下划线前缀目录不会被 Next.js 当作路由。webpack `splitChunks` 会自动将共享组件提取到公共 chunk。
- **并行路由（Parallel Routes）可用于仪表盘**：`@metrics`、`@alerts` 等 slot 可在路由组内独立加载/错误处理。每个 slot 必须有 `default.tsx`。
- **旧路由重定向用 `next.config.ts` redirects**（静态、无运行时开销），角色动态重定向用 Middleware。

### 技术选型：关键库

| 用途 | 推荐库 | 大小 (gzip) | 理由 |
|------|--------|------------|------|
| 卡片滑动手势 | Motion (motion/react) | ~32KB | 内置 drag + 动画一体化，`dragDirectionLock` 防误触 |
| Bottom Sheet | react-modal-sheet | ~8KB | 依赖 Motion，多档 snap points |
| 散点图/瀑布图 | visx (Airbnb) | ~15KB/模块 | tree-shakeable，只导入需要的模块 |
| 虚拟列表 | @tanstack/react-virtual | ~5KB | Platform Matrix 500+ 单元格虚拟化 |
| PDF/Excel 导出 | 服务端生成 | 0KB 前端 | 避免客户端冻结 UI |

### 性能目标（全局）

| 指标 | 目标 | 说明 |
|------|------|------|
| Operator Inbox LCP | < 1.2s (4G) / < 2.0s (3G) | 最高频页面 |
| Product Workspace Tab 切换 | < 300ms | 6 Tab 懒加载 |
| Platform Matrix 指标切换 | < 50ms (100 products) | useTransition + useMemo |
| Mobile 滑动 FPS | 60fps | CSS transform only |
| Supplier 页面 TTI | < 1.5s (slow 4G) | 极简 bundle < 50KB |
| 主题切换 FOUC | 0ms | `<head>` 内联脚本 |
| SSE 连接数 | ≤ 1 per browser tab | 单连接多路复用 |

### 性能优先行动（P0，必须在 Sprint 3b 前完成）

| # | 行动 | 影响 | 复杂度 |
|---|------|------|--------|
| 1 | 路由按角色分组（route groups） | 防止 bundle 膨胀 | 低 |
| 2 | SSE 单连接多路复用 + tenantId 分组 | 阻止 200+ 连接 CPU 飙升 | 中 |
| 3 | `<head>` 内联脚本消除主题 FOUC | 消除主题闪烁 | 低 |
| 4 | 重型组件 `dynamic()` import（图表、导出） | 首屏 JS 减少 200KB+ | 低 |
| 5 | `color-mix()` 添加 `@supports` fallback | Safari < 16.4 兼容 | 低 |

### AI 透明度 UX 规范

**置信度展示三色系统：**

| 范围 | 颜色 | 标签 | CSS Token |
|------|------|------|----------|
| ≥ 85% | `var(--success)` | High | 绿色背景 |
| 65-84% | `var(--warning)` | Medium | 橙色背景 |
| < 65% | `var(--danger)` | Low + ⚠️ | 红色背景 |

**OODA 推理链渐进式披露（最多 3 层）：**
1. **默认**：1 行摘要（"因为 CTR 下降 23% + 竞品降价 15%"）
2. **展开 Level 1**：Observe → Orient → Decide → Act 四步骤
3. **展开 Level 2**：每步骤的数据来源、样本量、时间范围

**拒绝反馈"教学式"文案：**
- 弹窗标题：`Help the Agent learn`（不是"拒绝原因"）
- 底部提示：`Your judgment trains the system — this feeds Layer 7 evolution`
- 每个枚举选项配 1 句说明，降低理解成本

**14 天结果闭环：**
- 执行 14 天后，系统推送新的 INFO 卡片到 Inbox
- 格式：`14 days ago you executed: [action]. Result: [metric] [change]`
- 包含指向原始决策的链接

### Mobile 手势规范

**Operator Inbox 滑动：**
- 使用 Motion 的 `drag="x"` + `dragDirectionLock`
- 滑动阈值：80px 位移 或 500px/s 速度
- 左滑（正方向）= 执行，背景渐变为 `var(--success)` 10%
- 右滑（负方向）= 拒绝，背景渐变为 `var(--danger)` 10%
- 拒绝后弹出 react-modal-sheet Bottom Sheet（snap points: [400, 200, 0]）

**触摸目标尺寸：**
- 标准页面：最小 48×48px
- Supplier 工业环境：最小 **56×56px**，间距 ≥ 12px
- 使用 `@media (any-pointer: coarse)` 检测触摸设备

**无障碍要求（WCAG 2.5.1）：**
- 所有滑动操作必须有等价的点击按钮替代
- 按钮始终可见（不是隐藏后长按才出现）

**Sidebar 响应式变换：**
- < 768px：底部 Tab Bar（固定 64px 高）
- ≥ 768px：可折叠侧边栏（72px 折叠 / 240px 展开）
- ≥ 1024px：固定侧边栏 240px

---

## 安全基线：Phase 0 必须同步交付（Round 2 安全审计结论）

> **来源：** Security Sentinel Agent 审计报告（18 个漏洞，4 Critical / 6 High / 5 Medium / 3 Low）
> **核心结论：** Phase 0 的前端修复必须与后端安全基线同步交付，否则系统处于 4-6 周安全真空期。

### 不可协商的 Day 1 安全交付物

| # | 交付物 | 严重程度 | 说明 |
|---|--------|---------|------|
| S-1 | 移除 FALLBACK_USER | CRITICAL | `auth-context.tsx` 中未认证用户默认为 operator，必须改为重定向 `/login` |
| S-2 | 后端 API 角色强制 | CRITICAL | 所有写操作端点添加 `requireRole()` 中间件，viewer 返回 403 |
| S-3 | MDM 路由 tenantId 修复 | HIGH | `mdm-primitives-routes.ts` 强制使用 `auth.tenantId`，禁止从 header/query 获取 |
| S-4 | 登录速率限制 | HIGH | 5 次失败/5 分钟 → 锁定 15 分钟 |
| S-5 | 生产环境 kill switch | CRITICAL | `NODE_ENV=production` 时 `AUTH_MODE=passthrough` 拒绝启动（启动时检查，非运行时） |
| S-6 | 移除硬编码 demo 密码 | MEDIUM | `DEMO_PASSWORD = 'harness123'` 从前端代码移除 |
| S-7 | 开发默认密钥检查 | MEDIUM | 包含 "dev" 或 "change-me" 的密钥在生产环境拒绝启动 |
| S-8 | Supplier Token 安全 | CRITICAL | 256 位随机 + 90 天过期 + 撤销 API + 访问日志 + rate limiting |
| S-9 | 铁律后端强制 | HIGH | 5 条铁律全部在 API 层实施对应中间件（见下表） |

### 铁律后端强制执行清单

| 铁律 | API 层实施 |
|------|-----------|
| #1 Operator 拒绝必须选原因 | `POST /approvals/:id/reject` 校验 `rejectionReason` 非空 |
| #2 Agent Authority 不可跳过 | 新 Agent 能力默认 `BLOCK`，`POST /agent-authority` 校验 level 合法性 |
| #3 System Admin 不看租户数据 | `system_admin` 角色的所有业务 API 响应经过脱敏中间件 |
| #4 Supplier 双重隔离 | `supplier` 角色的所有 API 响应经过 `stripSensitiveFields` 中间件 |
| #5 Viewer 零操作 | `viewer` 角色的所有 POST/PUT/DELETE 返回 403 |

### Next.js 三层安全防御架构（Round 2 研究结论）

```
┌─────────────────────────────────────────────┐
│  Layer 1: Middleware（粗粒度路由守卫）         │
│  → 使用 jose 库验证 JWT（Edge Runtime 兼容）  │
│  → 角色-路由映射表快速拦截                     │
│  → CVE-2025-29927 防护：拦截 x-middleware-subrequest │
├─────────────────────────────────────────────┤
│  Layer 2: Server Component / Server Action    │
│  → 细粒度权限校验（数据级别）                   │
│  → 二次校验 role + tenantId                   │
├─────────────────────────────────────────────┤
│  Layer 3: Database（PostgreSQL RLS）          │
│  → tenantId 强制注入                          │
│  → Sprint 0 即启用核心表 RLS                  │
└─────────────────────────────────────────────┘
```

**关键：** 必须使用 `jose` 库（不是 `jsonwebtoken`），因为 Next.js Middleware 运行在 Edge Runtime，不支持 Node.js `crypto` 模块。

---

## 统一组件模式（Round 2 模式分析结论）

> **来源：** Pattern Recognition Agent 分析报告
> **核心结论：** 当前计划有 4 种分散的 Guard 机制和多处重复模式，需要统一。

### 共享组件清单

| 组件 | 文件 | 用途 | 使用位置 |
|------|------|------|---------|
| `RoleGuard` | `components/guards/role-guard.tsx` | 统一角色守卫，替代散落的 `if (role === ...)` | 所有页面 |
| `IronLawBanner` | `components/banners/iron-law-banner.tsx` | 铁律视觉提示条，按 `lawId` 枚举 | 所有角色页面 |
| `ConfidenceBadge` | `components/ui/confidence-badge.tsx` | 置信度三色展示 + 样本量 + 数据新鲜度 | Inbox、Dashboard、Product Workspace |
| `InteractionTag` | `components/ui/interaction-tag.tsx` | AUTO/REQUIRED 标签 | 所有交互点 |
| `AgentSuggestionCard` | `components/agent/agent-suggestion-card.tsx` | 通用 Agent 建议卡片（置信度+操作+OODA 入口） | Inbox、Dashboard、Product Workspace |
| `DataState` | `components/ui/data-state.tsx` | 统一 loading/error/empty/"数据接入中" 状态 | 所有数据展示 |
| `AccessDenied` | `components/ui/access-denied.tsx` | 403 页面 | RoleGuard fallback |

### Guard 职责分离

```
RoleGuard     → 权限控制（谁可以访问）
IronLawBanner → UI 提示（为什么这样限制）
ViewerGuard   → 防御性编程（拦截 Viewer 的写操作 fetch）
Middleware    → 路由级守卫（服务端，最早拦截）
```

### 组合模式替代 role prop（架构 Agent 建议）

```tsx
// 不推荐：role prop 分支
<Dashboard role="tenant_admin" />
<Dashboard role="viewer" />

// 推荐：页面级组合
// (tenant)/dashboard/page.tsx
<DashboardShell>
  <KPIRow data={data} />
  <ProductHealthMatrix data={data} />
  <NeedsAttention items={items} />  {/* Tenant Admin 独有 */}
</DashboardShell>

// (viewer)/reports/page.tsx
<DashboardShell>
  <KPIRow data={data} />
  <ProductHealthMatrix data={data} />
  <AIEfficiency data={data} />       {/* Viewer 独有 */}
  <ExportReports />                   {/* Viewer 独有 */}
</DashboardShell>
```

### 命名规范

```
文件命名：kebab-case（components/iron-law-banner.tsx）
组件导出：PascalCase（export function IronLawBanner）
工具函数：camelCase，动词开头（filterSupplierFields）
Context：  *-context.tsx，导出 *Provider + use*
Guard 类：  *-guard.tsx，导出 *Guard
Banner 类：*-banner.tsx，导出 *Banner
```

### 拒绝原因枚举去重

```typescript
// lib/constants/reject-reasons.ts（共享模块）
export const REJECTION_REASONS = [
  { id: 'market_judgment', label: '市场判断不同', hint: '你了解到 Agent 未掌握的市场信息' },
  { id: 'bad_timing', label: '时机不对', hint: '当前不是执行此操作的最佳时机' },
  { id: 'inaccurate_data', label: '数据不准', hint: 'Agent 依据的数据可能过时或不完整' },
  { id: 'too_risky', label: '风险太高', hint: '潜在损失超出你的风险承受范围' },
  { id: 'other', label: '其他', hint: '请在下方补充具体原因' },
] as const;
```

`app/page.tsx` 和 `approvals-dashboard.tsx` 均从此模块导入，消除重复。

---

## SSE 完整架构（Round 2 研究结论）

> **来源：** SSE Multiplexing Agent 研究报告
> **核心结论：** 使用 `@microsoft/fetch-event-source` + PostgreSQL LISTEN/NOTIFY + Tenant-Scoped EventEmitter。

### 架构总览

```
浏览器标签页
┌──────────────────────────────────────────────┐
│  useRoleSSE() hook                           │
│    └─ 1 个 fetch-event-source 连接            │
│        ├─ event: health     → setQueryData    │
│        ├─ event: alerts     → invalidateQueries│
│        ├─ event: inbox:new  → invalidateQueries│
│        ├─ event: freshness  → setQueryData    │
│        └─ event: attention  → setQueryData    │
└──────────────────────────────────────────────┘
                    │ HTTP/2 (单 TCP 连接)
                    ▼
Next.js Route Handler: /api/sse/stream
┌──────────────────────────────────────────────┐
│  runtime = 'nodejs' (非 Edge)                 │
│  1. JWT 验证 → 提取 tenantId + role           │
│  2. 注册到 TenantEventManager                 │
│  3. ReadableStream 推送（角色过滤）             │
│  4. 心跳保活 (30s)                            │
│  5. Last-Event-ID 恢复（补发最多 5 分钟）      │
└──────────────────────────────────────────────┘
                    │ EventEmitter (per tenant)
                    ▼
PostgreSQL LISTEN/NOTIFY → TenantEventManager
```

### 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| SSE vs WebSocket | **SSE** | 纯单向推送，自动重连，HTTP/2 友好 |
| 原生 EventSource vs fetch-event-source | **@microsoft/fetch-event-source** | 支持自定义 header（JWT）、指数退避、页面可见性感知 |
| 重连策略 | 指数退避 + 抖动（1s → 30s max） | 防止雷群效应 |
| 租户隔离 | 三层：JWT → Tenant Emitter → Role Filter | 防止跨租户数据泄漏 |
| React 集成 | SSE 驱动 React Query 缓存失效 | 避免轮询，实时更新 |
| 心跳 | 30 秒间隔 SSE 注释 | 防止代理/LB 断开空闲连接 |
| 消息补偿 | Last-Event-ID + 事件持久化 | Operator 断线后不丢失待办（架构 Agent P0 建议） |

### 事件命名规范

| 事件类型 | 命名 | 目标角色 |
|---------|------|---------|
| 平台健康 | `health` | System Admin |
| 系统告警 | `alert:fired` / `alert:resolved` | System Admin |
| 待办卡片 | `attention:new` / `attention:resolved` | Tenant Admin |
| Inbox 项目 | `inbox:new` / `inbox:updated` | Operator |
| 14 天结果 | `outcome:ready` | Operator |
| 数据新鲜度 | `freshness` | 所有角色 |

### SSE 演进路线图（架构 Agent 建议）

```
Sprint 0-4（<200 租户）：PostgreSQL LISTEN/NOTIFY → TenantEventManager → SSE
Sprint 5-8（200-1000 租户）：引入 Redis Pub/Sub 替代 LISTEN/NOTIFY
1000+ 租户：独立 SSE Gateway 服务，与 API 解耦
```

---

## Phase 0：铁律紧急修复（前端独立，不依赖后端）

> **预计工期：2-3 天**
> **目标：** 5 条铁律在前端层面全部强制
> **⚠️ 必须与安全基线（S-1 到 S-9）同步交付**

### 0.1 System Admin 数据隔离 + 路由重构（前端层）

**当前问题：**
- `tenant-context.tsx`：System Admin 可通过租户切换器访问任意租户的全部业务数据
- `sidebar-nav.tsx`：System Admin 可访问 Product Assets、Profit Report 等业务页面
- `/ops` 页面：显示租户公司名但无健康评分/风险标记
- 路由结构扁平（`/ops`、`/knowledge`），需迁移到 `/admin/*`

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `components/tenant-context.tsx` | System Admin 角色禁用租户切换器，显示为"Platform View" |
| 2 | `components/sidebar-nav.tsx` | System Admin 菜单重构为 5 项：Platform Operations (`/admin/platform`)、Tenant Management (`/admin/tenants`)、Knowledge Layers (`/admin/knowledge`)、Agent Monitor (`/admin/agent-monitor`)、Isolation Audit (`/admin/isolation-audit`)。移除所有业务页面访问 |
| 3 | 新建 `app/admin/platform/page.tsx` | 飞机驾驶舱布局：6 个 StatBadge 健康指标行 + 三级告警中心 + 进化追踪面板（品类×市场覆盖度表） |
| 4 | 新建 `app/admin/tenants/page.tsx` | 租户列表 + 健康评分（三维复合）+ 风险标记 + 详情展开（订阅/用量/违规） |
| 5 | 重构 `app/knowledge/page.tsx` → `app/admin/knowledge/page.tsx` | Layer A 表格（Domain/Platform/Market/Confidence/Valid Until + Edit）+ Layer B 蒸馏队列卡片 |
| 6 | 新建 `app/admin/agent-monitor/page.tsx` | Agent 执行仪表盘 + 租户级健康度（匿名化）+ Circuit Breaker 状态 + Kill Switch |
| 7 | 新建 `app/admin/isolation-audit/page.tsx` | RLS 策略覆盖率 + 字段隔离验证 + 跨租户泄露检测 + 自动化测试报告 |
| 8 | 旧路由 redirect | `/ops` → `/admin/platform`，`/knowledge` → `/admin/knowledge`，`/harness` → `/admin/platform` |
| 9 | 所有业务数据页面 | 添加 `if (role === 'system_admin')` 守卫，返回 403 |

**验证：**
```
登录 system_admin → sidebar 仅显示 5 个 /admin/* 菜单
→ /admin/platform 显示 6 个 StatBadge 健康指标 + 告警 + 进化追踪
→ /admin/tenants 显示租户列表（含健康评分和风险标记）
→ /admin/knowledge 显示 Layer A 表格 + Layer B 蒸馏队列
→ /admin/agent-monitor 显示 Agent 执行全景 + Circuit Breaker
→ /admin/isolation-audit 显示 RLS 覆盖率 + 隔离验证
→ 直接访问 /products 返回 Access Denied
→ 租户切换器显示 "Platform View"
```

### 0.2 Supplier 字段隔离（前端层）

**当前问题：**
- Supplier 可通过 sidebar 访问 Product Assets 页面，看到完整产品信息
- 无任何字段条件渲染

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `components/sidebar-nav.tsx` | Supplier 的可见菜单收缩为：Purchase Orders 仅此一项（后续加交期日历、质检反馈） |
| 2 | 新增 `components/field-filter.tsx` | 前端字段过滤工具函数：`filterSupplierFields(data)` 递归移除 `costPrice, msrp, profitMarginPct, sales, normalizedRoas, acos, spend, tacos` 等字段 |
| 3 | `app/purchase/page.tsx` | 确认 PO 卡片中不渲染售价/利润字段（当前 mock 数据需检查） |

**验证：**
```
登录 supplier → sidebar 仅显示 Purchase Orders
→ PO 卡片中无售价/利润/ACOS 字段
→ 直接访问 /products 返回 Access Denied
```

### 0.3 Viewer 零操作强制

**当前问题：**
- Viewer 可通过 sidebar 访问 Evolution Engine 等页面，可能包含操作按钮
- 未严格验证所有可访问页面是否零操作

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `components/sidebar-nav.tsx` | Viewer 可见菜单收缩为：GDO Command Center（首页经营大屏）、Executive Dashboard、Evolution Engine（只读） |
| 2 | `app/page.tsx` | Viewer 首页（Executive Dashboard 分支）确认无任何操作按钮 |
| 3 | 新增 `components/viewer-guard.tsx` | 包裹 Viewer 可访问的页面，拦截所有 POST/PUT/DELETE fetch 调用（防御性编程） |

**验证：**
```
登录 viewer → 所有可见页面无编辑/删除/确认/拒绝按钮
→ 浏览器 Network tab 中无 POST/PUT/DELETE 请求
```

### 0.4 Operator 拒绝原因对齐

**当前问题：**
- 拒绝原因枚举与设计文档不一致（现有 6 个 vs 设计 5 个）
- 缺少「你的判断将帮助 Agent 在未来做出更好的决策」提示语

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/page.tsx` | `REJECT_REASONS` 对齐为设计文档的 5 个：市场判断不同 / 时机不对 / 数据不准 / 风险太高 / 其他 |
| 2 | `components/approvals-dashboard.tsx` | `REJECTION_REASONS` 同步对齐 |
| 3 | 两处拒绝弹窗 | 标题改为 `Help the Agent learn`，底部添加提示语：`Your judgment trains the system — this feeds Layer 7 evolution` |
| 4 | 每个枚举选项 | 配 1 句说明降低理解成本（如"市场判断不同 — 你了解到 Agent 未掌握的市场信息"） |

**AI 透明度 UX 增强（研究 Agent 建议）：**
- 拒绝弹窗不使用"拒绝原因"等负面措辞，改用"教学式"语气
- 弹窗底部显示历史统计："你的反馈已帮助 Agent 在 X 个类似场景中提升了 Y% 准确率"
- 拒绝后立即显示 toast："Feedback recorded. You'll see the outcome in 14 days."

### 0.5 Agent 授权中心标记

**当前问题：**
- `/agent-auth` 数据存 localStorage，无后端持久化

**前端可做的修复（后端在 Sprint 3b 配合）：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/agent-auth/page.tsx` | 页面顶部添加醒目警告：「⚠️ 授权配置当前存储在本地，后端持久化将在后续版本实现」 |
| 2 | 同上 | 确保所有能力默认状态为 disabled（检查 localStorage 初始化逻辑） |

### 0.6 铁律视觉强制（全角色）

**当前问题：** 铁律仅在后端/逻辑层强制，UI 层无持续可见的视觉提醒。

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | 新增 `components/iron-law-banner.tsx` | 通用铁律提示条组件：橙色/琥珀色（`var(--warning)` + 15% 透明混合背景），左侧 3px 实色边框，不可关闭，`⚠` 前缀 |
| 2 | Inbox 卡片组件 | 每张含 Reject 按钮的卡片旁添加：`⚠ Reject requires reason selection — feeds Layer 7 evolution` |
| 3 | `/settings/agent-authority` | 页面顶部添加：`⚠ New agent capabilities default to BLOCK — explicit authorization required` |
| 4 | 所有 `/admin/*` 页面 | 顶部添加：`⚠ Tenant business data is isolated — only aggregate metrics visible` |
| 5 | `/supplier/{token}` | 顶部添加：`⚠ Pricing and margin data is restricted — supplier view only` |
| 6 | `/reports` | 顶部添加：`⚠ Read-only view — no actions available` |

**验证：**
```
每个角色登录 → 对应铁律提示条可见
→ 提示条不可关闭/隐藏
→ 提示条使用 var(--warning) 色系
→ Inbox Reject 按钮旁有 Layer 7 提示
```

### 0.7 交互规格四字段标准化

**当前问题：** 现有交互规格描述不统一，缺少触发条件和 AUTO 标签。

**修复清单：**

| # | 修改 |
|---|------|
| 1 | 所有 AUTO 交互（如 14-day outcome push、cost profile auto-save）在 UI 中使用绿色 `AUTO` 标签 |
| 2 | 所有需要用户操作的交互在 UI 中无标签（默认） |
| 3 | 所有 REQUIRED 交互（如 reject reason）使用橙色 `REQUIRED` 标签 |

---

## Phase 1：神经接口核心体验（与全栈 Sprint 0-1 对齐）

> **预计工期：1 周**
> **依赖：** 全栈计划 Sprint 0 的 AuthContext + ScopeContext

### 1.1 Operator 首页待办卡片增强

**当前问题：**
- 待办卡片缺少置信度、样本量、数据时间范围
- 排序无紧急/普通/建议分级

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/page.tsx` (Operator 分支) | 待办卡片增加置信度展示区域（当 API 返回 confidence 字段时显示，否则显示"置信度: 计算中"） |
| 2 | 同上 | 待办卡片增加依据区域（样本量 + 数据时间范围，从 `reasoningLog` 中提取） |
| 3 | 同上 | 待办列表按优先级分组：🔴 紧急 / 🟡 普通 / 🟢 建议（基于 `riskScore` 字段） |
| 4 | 同上 | 低置信度（< 0.6）待办卡片添加 ⚠️ 标记 |

**置信度展示规范（研究 Agent 建议）：**

```
置信度三色系统：
  ≥ 85%  → var(--success) 绿色背景 + "High" 标签
  65-84% → var(--warning) 橙色背景 + "Medium" 标签
  < 65%  → var(--danger)  红色背景 + "Low ⚠️" 标签 + 额外提示

置信度旁显示上下文：
  "82% (based on 47 similar cases)"
  "34% (early stage — only 12 cases) ⚠️"

数据新鲜度标签：
  < 1h   → "Live"（绿色）
  1-24h  → "X hours ago"（默认色）
  > 24h  → "Stale: X days ago"（橙色 + 警告图标）
```

### 1.2 OODA 推理链接入待办卡片

**当前状态：** `sovereign-governance-insight.tsx` 已有 OODA 可视化，但未接入首页待办卡片。

**修复清单：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/page.tsx` (Operator 分支) | 每条待办卡片增加「查看推理过程」展开按钮 |
| 2 | 同上 | 展开后渲染 `<SovereignGovernanceInsight>` 组件，传入该条待办的 `reasoningLog` |

**OODA 渐进式披露规范（研究 Agent 建议）：**

```
Level 0（默认）：1 行摘要
  "因为 CTR 下降 23% + 竞品降价 15%"

Level 1（点击"查看推理过程"）：四步骤
  Observe: "过去 7 天 CTR 从 4.2% 降至 3.2%，同品类竞品均价下降 15%"
  Orient:  "结合历史数据，CTR 下降 + 竞品降价通常导致 2 周内销量下滑 20-30%"
  Decide:  "建议降价 8% 以维持竞争力，预计利润率从 22% 降至 16%"
  Act:     "调整 Amazon US 售价 $29.99 → $27.59"

Level 2（点击某步骤"查看详情"）：数据来源
  "数据来源：Amazon SP-API · 样本量：47 个同品类 ASIN · 时间范围：2026-02-15 至 2026-03-01"
```

**实现要点：**
- 使用 `<details>` 或 `Disclosure` 组件实现折叠
- Level 1 和 Level 2 使用 `dynamic()` 懒加载，不影响首屏 LCP
- 每个步骤使用对应 Harness 层的主题色标记

### 1.3 Viewer 首页 AI 效能数据结构

**当前问题：** Executive Dashboard 有 `agentStats` 但全是 mock。

**修复清单（结构先行，数据后接）：**

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/page.tsx` (Viewer 分支) | AI 效能报告区域重构为设计文档的 5 项结构：节省广告费 / 提升销售额 / 节省人工时间 / 拦截风险操作 / 决策准确率 |
| 2 | 同上 | 每项带具体操作次数（"优化了 N 次出价"） |
| 3 | 同上 | 数据源标记：当 API 未就绪时显示"数据接入中"而非假数字 |

**投资人视角 AI 效能展示规范（研究 Agent 建议）：**

```
核心指标（首屏大字体）：
  "运营效率提升 X%"  ← 与使用前对比，最直观的投资价值
  "Agent 建议执行率 X%"
  "系统自动处理 X 个操作/月（折算节省 X 人工时）"

辅助指标（下方卡片）：
  节省广告费: "$X,XXX/月 (优化了 N 次出价)"
  提升销售额: "+$X,XXX/月 (N 次定价建议)"
  拦截风险操作: "X 次 (避免预估损失 $X,XXX)"
  决策准确率: "X% (基于 14 天结果回溯)"

数据可信度标注：
  每个指标旁显示 "Based on X months of data"
  不足 3 个月的指标标注 "Early estimate — will stabilize with more data"
```

---

## Phase 2：角色化视图重构（与全栈 Sprint 3a/3b 对齐）

> **预计工期：2 周**
> **依赖：** 全栈计划 Sprint 3a 的 JWT 认证 + Sprint 3b 的 FieldFilter

### 2.1 System Admin 专属视图

**当前问题：** `/ops`、`/harness`、`/knowledge` 页面存在但数据全 mock，且未做数据隔离。
**路由重构：** 所有 System Admin 页面迁移到 `/admin/` 路径下。使用 `(admin)` route group 隔离 bundle。

| # | 旧路由 | 新路由 | 修改 |
|---|--------|--------|------|
| 1 | `/ops` | `/admin/platform` | 重构为飞机驾驶舱布局：6 个 StatBadge 健康指标行（Active Tenants/Agent Executions/Avg Confidence/Error Rate/Layer B Patterns/API P95 Latency）+ 三级告警中心 + 进化追踪面板（品类×市场覆盖度） |
| 2 | `/harness` | 合并入 `/admin/platform` | 7 层健康度作为进化追踪面板的子模块 |
| 3 | `/knowledge` | `/admin/knowledge` | 拆分为 Layer A 表格（Domain/Platform/Market/Confidence/Valid Until + Edit）+ Layer B 蒸馏队列卡片（模式描述+置信度+样本量+Approve/Review） |
| 4 | 无 | `/admin/tenants` | 新建租户管理页：列表 + 健康评分（三维复合）+ 风险标记 + 详情展开 |
| 5 | 无 | `/admin/agent-monitor` | **新建** Agent 监控：全局执行仪表盘 + 租户级健康度（匿名化）+ Circuit Breaker 状态 + Kill Switch |
| 6 | 无 | `/admin/isolation-audit` | **新建**隔离审计：RLS 策略覆盖率 + 字段隔离验证 + 跨租户泄露检测 + 自动化测试报告 |
| 7 | 旧路由 | 设置 redirect | `/ops` → `/admin/platform`，`/knowledge` → `/admin/knowledge` |

**性能优化（性能 Agent 建议）：**
- `/admin/platform` 的 SSE 实时数据使用单连接多路复用：一个 EventSource 连接，服务端按 `event: health`, `event: alerts`, `event: evolution` 分类推送
- 进化追踪面板的散点图使用 `visx` 而非 recharts，tree-shake 后仅加载 `@visx/xychart` + `@visx/tooltip`（~15KB vs recharts 全量 ~60KB）
- `/admin/tenants` 列表超过 100 行时启用 `@tanstack/react-virtual` 虚拟滚动
- Layer B 蒸馏队列使用分页（每页 20 条），不一次性加载全部

### 2.2 Tenant Admin 专属视图

| # | 路由 | 页面 | 修改 |
|---|------|------|------|
| 1 | `/dashboard` | Overview（经营全景看板） | 4 个 StatBadge（TRUE PROFIT/MARGIN/GMV/VS LAST MONTH）+ 元信息行（Updated Xh ago · N platforms · confidence X%）+ 产品健康散点图（⭐Star/🚀Rising/⚠️Drain/💡Potential 四象限+计数）+ Needs Your Attention 三级卡片（CRITICAL/WARNING/INFO+置信度+操作按钮）。与 Viewer 共享组件 `role` prop |
| 2 | `/settings/agent-authority` | Agent Authority（授权中心） | 从 localStorage 迁移到后端 API（Sprint 3b）。五级授权（AUTO/CONFIRM/DRAFT/BLOCK/2FA REQUIRED），执行规则表（Action+Range+Level+Config），locked 规则不可降级。Execution Log（时间+Agent 名称+级别+操作摘要+结果反馈） |
| 3 | `/products/costs` | Cost Profiles（成本档案） | Data Freshness Status 表（Product+COGS/unit+Last Updated+Status: OK/STALE/MISSING）。6 字段录入表单（COGS per unit/Inbound shipping/FBA fee/Platform fee/Return rate/Target margin）。Sidebar badge 显示 stale+missing 数。敏感性分析 + Excel 批量导入 |
| 4 | `/settings/integrations` | 平台与渠道对接 | 四个 Tab：① Marketplaces（Amazon/Walmart/Shopify/TikTok/Wayfair）② 3PL（ShipBob/Deliverr/自有仓）③ WMS 仓库（FBA Inbound/海外仓/中转仓，含库存分布地图+库龄分析）④ ERP（NetSuite/SAP/QuickBooks/金蝶用友，含字段映射+冲突规则+同步日志）。全局：连接健康监控 + Token 过期预警 + 断连影响分析 + 同步异常自动重试。**现有 `settings-integrations.tsx` 已有四 Tab 基础框架** |
| 5 | `/settings/team` | 团队权限管理 | 成员列表（姓名/角色/负责范围/最后登录）+ 邀请新成员。预设角色（运营专员/广告优化师/仓储专员/财务只读）+ 自定义角色（按模块勾选权限 + 数据范围限定） |

**性能优化（性能 Agent 建议）：**
- `/dashboard` 产品健康散点图使用 `visx` 的 `@visx/xychart`，支持 200+ 产品点的交互式散点图
- 散点图数据量 > 500 时启用 canvas 渲染模式（`visx` 支持 SVG/Canvas 双模式）
- Needs Your Attention 卡片使用 SSE 实时推送，与 `/admin/platform` 共享同一个 SSE 连接（不同 `event` 类型）
- `/products/costs` 的 Excel 批量导入使用 Web Worker 解析，避免主线程阻塞
- `/settings/integrations` 的四个 Tab 使用 `React.lazy()` + `Suspense`，切换时按需加载

**Agent Authority 迁移策略：**
```
Phase 1（当前）：localStorage 存储 + 页面顶部警告
Phase 2（Sprint 3b）：后端 API 就绪后
  1. 读取 localStorage 现有配置
  2. 一次性迁移到后端（POST /api/agent-authority/migrate）
  3. 迁移成功后清除 localStorage
  4. 移除页面警告
  5. 所有后续读写走后端 API
```

### 2.3 Operator 四大工作台重构

**当前问题：** 无 `/inbox` 智能待办中心；`/products` 是网格卡片无六 Tab；无 `/platforms` 跨平台矩阵；无 `/ads` 广告中心。

| # | 路由 | 页面 | 修改 |
|---|------|------|------|
| 1 | `/inbox` | Inbox（智能待办中心） | **新建**。Sidebar badge 显示待处理数。三级卡片（CRITICAL/WARNING/INFO），每张含 Agent 名称+时间戳+置信度+上下文操作按钮。Reject 旁显示 `⚠ feeds Layer 7 evolution`。新增 14-day outcome push（执行后自动推送结果反馈） |
| 2 | `/products` | Products（产品列表） | 保留为产品列表（网格/表格切换），点击进入详情页 |
| 3 | `/products/{id}` | Product Workspace | **新建**。Sticky header（产品名+生命周期标签 LAUNCH/GROWTH/MATURE/DECLINE+Health 评分 0-100+inbox items 数+4 个 StatBadge: PROFIT/MO, MARGIN, ROAS, STOCK DAYS）+ 六 Tab: Profit(waterfall+RCA) · Channels(per-platform) · Ads(ROAS+A/B) · Supply Chain(PO draft) · Social(calendar+KOL) · After-Sales(review clusters+V2) |
| 4 | `/platforms` | Platform Matrix | **新建**。行=产品 列=平台，指标切换+颜色编码，跨平台洞察（Agent 生成） |
| 5 | `/ads` | Ads（广告中心） | **新建**。跨产品广告全局视图：总花费+综合 ROAS+平台贡献占比+Agent 广告建议批量操作 |
| 6 | 现有 `product-profile-view.tsx` | — | 复用 DNA 数据作为产品工作台 Profit Tab 的基础 |

**性能优化（性能 Agent 建议）：**

**Inbox 内存管理：**
- 14 天历史数据累积可导致内存泄漏
- 实现 LRU 缓存：最多保留最近 200 条卡片在内存中
- 超过 200 条时，旧卡片从 DOM 移除但保留 ID 列表（滚动到底部时按需加载）
- 使用 `IntersectionObserver` 实现无限滚动分页

**Product Workspace 六 Tab 懒加载：**
```
Tab 加载策略：
  - 首次进入：只加载 Profit Tab（默认 Tab）
  - 其他 5 个 Tab 使用 dynamic() + Suspense
  - Tab 切换时显示骨架屏（skeleton），目标 < 300ms
  - 已加载的 Tab 缓存在内存中，切回时不重新请求

代码拆分：
  - Profit Tab 的 waterfall chart → dynamic(() => import('@visx/shape'))
  - Supply Chain Tab 的 PO 邮件编辑器 → dynamic(() => import('./po-editor'))
  - Social Tab 的日历组件 → dynamic(() => import('./content-calendar'))
  - After-Sales Tab 的聚类图 → dynamic(() => import('./review-clusters'))
```

**Platform Matrix 虚拟化：**
- 100+ 产品 × 5+ 平台 = 500+ 单元格
- 使用 `@tanstack/react-virtual` 虚拟化行
- 指标切换使用 `useTransition` 避免阻塞交互
- 颜色编码计算使用 `useMemo` + 均值预计算

**14-day outcome push 实现：**
```
执行时：
  1. 记录 {actionId, executedAt, metric_snapshot} 到 experience 表
  2. 创建 scheduled_push 记录（executedAt + 14 days）

14 天后：
  1. 后端 cron job 检查到期的 scheduled_push
  2. 查询当前 metric 与 snapshot 对比
  3. 生成 INFO 级别 Inbox 卡片
  4. 通过 SSE 推送到前端
  5. 卡片包含指向原始决策的 deep link
```

### 2.4 Supplier 专属视图

**路由变更：** 从 `/purchase` 迁移到 `/supplier/{token}`（无需注册，专属链接访问）

| # | 路由 | 修改 |
|---|------|------|
| 1 | `/supplier/{token}` | **新建**供应商门户单页面：待报价需求（产品规格+数量+交期+认证要求，在线报价表单）+ 进行中订单（进度更新+质检上传+直接消息） |
| 2 | 同上 | UI 层强制数据隔离：组件代码中不存在 price/margin/profit/sales/platform 等字段的渲染逻辑 |
| 3 | 同上 | 后端 FieldFilter 中间件就绪后（Sprint 3b），接入 API 层字段过滤（双重隔离） |
| 4 | `/purchase` | 旧路由 redirect → `/supplier/{token}` |

**性能优化（性能 Agent 建议）：**
- Supplier 页面 bundle 目标 < 50KB（gzip），不加载任何图表库
- 使用独立的 `(supplier)` route group，不加载 Operator/Admin 的任何组件
- 质检报告上传使用 `presigned URL` 直传 S3，不经过 Next.js 服务端
- 页面 TTI 目标 < 1.5s（slow 4G），使用 `<link rel="preload">` 预加载关键字体

**Mobile 工业环境适配（研究 Agent 建议）：**
- 所有触摸目标 ≥ 56×56px（工厂环境可能戴手套）
- 间距 ≥ 12px 防误触
- 使用 `@media (any-pointer: coarse)` 检测触摸设备并自动放大目标
- 进度更新使用大号滑块（thumb 48px）而非小输入框
- 报价表单使用 `inputmode="decimal"` 触发数字键盘

### 2.5 Viewer 专属视图

**路由变更：** 从多页面（经营大屏 + 趋势分析 + 品牌健康度）合并为单页面 `/reports`

| # | 路由 | 修改 |
|---|------|------|
| 1 | `/reports` | **新建**高管看板单页面：核心 KPI 首屏（利润/利润率/GMV/目标完成率 + MoM/YoY + 数据截至时间）+ 经营健康矩阵（品类饼图+市场对比+产品健康分布）+ AI 系统效能（执行率/置信度/人工时节省/效率提升）+ 可导出报告（PDF/Excel/AI 效能报告） |
| 2 | 同上 | 与 Tenant Admin `/dashboard` 共享数据组件，通过 `role` prop 切换：无"需要你关注"、无待确认链接、新增 AI 效能和导出 |
| 3 | 同上 | 严格零操作：无 POST/PUT/DELETE，无按钮/表单/输入框，仅允许导出和下钻 |
| 4 | 旧路由 | Executive Dashboard / 趋势分析 / 品牌健康度 redirect → `/reports` |

**性能优化（性能 Agent 建议）：**
- PDF/Excel 导出必须在服务端生成（客户端生成会冻结 UI 5-15 秒）
- 实现方案：`POST /api/reports/export` → 服务端生成 → 返回 presigned URL → 前端下载
- 导出按钮点击后显示进度条（SSE 推送生成进度），不阻塞页面交互
- 品类饼图和市场对比图使用 `visx`，数据量小（< 20 品类）无需虚拟化
- 页面数据使用 `stale-while-revalidate` 策略：首次加载用缓存，后台刷新

**30 秒原则验证清单：**
```
Viewer 打开 /reports 后 30 秒内必须能获取：
  0-2s:  首屏 KPI 数字加载完成（利润/利润率/GMV）
  2-5s:  经营健康矩阵图表渲染完成
  5-10s: AI 效能数据加载完成
  10s+:  用户可以开始下钻或导出

如果任何步骤超时，显示骨架屏 + "数据加载中" 而非空白
```

---

## Phase 3：Mobile 适配 + 高级交互（与全栈 Sprint 5+ 对齐）

> **预计工期：2-3 周**

### 3.1 响应式基础

| # | 文件 | 修改 |
|---|------|------|
| 1 | `app/globals.css` | 添加 `@media` 断点：`sm: 640px`, `md: 768px`, `lg: 1024px` |
| 2 | `components/sidebar-nav.tsx` | 移动端折叠为底部 Tab Bar（固定 64px 高，最多 5 个 Tab）|
| 3 | 所有页面 | 固定列数布局改为 `repeat(auto-fill, minmax(...))` |

**Sidebar → Bottom Tab Bar 变换规范（研究 Agent 建议）：**
```
< 768px:  底部 Tab Bar（固定 64px 高）
  - Operator: Inbox(badge) | Products | Platforms | Ads | More
  - Tenant Admin: Overview | Authority | Costs | Integrations | Team
  - Supplier: 单页面，无 Tab Bar
  - Viewer: 单页面，无 Tab Bar
  - System Admin: Platform | Tenants | Knowledge | Monitor | Audit

≥ 768px:  可折叠侧边栏
  - 折叠态: 72px 宽（仅图标）
  - 展开态: 240px 宽（图标 + 文字）
  - 折叠/展开使用 CSS transition 300ms ease

≥ 1024px: 固定侧边栏 240px（始终展开）
```

### 3.2 Operator Mobile 核心交互

| # | 修改 |
|---|------|
| 1 | 待办卡片支持触摸滑动：左滑 = 执行，右滑 = 拒绝 |
| 2 | 拒绝滑动后弹出原因选择底部弹窗（Bottom Sheet） |
| 3 | 产品工作台 Tab 改为水平滚动 Tab Bar（非折叠） |

**Inbox 滑动手势实现规范（研究 Agent 建议）：**

```
技术栈：Motion (motion/react) + react-modal-sheet

滑动卡片实现：
  <motion.div
    drag="x"
    dragDirectionLock        // 锁定方向，防止垂直滚动冲突
    dragElastic={0.2}        // 弹性系数
    dragConstraints={{ left: -150, right: 150 }}
    onDragEnd={(_, info) => {
      // 位移 > 80px 或速度 > 500px/s 触发操作
      if (info.offset.x < -80 || info.velocity.x < -500) executeAction()
      if (info.offset.x > 80 || info.velocity.x > 500) openRejectSheet()
    }}
  >

视觉反馈：
  - 左滑（执行）：背景渐变为 var(--success) 10%，显示 ✅ 图标
  - 右滑（拒绝）：背景渐变为 var(--danger) 10%，显示 ❌ 图标
  - 使用 useMotionValue + useTransform 实现实时颜色插值

拒绝 Bottom Sheet：
  <Sheet snapPoints={[400, 200, 0]} initialSnap={0}>
    <Sheet.Header />
    <Sheet.Content>
      <h3>Help the Agent learn</h3>
      {REJECT_REASONS.map(reason => <ReasonButton />)}
      <textarea placeholder="Additional context (optional)" />
      <p className="text-xs text-secondary">
        Your judgment trains the system — feeds Layer 7 evolution
      </p>
    </Sheet.Content>
  </Sheet>

无障碍（WCAG 2.5.1）：
  - 每张卡片底部始终显示 "Execute" / "Reject" 按钮（不隐藏）
  - 滑动是增强交互，按钮是基础交互
  - 屏幕阅读器：aria-label="Swipe left to execute, right to reject"
```

**产品工作台 Mobile 适配：**
```
< 768px:
  - Sticky header 简化为 1 行：产品名 + Health 评分 + 2 个核心指标
  - 六 Tab 改为水平滚动 Tab Bar（不折叠为 Select）
  - 每个 Tab 内容使用全宽卡片堆叠
  - 图表宽度 100%，高度固定 200px
  - 瀑布图改为水平条形图（更适合窄屏）
```

### 3.3 Supplier Mobile

| # | 修改 |
|---|------|
| 1 | 采购订单卡片大按钮设计（56×56px 最小触摸目标） |
| 2 | 进度更新支持大号滑块（thumb 48px） |
| 3 | 报价表单使用 `inputmode="decimal"` 触发数字键盘 |

**工业环境适配（研究 Agent 建议）：**
```
触摸目标：
  - 所有按钮 ≥ 56×56px（戴手套操作）
  - 按钮间距 ≥ 12px
  - 使用 @media (any-pointer: coarse) 自动放大

表单优化：
  - 数量字段：inputmode="numeric" + 步进按钮（+/- 大按钮）
  - 价格字段：inputmode="decimal"
  - 日期字段：原生 date picker（不用自定义组件）
  - 文件上传：大号拖拽区域 + 相机直拍选项

离线容错：
  - 报价表单使用 localStorage 自动保存草稿
  - 网络恢复后自动提交（显示 "Saved offline, will sync when connected"）
```

### 3.4 Viewer Mobile

| # | 修改 |
|---|------|
| 1 | 经营大屏大字体、大数字布局（利润数字 ≥ 32px） |
| 2 | AI 效能报告卡片式展示 |
| 3 | 图表改为全宽卡片，垂直堆叠 |

**30 秒 Mobile 体验：**
```
< 768px:
  - 首屏只显示 4 个 KPI 大数字（利润/利润率/GMV/目标完成率）
  - 向下滚动：经营健康矩阵（饼图改为水平条形图）
  - 继续滚动：AI 效能（卡片式，每个指标一张卡片）
  - 底部：导出按钮（PDF/Excel）
  - 无 Tab Bar（单页面）
```

### 3.5 主题切换 FOUC 消除

**问题：** 页面加载时先闪烁默认主题再切换到用户选择的主题。

**解决方案（性能 Agent 建议）：**
```html
<!-- 在 app/layout.tsx 的 <head> 中添加内联脚本 -->
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.className = theme;
    document.documentElement.style.colorScheme = theme;
  })();
`}} />
```
- 此脚本在 CSS 加载前执行，消除 FOUC
- 不依赖 React hydration，0ms 延迟

### 3.6 `color-mix()` 兼容性 Fallback

**问题：** Safari < 16.4 不支持 `color-mix()`。

**解决方案：**
```css
.status-card {
  /* Fallback for Safari < 16.4 */
  background: rgba(79, 142, 247, 0.1);
  /* Modern browsers */
  @supports (background: color-mix(in srgb, red 50%, blue)) {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
}
```

---

## 修复进度跟踪矩阵

### Phase 0 完成后预期符合度

| 维度 | 修复前 | Phase 0 后 | 提升 |
|------|--------|-----------|------|
| Section 1 System Admin 铁律 | 0% | **70%** | +70%（前端隔离到位，后端待 Sprint 3a） |
| Section 4 Supplier 铁律 | 0% | **60%** | +60%（前端隔离到位，后端待 Sprint 3b） |
| Section 5 Viewer 铁律 | 40% | **80%** | +40%（零操作强制） |
| Section 3 Operator 铁律 | 50% | **60%** | +10%（拒绝原因对齐） |
| Section 2 Tenant Admin 铁律 | 30% | **35%** | +5%（标记 + 默认关闭） |

### Phase 1 完成后预期符合度

| 维度 | Phase 0 后 | Phase 1 后 | 提升 |
|------|-----------|-----------|------|
| Section 0 神经接口 | 40% | **65%** | +25%（置信度 + OODA 接入） |
| Section 3 Operator | 60% | **75%** | +15%（待办增强） |
| Section 5 Viewer | 80% | **85%** | +5%（AI 效能结构） |

### Phase 2 完成后预期符合度

| 维度 | Phase 1 后 | Phase 2 后 | 提升 |
|------|-----------|-----------|------|
| Section 1 System Admin | 70% | **90%** | +20%（真实数据 + Kill Switch） |
| Section 2 Tenant Admin | 35% | **80%** | +45%（授权中心后端化 + 成本档案 + 团队管理） |
| Section 3 Operator | 75% | **90%** | +15%（六 Tab 产品工作台） |
| Section 4 Supplier | 60% | **85%** | +25%（后端 FieldFilter + 交期日历） |
| Section 5 Viewer | 85% | **90%** | +5%（真实数据接入） |
| Section 6 Harness 映射 | 10% | **60%** | +50%（真实数据） |

### Phase 3 完成后预期符合度

| 维度 | Phase 2 后 | Phase 3 后 | 提升 |
|------|-----------|-----------|------|
| Mobile 支持 | 0% | **70%** | +70% |
| 综合符合度 | ~80% | **85%** | +5% |

> **注意：** 从 85% → 100% 的最后 15% 依赖全栈计划 Sprint 6-8 的后端能力（experience 表真实数据、进化层蒸馏、记忆层语义检索等）。

---

## 与全栈实施计划的对齐关系

```
全栈 Sprint 0 (5天)          本计划 Phase 0 (2-3天) ← 可并行
├── Schema 对齐               ├── 铁律前端强制
├── graph_runtime 拆分         ├── sidebar 角色过滤
├── CI 加固                   ├── 拒绝原因对齐
├── AuthContext 硬编码         └── Supplier/Viewer 守卫
└── 拒绝弹窗增加原因

全栈 Sprint 1 (2周)          本计划 Phase 1 (1周) ← 可并行
├── ExecutionReceipt          ├── 置信度展示
├── experience 表              ├── OODA 接入待办
├── /approvals join            └── Viewer AI 效能结构
└── Tier 1 信号

全栈 Sprint 3a (2周)         本计划 Phase 2 前半 ← 依赖 3a
├── JWT 认证                  ├── System Admin 真实隔离
├── RoleGuard                 ├── 团队管理
└── Token 刷新                └── 成本档案

全栈 Sprint 3b (2周)         本计划 Phase 2 后半 ← 依赖 3b
├── FieldFilter               ├── Supplier 后端隔离
├── Data Scope                ├── 产品工作台六 Tab
└── 角色化 UI 第一批           └── Viewer 真实数据

全栈 Sprint 5 (2周)          本计划 Phase 3 ← 依赖 Sprint 5
├── SSE 按 tenantId 分组       ├── Mobile 响应式
├── governance 接真实数据       ├── 左滑右滑交互
└── 角色化 UI 第二批            └── Supplier/Viewer Mobile
```

---

## 立即可执行的文件修改清单（Phase 0）

以下修改不依赖任何后端变更，可立即执行：

### 文件 1：`apps/web/components/sidebar-nav.tsx`

**修改内容：** 收紧各角色的菜单可见性

| 菜单项 | 当前角色 | 修改后角色 | 原因 |
|--------|---------|-----------|------|
| Product Assets | system_admin, tenant_admin, operator, supplier | tenant_admin, operator | System Admin 不看业务数据；Supplier 不看产品详情 |
| Platform Campaigns | system_admin, tenant_admin, operator | tenant_admin, operator | System Admin 不看业务数据 |
| Product Cockpit | system_admin, tenant_admin, operator | tenant_admin, operator | System Admin 不看业务数据 |
| Profit Report | system_admin, tenant_admin, operator | tenant_admin, operator | System Admin 不看业务数据 |
| Approvals Queue | system_admin, tenant_admin, operator | tenant_admin, operator | System Admin 不审批业务 |
| Purchase Orders | system_admin, tenant_admin, supplier | tenant_admin, supplier | System Admin 不看采购 |
| Evolution Engine | system_admin, tenant_admin, operator, viewer | system_admin, tenant_admin | Viewer 只看经营大屏；Operator 通过待办交互 |
| Swarm Governance | system_admin, tenant_admin, operator | system_admin, tenant_admin | Operator 不需要治理看板 |
| Executive Dashboard | system_admin, tenant_admin, viewer | tenant_admin, viewer | System Admin 用 /ops 和 /harness |

### 文件 2：`apps/web/app/ops/page.tsx`

**修改内容：** 租户列表脱敏
- `name: "Acme Corp"` → `name: "Tenant #1"`
- 移除所有可能暴露租户身份的字段

### 文件 3：`apps/web/components/tenant-context.tsx`

**修改内容：** System Admin 禁用租户切换
- `if (role === 'system_admin')` 时，租户切换器不渲染或显示为"Platform View"

### 文件 4：`apps/web/app/page.tsx`

**修改内容：**
- Operator 拒绝原因对齐为 5 个设计枚举
- 添加「你的判断将帮助 Agent 在未来做出更好的决策」提示语

### 文件 5：`apps/web/components/approvals-dashboard.tsx`

**修改内容：**
- `REJECTION_REASONS` 对齐为 5 个设计枚举
- 添加进化层提示语

### 文件 6：各页面添加角色守卫

**修改内容：** 在以下页面顶部添加角色检查
- `/products/page.tsx`：`if (role === 'system_admin' || role === 'supplier' || role === 'viewer') return <AccessDenied />`
- `/profit-report/page.tsx`：`if (role === 'system_admin' || role === 'supplier' || role === 'viewer') return <AccessDenied />`
- `/campaigns/page.tsx`：`if (role === 'system_admin' || role === 'supplier' || role === 'viewer') return <AccessDenied />`

---

## 铁律修复后的验证脚本

Phase 0 完成后，执行以下手动验证：

```
铁律 1 — Operator 拒绝必须选原因
  ✓ 登录 operator → 首页待办 → 点击拒绝 → 不选原因 → 确认按钮禁用
  ✓ 选择原因 → 确认按钮启用 → 提交成功
  ✓ 拒绝弹窗底部有进化层提示语

铁律 2 — Tenant Admin 授权中心不能跳过
  ✓ 登录 tenant_admin → Agent Authorization → 所有能力默认 disabled
  ✓ 页面顶部有 localStorage 警告

铁律 3 — System Admin 看不到单一租户数据
  ✓ 登录 system_admin → sidebar 仅显示 5 个 /admin/* 菜单
  ✓ /admin/tenants 租户显示为 Tenant #N（匿名化）
  ✓ /admin/agent-monitor 租户级数据匿名化
  ✓ /admin/isolation-audit RLS 覆盖率可见
  ✓ 租户切换器不可用或显示 Platform View
  ✓ 直接访问 /products → Access Denied

铁律 4 — Supplier 双重隔离售价利润
  ✓ 登录 supplier → sidebar 仅显示 Purchase Orders
  ✓ 直接访问 /products → Access Denied
  ✓ PO 卡片中无售价/利润字段

铁律 5 — Viewer 零操作按钮
  ✓ 登录 viewer → 所有可见页面无操作按钮
  ✓ sidebar 仅显示经营大屏相关菜单

铁律视觉强制 — 全角色
  ✓ 每个角色登录 → 对应铁律提示条可见（橙色/琥珀色）
  ✓ 提示条不可关闭/隐藏
  ✓ Inbox Reject 按钮旁有 "feeds Layer 7 evolution" 提示
```

---

## 风险登记簿

### CRITICAL 安全风险（Round 2 安全审计新增）

| # | 风险 | 影响 | 概率 | 缓解策略 | 所有者 | 修复时间 |
|---|------|------|------|----------|--------|---------|
| C-1 | FALLBACK_USER 未认证=Operator | 极高 | 极高 | 移除 FALLBACK_USER，重定向 /login（安全基线 S-1） | 前端 | **Day 1** |
| C-2 | 前端隔离可被 DevTools 完全绕过 | 极高 | 高 | 后端 API 层同步实施角色检查（安全基线 S-2） | 后端 | **Day 1** |
| C-3 | Supplier Token 无安全体系 | 高 | 中 | 256 位随机 + 90 天过期 + 撤销 + rate limiting（安全基线 S-8） | 全栈 | **Phase 0** |
| C-4 | Phase 0-2 安全真空期 4-6 周 | 极高 | 高 | 安全基线 S-1~S-9 与 Phase 0 同步交付 | 全栈 | **Phase 0** |

### HIGH 安全风险（Round 2 安全审计新增）

| # | 风险 | 影响 | 概率 | 缓解策略 | 所有者 | 修复时间 |
|---|------|------|------|----------|--------|---------|
| H-1 | SSE 事件无角色过滤 | 高 | 中 | SSE 推送按角色过滤敏感字段 | 后端 | Sprint 1 |
| H-2 | 登录无速率限制 | 高 | 高 | 5 次/5 分钟 → 锁定（安全基线 S-4） | 后端 | **Phase 0** |
| H-3 | 无 CSRF 保护 | 高 | 中 | Double Submit Cookie 或完全依赖 Bearer token | 后端 | Sprint 1 |
| H-4 | MDM 路由 tenantId 绕过 | 高 | 高 | 强制使用 auth.tenantId（安全基线 S-3） | 后端 | **Day 1** |
| H-5 | localStorage 存储认证信息 | 高 | 中 | Sprint 3a 迁移到 HttpOnly cookie | 全栈 | Sprint 3a |
| H-6 | 铁律无后端强制 + CI 检查 | 高 | 中 | 安全基线 S-9 + ESLint 自定义规则 | 全栈 | **Phase 0** |

### 架构风险（Round 2 架构审查新增）

| # | 风险 | 影响 | 概率 | 缓解策略 | 所有者 | 修复时间 |
|---|------|------|------|----------|--------|---------|
| A-1 | SSE 无消息补偿（断线丢事件） | 高 | 高 | Last-Event-ID + 事件持久化（Sprint 4 EventBus） | 后端 | Sprint 4 |
| A-2 | 跨页面 Agent 状态无同步 | 中 | 中 | Sprint 5 引入 Zustand | 前端 | Sprint 5 |
| A-3 | 散点图 1000+ 产品前端卡顿 | 中 | 中 | 后端预聚合 + 自动降级为热力图 | 全栈 | Sprint 5 |

### 性能风险（Round 1，保留）

| # | 风险 | 影响 | 概率 | 缓解策略 | 所有者 |
|---|------|------|------|----------|--------|
| R1 | SSE 200+ 连接 CPU 飙升 | 高 | 中 | 单连接多路复用 + tenantId 分组（P0 行动 #2） | 后端 |
| R2 | Product Workspace 6 Tab 同时加载 TTI > 2s | 高 | 高 | Tab 懒加载 + dynamic import（Phase 2.3） | 前端 |
| R3 | Inbox 14 天历史累积内存泄漏 | 中 | 高 | LRU 缓存 200 条 + 分页（Phase 2.3） | 前端 |
| R4 | `color-mix()` Safari < 16.4 不兼容 | 低 | 中 | `@supports` fallback（Phase 3.6） | 前端 |
| R5 | 客户端 PDF 生成冻结 UI 5-15s | 高 | 高 | 服务端生成 + presigned URL（Phase 2.5） | 全栈 |
| R6 | 主题切换 FOUC 闪烁 | 低 | 高 | `<head>` 内联脚本（Phase 3.5） | 前端 |
| R7 | Agent Authority localStorage 数据丢失 | 高 | 中 | Sprint 3b 迁移到后端 API（Phase 2.2） | 全栈 |
| R8 | Supplier 页面在弱网环境加载慢 | 中 | 中 | bundle < 50KB + preload 关键资源（Phase 2.4） | 前端 |
| R9 | Platform Matrix 500+ 单元格渲染卡顿 | 中 | 中 | @tanstack/react-virtual 虚拟化（Phase 2.3） | 前端 |
| R10 | 拒绝反馈数据未持久化到 experience 表 | 高 | 低 | Sprint 1 experience 表就绪后立即接入 | 后端 |

---

## 实施检查清单（每个 Phase 完成时核对）

### Phase 0 完成检查（含安全基线）

**安全基线（不可协商）：**
- [ ] FALLBACK_USER 已移除，未认证用户重定向 /login（S-1）
- [ ] 后端所有写操作端点有 requireRole() 中间件（S-2）
- [ ] MDM 路由强制使用 auth.tenantId（S-3）
- [ ] 登录速率限制：5 次/5 分钟 → 锁定（S-4）
- [ ] 生产环境 passthrough auth 启动时拒绝（S-5）
- [ ] 硬编码 demo 密码已移除（S-6）
- [ ] 开发默认密钥生产检查到位（S-7）
- [ ] Supplier Token：256 位随机 + 90 天过期 + 撤销 API（S-8）
- [ ] 5 条铁律后端 API 层强制执行（S-9）

**前端铁律修复：**
- [ ] 5 条铁律前端强制全部到位
- [ ] 铁律视觉提示条（IronLawBanner）全角色可见
- [ ] 拒绝原因枚举对齐 + "Help the Agent learn" 文案
- [ ] Supplier sidebar 仅 Purchase Orders
- [ ] Viewer 零操作 + fetch 拦截
- [ ] Agent Authority 默认 disabled + localStorage 警告
- [ ] 交互规格 AUTO/REQUIRED 标签到位

**统一组件（Round 2 新增）：**
- [ ] RoleGuard 组件替代散落的 if (role === ...) 检查
- [ ] REJECTION_REASONS 抽取到 lib/constants/reject-reasons.ts
- [ ] ConfidenceBadge 组件就绪
- [ ] DataState 组件就绪（loading/error/empty/"数据接入中"）

### Phase 1 完成检查

- [ ] 置信度三色系统在 Inbox 卡片中显示
- [ ] OODA 三级渐进式披露可用
- [ ] Viewer AI 效能 5 项结构就位（可接受 mock 数据标注"数据接入中"）
- [ ] 低置信度卡片有 ⚠️ 标记

### Phase 2 完成检查

- [ ] 路由按角色分组（5 个 route groups + 单根布局）
- [ ] System Admin 5 个 /admin/* 页面全部可用
- [ ] Tenant Admin 5 个页面全部可用
- [ ] Agent Authority 从 localStorage 迁移到后端 API
- [ ] Operator 4 个工作台全部可用
- [ ] Product Workspace 6 Tab 懒加载 + < 300ms 切换
- [ ] Supplier 单页面 /supplier/{token} 可用
- [ ] Viewer 单页面 /reports 可用 + 服务端导出
- [ ] SSE 单连接多路复用到位（@microsoft/fetch-event-source）
- [ ] SSE 事件按角色过滤（H-1 修复）
- [ ] 组合模式替代 role prop（Tenant Admin/Viewer 共享组件）
- [ ] AgentSuggestionCard 统一组件在 Inbox/Dashboard/Product Workspace 使用
- [ ] React Query 集成：staleTime 按数据类型配置
- [ ] Operator 执行/拒绝乐观更新到位

### Phase 3 完成检查

- [ ] Sidebar → Bottom Tab Bar 响应式变换（< 768px）
- [ ] Operator Inbox 滑动手势 + 无障碍按钮替代
- [ ] Supplier 56px 触摸目标 + 离线草稿保存
- [ ] Viewer 30 秒 Mobile 体验验证通过
- [ ] 主题 FOUC 消除
- [ ] `color-mix()` fallback 到位
- [ ] 所有页面 Lighthouse Mobile 评分 ≥ 80

---

## 依赖库安装清单

### Phase 0 安装（安全 + 基础）

```bash
# JWT 验证（Edge Runtime 兼容，用于 Next.js Middleware）
npm install jose

# SSE 客户端（支持自定义 header、指数退避、页面可见性感知）
npm install @microsoft/fetch-event-source

# React Query（数据获取 + 缓存 + SSE 集成）
npm install @tanstack/react-query
```

### Phase 2 安装（UI 增强）

```bash
# 手势 + 动画
npm install motion react-modal-sheet

# 图表（tree-shakeable，按需导入）
npm install @visx/xychart @visx/shape @visx/tooltip @visx/axis @visx/scale

# 虚拟化列表
npm install @tanstack/react-virtual
```

### Phase 3 安装（Sprint 5 状态管理）

```bash
# 全局状态管理（SSE 事件驱动 + 跨页面同步）
npm install zustand
```

**注意：**
- 不安装 `recharts`（已有但后续迁移到 visx）
- 不安装客户端 PDF 库（服务端生成）
- 不安装 `jsonwebtoken`（Edge Runtime 不兼容，用 `jose` 替代）
- `@microsoft/fetch-event-source` 替代原生 `EventSource`（支持 JWT header）
