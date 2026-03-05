# Harness UI 深度性能分析（第二轮）

> **日期：** 2026-03-01  
> **范围：** 聚焦于第一轮性能审查**未覆盖**的 6 个领域  
> **已覆盖（跳过）：** SSE 多路复用、Tab 懒加载、Inbox LRU 缓存、color-mix() fallback、服务端 PDF、主题 FOUC、Platform Matrix 虚拟化

---

## 1. Next.js App Router 特定优化

### 1.1 Server Components vs Client Components 边界

**当前状态：** `layout.tsx` 中 Root Layout 为 Server Component，但 `SidebarNav`、`AuthProvider`、`TenantProvider`、`AppThemeProvider` 均为 Client（`'use client'`），导致整个应用 hydrate 时加载全部客户端逻辑。

**推荐 Server Component 清单（减少 JS bundle）：**

| 组件/页面 | 推荐类型 | 理由 | 预估节省 |
|-----------|----------|------|---------|
| `app/reports/page.tsx` (Viewer) | **Server** | 纯展示，零操作，可服务端 fetch 首屏数据 | ~15KB |
| `app/admin/tenants/page.tsx` 表格行 | **Server** | 租户列表行无交互，可服务端渲染 | ~8KB |
| `app/dashboard/page.tsx` 4 个 StatBadge | **Server** | 首屏 KPI 数字可服务端预取 | ~5KB |
| `PageHeader`（title + subtitle） | **Server** | 纯静态文案 | ~2KB |
| `IronLawBanner` | **Server** | 无交互，仅展示文案 | ~1KB |
| 产品列表 `/products` 表格（非展开态） | **Server** | 只读表格，行点击展开时才需 Client | ~12KB |

**必须保持 Client 的组件：**

| 组件 | 原因 |
|------|------|
| `SidebarNav` | `usePathname`、`useAuth`、租户切换 |
| `ApprovalsDashboard` | SSE、执行/拒绝操作、展开折叠 |
| Product Workspace 6 Tab | Tab 切换、动态内容 |
| Platform Matrix | 指标切换、虚拟滚动 |
| 所有含表单/按钮交互的页面 | 需要事件处理 |
| `AppThemeProvider`、`AuthProvider`、`TenantProvider` | 全局状态 |

**边界拆分模式：**

```tsx
// app/dashboard/page.tsx — 推荐结构
export default async function DashboardPage() {
  // Server: 预取首屏 KPI
  const kpi = await fetchKPI(/* ... */);
  return (
    <>
      <PageHeader title="经营全景看板" subtitle={/* static */} />
      <StatBadgeRow data={kpi} />
      <ProductHealthMatrixClient />  {/* Client: 散点图交互 */}
      <NeedsAttentionClient />       {/* Client: SSE + 操作按钮 */}
    </>
  );
}
```

```tsx
// components/stat-badge-row.tsx — 可保持 Server
export function StatBadgeRow({ data }: { data: KPISnapshot }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {data.items.map(item => (
        <StatBadge key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
```

**落地顺序：** Phase 2 路由分组后，优先将 Viewer `/reports` 和 Tenant Admin `/dashboard` 首屏 StatBadge 拆为 Server。

---

### 1.2 Streaming SSR + React Suspense

**当前状态：** 页面多为同步渲染，无 `loading.tsx` 或 `Suspense` 边界。`ApprovalsDashboard` 在 `loading` 态阻塞整页渲染。

**可流式拆分的页面：**

| 页面 | 流式策略 | 预期改善 |
|------|----------|---------|
| `/inbox` | 骨架屏 + 待办列表 `Suspense` | TTFB → 首块 < 200ms |
| `/dashboard` | StatBadge 立即流式 → 散点图 `Suspense` → Needs Attention `Suspense` | LCP 提前 ~400ms |
| `/products/[id]` | Header + Profit Tab 立即流式 → Channels/Ads 等 Tab 懒加载 | 首屏 TTI < 1.2s |
| `/admin/platform` | 6 个 StatBadge 立即流式 → 告警面板 `Suspense` → 进化追踪 `Suspense` | 健康指标先行展示 |
| `/reports` | KPI 行立即流式 → 图表 `Suspense` → AI 效能 `Suspense` | 30 秒原则前半段加速 |

**实现模式：**

