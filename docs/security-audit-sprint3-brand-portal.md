# Brand Support Portal Sprint 3 — 安全审计报告

**审计范围**: Consumer Authentication + Warranty Registration  
**审计日期**: 2026-03-02  
**审计人**: Security Sentinel Agent

---

## 执行摘要

本审计覆盖 Brand Support Portal Sprint 3 的消费者认证与质保注册流程，包括客户端 token 存储、OTP 流程、表单校验、错误处理与后端授权。发现 **2 个 P1（严重）**、**5 个 P2（重要）**、**4 个 P3（建议）** 问题。

---

## P1 — 严重

### P1-1: localStorage 存储 JWT 导致 XSS 窃取风险

**文件**: `apps/portal/lib/auth.ts`  
**行号**: 18–20

```17:21:apps/portal/lib/auth.ts
export function setAuth(token: string, consumer: PortalConsumer): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CONSUMER_KEY, JSON.stringify(consumer));
}
```

**问题**: JWT 与 consumer 信息保存在 `localStorage`。一旦页面存在 XSS，恶意脚本可通过 `localStorage.getItem('portal_token')` 窃取 token 并劫持会话。

**影响**: 会话劫持、越权访问、数据泄露。

**修复建议**:
1. 优先使用 httpOnly Secure SameSite cookies 存储 token（需配合 API 支持）。
2. 短期可保留 localStorage，但需强化 CSP、减少 XSS 面，并设置短期 token TTL（如 7d 已有，可考虑缩短到 24h 或 1h）。

---

### P1-2: 生产环境 PORTAL_JWT_SECRET 未强制校验

**文件**: `apps/api/src/env.ts`  
**行号**: 14–26, 51

```14:26:apps/api/src/env.ts
const PRODUCTION_REQUIRED_SECRETS = [
  'RUN_INTENT_SIGNING_SECRET',
  'DECISION_TOKEN_SECRET',
  'S2S_SIGNING_SECRET',
] as const;

if (process.env.NODE_ENV === 'production') {
  for (const key of PRODUCTION_REQUIRED_SECRETS) {
    if (!process.env[key]) {
      throw new Error(`Missing required secret in production: ${key}`);
    }
  }
}
```

`PORTAL_JWT_SECRET` 使用默认值 `'dev-portal-jwt-secret-change-me'`，且未包含在 `PRODUCTION_REQUIRED_SECRETS` 中。

**问题**: 生产环境若未显式配置 `PORTAL_JWT_SECRET`，将使用开发默认值，攻击者可伪造任意 Portal JWT。

**影响**: 认证完全绕过、任意消费者身份冒充。

**修复建议**: 将 `PORTAL_JWT_SECRET` 加入 `PRODUCTION_REQUIRED_SECRETS`。

---

## P2 — 重要

### P2-1: 直接透传后端错误信息导致信息泄露

**文件**: 
- `apps/portal/lib/portal-api-client.ts` 第 42–43 行
- `apps/portal/components/email-verify.tsx` 第 41–44, 86–88 行
- `apps/portal/components/warranty-form.tsx` 第 41–44 行
- `apps/portal/components/warranty-list.tsx` 第 51–52 行

```41:44:apps/portal/lib/portal-api-client.ts
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new PortalClientError(res.status, body.error ?? res.statusText);
  }
```

**问题**: 后端返回的 `body.error` 被原样抛出并展示给用户，可能包含：

- 业务细节：如「Serial number already registered」
- 枚举信息：如「No verification code found」「Verification code expired」「Invalid verification code」
- 内部结构信息，增加攻击面

**修复建议**: 
1. 后端对面向消费者的接口返回通用错误文案（如「Verification failed」「Request failed」），将详细错误仅记录日志。
2. 客户端根据 `status` 映射到固定用户友好文案，不直接展示 `body.error`。

---

### P2-2: OTP 验证响应差异支持邮箱枚举

**文件**: `apps/api/src/portal-auth.ts`  
**行号**: 178–199

```178:199:apps/api/src/portal-auth.ts
  if (!entry) {
    return c.json({ error: 'No verification code found. Please request a new one.' }, 400);
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(storeKey);
    return c.json({ error: 'Verification code expired' }, 400);
  }

  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(storeKey);
    return c.json({ error: 'Too many attempts. Please request a new code.' }, 429);
  }
  // ...
  if (!isValid) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
```

**问题**: 不同错误响应可区分：

- 「No verification code found」：该邮箱未发起或已消费 OTP
- 「Verification code expired」：该邮箱曾发起 OTP 且已过期
- 「Invalid verification code」：该邮箱有未过期的有效 OTP
- 「Too many attempts」：该邮箱有 OTP 且尝试次数超标

攻击者可通过对比响应推断哪些邮箱有活跃 OTP，用于定向钓鱼或社工。

**修复建议**: 对以上场景统一返回同一文案和状态码（如 400 +「Verification failed」），在服务端打日志以区分真实原因。

---

### P2-3: purchaseChannel 未做白名单校验

**文件**: `apps/api/src/portal-routes.ts`  
**行号**: 289–311

```289:311:apps/api/src/portal-routes.ts
  if (!body.commodityId || !body.serialNumber || !body.purchaseDate || !body.purchaseChannel) {
    return c.json({ error: 'commodityId, serialNumber, purchaseDate, and purchaseChannel are required' }, 400);
  }
  // ...
  if (body.purchaseChannel.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'purchaseChannel too long' }, 400);
  }
```

**问题**: 仅校验长度，未限制取值。前端下拉为 `['amazon','official','retail','other']`，后端可接受任意 255 字符以内字符串，易产生数据污染和统计偏差。