```tsx
// app/inbox/page.tsx
export default function InboxPage() {
  return (
    <main>
      <PageHeader title="智能待办中心" subtitle="Agent-pushed decisions" />
      <Suspense fallback={<InboxSkeleton count={5} />}>
        <InboxList />
      </Suspense>
    </main>
  );
}

// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main>
      <Suspense fallback={<StatBadgeSkeleton count={4} />}>
        <StatBadgeRow />
      </Suspense>
      <Suspense fallback={<div style={{ height: 300 }} className="skeleton" />}>
        <ProductHealthScatter />
      </Suspense>
    </main>
  );
}
```

**配合 `loading.tsx`：** 每个 `(admin)`、`(operator)`、`(tenant)` route group 下放置 `loading.tsx`，返回 route-group 级骨架屏，避免整页白屏。

---

### 1.3 ISR/SSG 机会

**可静态/增量再生的页面：**

| 页面 | 策略 | revalidate | 理由 |
|------|------|-------------|------|
| `/login` | **Static** | — | 完全静态，无用户数据 |
| `/supplier/[token]` | **ISR** | 60 | 供应商门户，数据 1 分钟级新鲜度可接受 |
| `/admin/knowledge` Layer A 表格 | **ISR** | 300 | 公共规则变更频率低，5 分钟可接受 |
| `/appearance` 主题选择页 | **Static** | — | 纯 UI 配置 |
| `/reports` 导出模板 | **Static** | — | 报告模板不变 |

**不可静态：**

- `/inbox`、`/approvals`：实时 SSE + 操作
- `/dashboard`：租户级经营数据
- `/products/[id]`：产品级实时数据
- 所有需 RoleGuard 的页面：需服务端鉴权

**实现示例：**

```tsx
// app/supplier/[token]/page.tsx
export const revalidate = 60;

export default async function SupplierPortalPage({ params }: { params: { token: string } }) {
  const data = await fetchSupplierData(params.token);
  return <SupplierPortal data={data} />;
}
```

---

### 1.4 Link Prefetching 与 5 个 Route Groups

**Next.js 默认行为：** `Link` 的 `prefetch` 默认为 `true`（生产环境），会预取视窗内链接对应的页面。

**5 个 Route Group 的预取策略：**

| Route Group | 预取策略 | 理由 |
|-------------|----------|------|
| `(admin)` | `prefetch={false}` 对非 admin 角色 | System Admin 占比低，避免为多数用户预取 admin bundle |
| `(operator)` | `prefetch={true}` 对 Inbox、Products | 最高频页面，预取有价值 |
| `(tenant)` | `prefetch={true}` 对 Dashboard、Settings | 次高频 |
| `(supplier)` | `prefetch={false}` | 通过外部链接进入，非站内导航 |
| `(viewer)` | `prefetch={true}` 对 Reports | 单页为主，预取成本低 |

**按角色动态 prefetch：**

```tsx
// components/sidebar-nav.tsx
<Link
  href={item.path}
  prefetch={isHighTraffic(item.path) && hasRole(...item.roles)}
  // ...
>
```

**避免过度预取：** 5 个 route group 意味着 5 套 layout + 多套 page，若全部 prefetch 会导致：
- 并行 HTTP/2 请求过多
- 首屏带宽竞争

**推荐：** 仅对当前角色可见的、且为高频入口的 3–5 个链接启用 prefetch，其余 `prefetch={false}`。

---

## 2. React Query 优化（引入 @tanstack/react-query）

**当前状态：** 项目尚未使用 React Query，数据通过 `useState` + `useEffect` + 手动 `fetch` 管理。`ApprovalsDashboard` 的 `refresh()` 无去抖、无缓存、无乐观更新。

### 2.1 Query Key 设计（5 角色 × 多页面）

**分层 Key 结构：**

```ts
// lib/query-keys.ts
export const queryKeys = {
  // 角色无关（租户级）
  tenant: (tenantId: string) => ['tenant', tenantId] as const,
  
  // Inbox / Approvals
  approvals: (tenantId: string, filters?: { status?: string }) => 
    ['approvals', tenantId, filters] as const,
  inbox: (tenantId: string, page?: number) => 
    ['inbox', tenantId, page] as const,
  
  // Product Workspace
  product: (tenantId: string, productId: string) => 
    ['product', tenantId, productId] as const,
  productProfit: (tenantId: string, productId: string) => 
    [...queryKeys.product(tenantId, productId), 'profit'] as const,
  productChannels: (tenantId: string, productId: string) => 
    [...queryKeys.product(tenantId, productId), 'channels'] as const,
  
  // Platform Matrix
  platformMatrix: (tenantId: string, metric: string) => 
    ['platform-matrix', tenantId, metric] as const,
  
  // Dashboard
  dashboardKPI: (tenantId: string) => ['dashboard', tenantId, 'kpi'] as const,
  dashboardHealth: (tenantId: string) => ['dashboard', tenantId, 'health'] as const,
  
  // Admin
  adminPlatform: () => ['admin', 'platform'] as const,
  adminTenants: (page?: number) => ['admin', 'tenants', page] as const,
} as const;
```

**角色隔离：** Query Key 已包含 `tenantId`，结合 Data Scope 中间件，天然实现角色数据隔离。System Admin 的 `adminPlatform` 等不包含 tenantId，与业务数据分离。

---

### 2.2 staleTime / gcTime 配置（按数据类型）

| 数据类型 | staleTime | gcTime | 理由 |
|----------|-----------|--------|------|
| 待办/审批列表 | 0 | 5 * 60 * 1000 | 实时性高，SSE 驱动更新，缓存仅作过渡 |
| 产品详情（基础信息） | 2 * 60 * 1000 | 10 * 60 * 1000 | 2 分钟内复用 |
| 产品 Profit Tab | 1 * 60 * 1000 | 5 * 60 * 1000 | 利润数据 1 分钟新鲜度 |
| Dashboard KPI | 1 * 60 * 1000 | 10 * 60 * 1000 | 1 分钟 |
| Platform Matrix | 30 * 1000 | 5 * 60 * 1000 | 30 秒，切换指标时快速过期 |
| Admin 租户列表 | 5 * 60 * 1000 | 30 * 60 * 1000 | 低频，5 分钟 |
| Layer A 知识 | 5 * 60 * 1000 | 60 * 60 * 1000 | 变更极少 |
| Supplier 待报价 | 60 * 1000 | 10 * 60 * 1000 | 1 分钟 |

**默认配置：**

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,  // SSE 场景下避免重复请求
    },
  },
});
```

---

### 2.3 乐观更新（Operator 执行/拒绝）

**当前行为：** `handleApprove` / `handleRejectConfirm` 后调用 `refresh()`，用户需等待网络返回才能看到状态变化。

**乐观更新模式：**

```tsx
const queryClient = useQueryClient();

const approveMutation = useMutation({
  mutationFn: (id: string) => approveApproval(id, tenantId),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.approvals(tenantId) });
    const prev = queryClient.getQueryData(queryKeys.approvals(tenantId));
    queryClient.setQueryData(queryKeys.approvals(tenantId), (old) =>
      old?.map((item) =>
        item.id === id ? { ...item, status: 'APPROVED' as const } : item
      ) ?? []
    );
    return { prev };
  },
  onError: (err, id, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(queryKeys.approvals(tenantId), ctx.prev);
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals(tenantId) });
  },
});
```

**执行流程：**
1. `onMutate`：立即将对应项 `status` 改为 `APPROVED`，UI 即时反馈
2. `onError`：回滚到 `prev`
3. `onSettled`：后台 invalidate，与 SSE 推送或服务端状态保持最终一致

**拒绝操作：** 同理，乐观移除或标记为 `REJECTED`，失败时回滚。

---

### 2.4 Product Workspace 相邻 Tab 预取

**策略：** 当前 Tab 为 Profit 时，预取 Channels；当前为 Channels 时，预取 Ads 和 Supply Chain。

```tsx
const [activeTab, setActiveTab] = useState<'profit' | 'channels' | 'ads' | 'supply' | 'social' | 'aftersales'>('profit');