**修复建议**: 后端增加白名单校验：

```ts
const ALLOWED_CHANNELS = new Set(['amazon', 'official', 'retail', 'other']);
if (!ALLOWED_CHANNELS.has(body.purchaseChannel)) {
  return c.json({ error: 'Invalid purchaseChannel' }, 400);
}
```

---

### P2-4: 401 时仅清理本地状态，无重定向/通知

**文件**: `apps/portal/lib/portal-api-client.ts`  
**行号**: 36–39

```36:39:apps/portal/lib/portal-api-client.ts
  if (res.status === 401 && auth) {
    clearAuth();
    throw new PortalClientError(401, 'Session expired');
  }
```

**问题**: 401 时仅清除 token 并抛错，调用方需自行处理。若 `WarrantyList`、`WarrantyForm` 等未统一处理，用户可能停留在需登录页面而不知已登出，产生困惑或误操作。

**修复建议**: 在全局或 API 层增加 401 回调（如重定向到登录/首页、显示 toast），并确保所有需要认证的组件都能感知到已登出。

---

### P2-5: imageUrls 直接作为 img src 无 URL 校验

**文件**: 
- `apps/portal/components/warranty-list.tsx` 第 136–139 行
- `apps/portal/components/product-sidebar.tsx` 第 43–45 行

```136:141:apps/portal/components/warranty-list.tsx
                {w.commodity.product.imageUrls?.[0] ? (
                  <img
                    src={w.commodity.product.imageUrls[0]}
                    alt={w.commodity.product.name}
```

**问题**: `imageUrls` 来自数据库/管理端，若被污染可能包含 `javascript:`、`data:` 等 scheme。浏览器对 `img.src` 中的 `javascript:` 已普遍拦截，但 `data:` 仍可能带来性能或异常内容风险。且无协议与域名白名单，难以控制图片来源。

**修复建议**: 
1. 后端或中间层对 `imageUrls` 做 scheme 白名单（仅允许 `http`/`https`）。
2. 前端在渲染前校验 URL 是否以 `https://` 或 `http://` 开头，再设置 `src`，否则用占位图或跳过。

---

## P3 — 建议

### P3-1: commodityId 未做客户端校验

**文件**: `apps/portal/components/screen-warranty.tsx`、`apps/portal/components/warranty-form.tsx`  
**来源**: `apps/portal/app/warranty/page.tsx` 中 `searchParams.commodity` 直接透传。

**问题**: `commodityId` 来自 URL query，若未校验格式，可能向 API 发送非法 UUID，增加无效请求与错误日志。

**修复建议**: 在进入质保流程前校验 `commodityId` 为有效 UUID，无效则跳转或提示。

---

### P3-2: JWT 无客户端过期检查

**文件**: `apps/portal/lib/auth.ts`

**问题**: 仅用 `getToken()` 存在性判断登录态，不解析 JWT 过期时间。过期 token 仍会发送到 API，直到 401 才清理，导致多余请求与短暂“已登录”的假象。

**修复建议**: 增加 `isTokenExpired()`，解析 payload 的 `exp`，若已过期则 `clearAuth()` 并视为未登录。

---

### P3-3: serialNumber 无格式约束

**文件**: `apps/api/src/portal-routes.ts` 第 304 行、`apps/portal/components/warranty-form.tsx`

**问题**: 后端只校验长度 1–255，无字符集或格式限制。若未来在报表、导出或展示中使用不当，可能引入注入或展示问题。

**修复建议**: 根据业务定义合法字符集（如字母、数字、连字符、下划线），后端用正则校验，前端可增加简单格式提示。

---

### P3-4: 缺少显式登出/会话清理入口

**文件**: `apps/portal/lib/auth.ts`、导航/布局组件

**问题**: 有 `clearAuth()` 但未见统一「登出」入口，用户可能长期保持登录状态，在共享设备上增加风险。

**修复建议**: 在用户菜单或导航中增加「登出」按钮，调用 `clearAuth()` 并跳转到首页或登录页。

---

## 已确认安全实践

| 项目 | 说明 |
|------|------|
| OTP 防时序攻击 | `portal-auth.ts` 使用 `crypto.timingSafeEqual` 比较 OTP |
| OTP 尝试次数限制 | `OTP_MAX_ATTEMPTS = 3`，超限后删除 entry |
| OTP 冷却 | `OTP_COOLDOWN_MS = 60s` 限制重复发送 |
| OTP 过期 | `OTP_TTL_MS = 10min` |
| OTP 随机性 | `crypto.randomInt(100000, 999999)` |
| 租户隔离 | `commodity.tenantId !== auth.tenantId` 与 `consumerId` 严格隔离 |
| JWT 验证 | `jwtVerify` 校验 issuer、audience、签名 |
| UUID 校验 | 对 `commodityId`、`brandId`、`id` 等做 `UUID_RE` 校验 |
| CSRF | Bearer 放在 Header，不随 form 自动提交，降低 CSRF 影响 |
| CORS | 生产环境使用 `CORS_ORIGIN`，开发环境限定本地端口 |

---

## 修复优先级路线图

1. **立即**: P1-2（将 `PORTAL_JWT_SECRET` 加入生产必选）  
2. **Sprint 内**: P1-1（评估 cookie 方案或强化 XSS 防护）、P2-1（统一错误处理）、P2-2（OTP 响应统一）  
3. **下一迭代**: P2-3（`purchaseChannel` 白名单）、P2-4（401 全局处理）、P2-5（`imageUrls` 校验）  
4. **技术债**: P3 各项按排期实施

---

*本报告由 Security Sentinel Agent 生成。*