// 预取相邻 Tab
useEffect(() => {
  const adjacentTabs: Record<string, string[]> = {
    profit: ['channels'],
    channels: ['ads', 'supply'],
    ads: ['supply', 'social'],
    supply: ['social', 'aftersales'],
    social: ['aftersales'],
    aftersales: ['profit'],
  };
  adjacentTabs[activeTab]?.forEach((tab) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.productTab(tenantId, productId, tab),
      staleTime: 2 * 60 * 1000,
    });
  });
}, [activeTab, tenantId, productId, queryClient]);
```

**效果：** 切换到相邻 Tab 时，命中缓存概率高，目标 < 300ms 切换。

---

## 3. CSS 性能

### 3.1 9 个 Theme Engines 与 CSS 变量性能

**当前：** `globals.css` 中有 9 套主题（`:root`、`:root.dark`、terminal、cyberpunk、brutalism、antigravity、solarized-light、vsc-dark、vsc-light、monokai），每套约 20+ 个 `--*` 变量。

**性能要点：**
- CSS 变量为继承式解析，切换主题时仅 `document.documentElement.className` 变化
- 所有规则共享同一变量名，不存在重复解析
- 潜在问题：**选择器特异性**。若存在 `.theme-cyberpunk .sidebar` 等复杂选择器，主题切换会触发更多 reflow

**优化：**
- 主题仅通过 `:root.theme-xxx` 覆盖变量，**避免** `.theme-xxx .card` 等深层选择器
- 当前 `theme-antigravity body` 仅覆盖 `font-family`，可接受
- **建议：** 主题切换时使用 `requestAnimationFrame` 或 `flushSync` 外批量 DOM 更新，避免中间帧闪烁

```tsx
// theme-context 中的切换逻辑
const setTheme = (theme: string) => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove(...THEMES);
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
  });
};
```

---

### 3.2 color-mix() 计算成本

**当前使用量：** `grep` 显示约 11 处在 `globals.css`，另有 20+ 处在组件内联样式（如 `sidebar-nav.tsx`、`sovereign-governance-insight.tsx`）。

**单次 `color-mix()` 成本：** 现代浏览器已高度优化，单元素 < 0.1ms。但在以下场景可能放大：
- 表格 100+ 行，每行 5 个 `color-mix()` 单元格 → 500+ 次计算
- Platform Matrix 500+ 单元格，每个用 `color-mix()` 做颜色编码

**建议：**
- **表格行：** 使用预计算类名，如 `.status.PENDING` 已在 CSS 中定义为 `color-mix(...)`，避免内联重复
- **Platform Matrix：** 颜色编码用 `useMemo` 预计算为实际 hex/rgb，存入 `data-*` 或 style，而不是每个 cell 内联 `color-mix()`

```tsx
const cellColors = useMemo(() => {
  const mean = computeMean(matrixData);
  return matrixData.map(row =>
    row.cells.map(cell =>
      cell.value > mean ? 'var(--success)' : cell.value < mean ? 'var(--danger)' : 'var(--text-tertiary)'
    )
  );
}, [matrixData]);
```

---

### 3.3 CSS Containment（Platform Matrix、Product Health Matrix）

**适用组件：**
- Platform Matrix：行 × 列的网格，可虚拟化行
- Product Health 散点图：大量 `<circle>` 或 `<rect>`

**contain 属性：**

```css
.platform-matrix-row {
  contain: layout style paint;
}

.product-health-plot {
  contain: layout style;
}
```

- `layout`：行内布局变化不影响外部
- `style`：计数器/引用不泄漏
- `paint`：行内绘制裁剪，减少重绘范围

**注意：** `contain: paint` 会创建新的 stacking context，若有 `position: sticky` 等需验证兼容性。

---

### 3.4 will-change 与动画元素（滑动卡片）

**当前计划：** Mobile Inbox 卡片使用 Motion 的 `drag="x"` 实现左滑执行/右滑拒绝。

**建议：**
- 滑动过程中对 `transform` 做动画，添加 `will-change: transform` 仅**在拖动期间**
- 拖动结束后移除 `will-change`，避免长期占用 compositor 层

```tsx
<motion.div
  drag="x"
  style={{
    willChange: isDragging ? 'transform' : 'auto',
  }}
  onDragStart={() => setIsDragging(true)}
  onDragEnd={() => setIsDragging(false)}
>
```

或通过 CSS：
```css
.inbox-card:active {
  will-change: transform;
}
```
（`:active` 覆盖触摸/点击期间）

---

## 4. 图片/资源优化

### 4.1 产品图片（Product Workspace、Platform Matrix）

**场景：** 产品工作台、Platform Matrix 可能展示产品主图缩略图。

**策略：**
- 使用 Next.js `Image`，启用 `sizes` 与 `placeholder="blur"`
- 平台列表缩略图建议 48×48 或 64×64，`sizes="64px"`
- 产品详情头图可 120×120，`sizes="120px"`
- CDN 响应头设置 `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

```tsx
<Image
  src={product.imageUrl}
  alt={product.name}
  width={64}
  height={64}
  sizes="64px"
  placeholder="blur"
  blurDataURL={product.blurHash ?? '/placeholder-64.png'}
/>
```

---

### 4.2 图表渲染：SVG vs Canvas

| 场景 | 推荐 | 数据量阈值 | 理由 |
|------|------|-----------|------|
| 产品健康散点图 | SVG | < 300 点 | 可交互、可访问、DOM 可接受 |
| 产品健康散点图 | Canvas | ≥ 300 点 | 避免 DOM 过多导致 reflow |
| Platform Matrix 热力图 | Canvas | ≥ 200 行 | 500+ 单元格时 SVG 成本高 |
| 品类饼图 | SVG | < 20 品类 | 简单、可 tree-shake |
| 瀑布图（Profit Tab） | SVG | 固定 < 20 项 | 结构简单 |

**visx 使用建议：** 文档支持 SVG/Canvas 双模式时，通过 `useMemo` 根据 `data.length` 切换：

```tsx
const useCanvas = dataPoints.length >= 300;
return useCanvas ? (
  <VictoryChart theme={canvasTheme}>{/* ... */}</VictoryChart>
) : (
  <XYChart>{/* SVG */}</XYChart>
);
```

---

### 4.3 Icon 库（lucide-react）

**当前：** `lucide-react` 已使用，按需 import 可 tree-shake。

**体积：** 单个 icon ~1–2KB（gzip），`sidebar-nav` 约 15 个 icon → ~25KB。

**优化：**
- 确认使用 `import { Check, X } from 'lucide-react'`，不要 `import * as Lucide`
- 考虑将首屏 icon 内联为 SVG sprite，减少首次 JS 请求
- 非首屏 icon（如 Knowledge、Harness）通过 `dynamic` 延迟加载

---

## 5. 内存分析

### 5.1 React 组件树深度（5 Route Groups + 嵌套 Layout）

**规划结构：**

```
RootLayout
  AppThemeProvider → AuthProvider → TenantProvider
    SidebarNav (client)
    (admin)|(tenant)|(operator)|(supplier)|(viewer) layout
      page
```

**深度估算：** Root → Page 约 6–8 层。Context 嵌套 4 层（Theme、Auth、Tenant，未来可能 + QueryClient）。

**建议：**
- 合并可合并的 Provider：如 `AuthProvider` 与 `TenantProvider` 若强耦合，可合并为一个
- 使用 `useContext` 时，避免在深层子组件重复 `useAuth()`，可在一层解析后通过 props 下传
- 确保 `TenantProvider`、`AuthProvider` 的 value 用 `useMemo` 稳定引用，避免整树重渲染

---

### 5.2 Context Provider 嵌套

**当前：** `AppThemeProvider` → `AuthProvider` → `TenantProvider`。计划引入 `QueryClientProvider`、可能 Zustand。

**建议：**
- `QueryClientProvider` 放在最外层（或与 Auth 同级），避免因 auth 变化导致 query 重置
- Zustand 若能替代部分 Context（如 UI 状态），可减少 Provider 层级
- 结构建议：`QueryClient` → `Theme` → `Auth` → `Tenant`，最多 4 层

---

### 5.3 事件监听与清理（SSE、IntersectionObserver、ResizeObserver）

**SSE：** `ApprovalsDashboard` 的 `useEffect` 在 `tenantId` 变化时正确 `source.close()`，符合规范。

**IntersectionObserver（Inbox 无限滚动）：**
```tsx
useEffect(() => {
  const observer = new IntersectionObserver(callback, { rootMargin: '100px' });
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [/* deps */]);
```
确保 `disconnect` 在 unmount 时调用。

**ResizeObserver（图表、Platform Matrix）：**
- 图表容器尺寸变化时需重算 scale。ResizeObserver 回调中避免同步 layout 读写，使用 `requestAnimationFrame` 或 `queueMicrotask` 延迟处理
```tsx
useEffect(() => {
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(() => setDimensions(ref.current?.getBoundingClientRect()));
  });
  ro.observe(ref.current);
  return () => ro.disconnect();
}, []);
```

---

## 6. Core Web Vitals 目标

### 6.1 LCP（Largest Contentful Paint）

| 角色 | 落地页 | LCP 元素 | 关键路径 | 目标 |
|------|--------|----------|----------|------|
| Operator | `/inbox` | 首张待办卡片 或 骨架屏 | HTML → 骨架屏流式 → 首屏卡片数据 | < 1.2s (4G) |
| Tenant Admin | `/dashboard` | StatBadge 行 或 健康散点图 | HTML → StatBadge 流式 → 散点图 | < 1.5s |
| Viewer | `/reports` | KPI 数字行 | HTML → KPI 流式 | < 1.0s |
| System Admin | `/admin/platform` | 6 个 StatBadge | HTML → StatBadge 流式 | < 1.5s |
| Supplier | `/supplier/[token]` | 待报价需求卡片 | HTML → 卡片数据 | < 1.5s (slow 4G) |

**关键路径建议：**
1. 首屏数据与 HTML 同通道（Server Component fetch 或 streaming）
2. 关键 CSS 内联或优先加载，避免阻塞首屏
3. 字体使用 `font-display: optional` 或 `swap`，避免 FOIT

---

### 6.2 CLS（Cumulative Layout Shift）

**SSE 驱动更新的 CLS 风险：**
- Inbox 新卡片插入：列表高度突变
- Dashboard "Needs Attention" 动态增删
- Approvals 行状态从 PENDING → APPROVED，展开行收起

**对策：**
1. **预留占位：** 新卡片插入前，先渲染固定高度的 skeleton
2. **min-height：** 列表容器设 `min-height`，避免从 0 突然增高
3. **Reserve space：** SSE 推送时，先插入占位 div，再异步填充内容
4. **展开行：** 使用 `overflow: hidden` + `max-height` 动画，避免布局跳动

```css
.inbox-list {
  min-height: 400px;
}

.inbox-card-skeleton {
  height: 120px;
  flex-shrink: 0;
}
```

---

### 6.3 INP（Interaction to Next Paint）

**高风险场景：**
1. **Platform Matrix 指标切换：** 500+ 单元格重算颜色 + 重渲染
   - 使用 `useTransition` 将更新标记为非紧急
   - 虚拟化减少 DOM 节点
2. **Product Workspace Tab 切换：** 6 个 Tab 内容差异大
   - 懒加载 + 缓存，避免每次切换都重新 mount
3. **执行/拒绝按钮：** 点击后整表 re-render
   - 乐观更新仅更新单行，避免整表 setState
4. **Inbox 滑动卡片：** `drag` 期间 60fps
   - 使用 `transform`，避免 `left`/`width` 等触发布局

**INP 目标：** < 200ms（Good），< 500ms（Needs Improvement）。

---

## 推荐实施顺序

| 优先级 | 项目 | Sprint/Phase | 预估收益 |
|--------|------|--------------|---------|
| P0 | Server/Client 边界拆分（Viewer reports、Dashboard StatBadge） | Phase 2 | 首屏 JS -25KB |
| P0 | React Query 引入 + 乐观更新（执行/拒绝） | Sprint 3b | 操作反馈 < 100ms |
| P1 | Streaming SSR + Suspense（Inbox、Dashboard） | Phase 2 | LCP -400ms |
| P1 | Query key 设计 + staleTime 配置 | Sprint 3b | 重复请求 -30% |
| P1 | Product Workspace 相邻 Tab 预取 | Phase 2 | Tab 切换 < 300ms |
| P2 | Platform Matrix color 预计算（替代大量 color-mix） | Phase 2 | 重绘成本 -20% |
| P2 | CSS containment（Matrix 行、散点图） | Phase 2 | 重排范围缩小 |
| P2 | will-change 滑动卡片 | Phase 3 | 60fps 稳定 |
| P3 | ISR for Supplier、Knowledge Layer A | Phase 2 | 供应商 TTI -200ms |
| P3 | Link prefetch 按角色裁剪 | Phase 2 | 预取带宽 -40% |

---

## 度量与验收

| 指标 | 当前（估算） | 目标 | 验证方式 |
|------|-------------|------|----------|
| Operator Inbox LCP | ~2.0s | < 1.2s (4G) | Lighthouse Mobile |
| Product Tab 切换 | 未测 | < 300ms | 手工 + Performance API |
| 执行/拒绝反馈延迟 | ~500ms+ | < 100ms（乐观） | 手工计时 |
| Dashboard 首屏 LCP | ~1.8s | < 1.5s | Lighthouse |
| CLS | 未测 | < 0.1 | Lighthouse + RUM |
| INP | 未测 | < 200ms | Lighthouse + RUM |
