# MCP Tool 规范

本文件定义品牌客服门户暴露给外部 Agent 的 MCP 工具接口。
所有工具共享同一套 Service 层，与 REST API 行为一致。

---

## 现有 MCP 端点（已实现）

### `GET /products/:id/graph/mcp`

面向内部 Agent 的产品知识图谱。

```json
{
  "mcpVersion": "1.0",
  "entity": {
    "type": "product",
    "l1_entity": { "sku", "name", "brand", "category" },
    "l2_features": { "structuredFeatures" },
    "l3_scenarios": { "scenarios" },
    "l4_intents": { "targetIntents" },
    "l5_competitive": { "competitiveEdges" },
    "localizations": [{ "market", "language", "title", "bulletPoints" }]
  }
}
```

---

## Phase 1 — 门户 MCP 工具

### 公开工具（无需授权）

#### `get_product_info`
获取商品详情（面向消费者的本地化内容）。

```
input:  { merchandise_id: string }
output: {
  name: string,
  description: string,
  specs: object,
  images: { url, alt }[],
  warranty_policy: { period_months, coverage },
  return_policy: { period_days, conditions }
}
```

#### `search_faq`
搜索消费者 FAQ。

```
input:  { merchandise_id: string, query: string, language?: string }
output: {
  answers: { question, answer, category, confidence }[],
  total: number
}
```

#### `get_manual`
获取产品使用说明。

```
input:  { merchandise_id: string, section?: string }
output: {
  content: string,
  type: 'text' | 'pdf_url',
  sections: string[]
}
```

#### `get_purchase_channels`
获取购买渠道（主力 Listing）。

```
input:  { merchandise_id: string }
output: {
  channels: {
    platform: string,
    url: string,
    is_primary: boolean
  }[]
}
```

---

### 需要消费者身份验证的工具

认证方式：Bearer JWT（通过 `/portal/auth/verify-code` 获取）

#### `check_warranty_status`
查询质保状态。

```
input:  { serial_number: string }
output: {
  status: 'active' | 'expired' | 'voided' | 'not_found',
  expiry_date?: string,
  coverage?: string,
  remaining_days?: number
}
auth: consumer JWT
```

#### `register_warranty`
注册质保。

```
input: {
  merchandise_id: string,
  serial_number: string,
  purchase_date: string,
  channel: string,
  proof_of_purchase?: file_ref
}
output: {
  warranty_id: string,
  expiry_date: string,
  status: 'active'
}
auth: consumer JWT
```

#### `create_support_case`
创建客服工单。

```
input: {
  merchandise_id: string,
  issue_type: string,
  issue_description: string,
  media_refs?: string[]
}
output: {
  case_id: string,
  status: 'open',
  initial_response?: string,
  needs_human: boolean,
  agent_confidence?: number
}
auth: consumer JWT
```

#### `send_case_message`
发送工单消息。

```
input: {
  case_id: string,
  content: string,
  content_type: 'text' | 'media_ref'
}
output: {
  message_id: string,
  agent_response?: string,
  needs_human: boolean
}
auth: consumer JWT
```

#### `get_resolution_options`
获取工单解决方案选项。

```
input:  { case_id: string }
output: {
  options: {
    option_id: string,
    type: 'replacement' | 'refund' | 'repair' | 'info',
    description: string,
    estimated_time?: string
  }[],
  recommended: string
}
auth: consumer JWT
```

#### `select_resolution`
选择解决方案。

```
input:  { case_id: string, option_id: string }
output: {
  status: 'processing' | 'requires_human_confirmation',
  next_steps: string[],
  tracking_id?: string,
  confirmation_request_id?: string
}
auth: consumer JWT
constraint: 退款超 $50 返回 requires_human_confirmation
```

#### `submit_feedback`
提交产品反馈。

```
input: {
  merchandise_id: string,
  feedback_type: 'praise' | 'complaint' | 'suggestion' | 'question',
  detail: string
}
output: {
  feedback_id: string,
  sentiment_score?: number
}
auth: consumer JWT
```

---

### 需要人类确认的工具

#### `process_payment`
处理支付（永远返回支付链接，Agent 不能自主扣款）。

```
input:  { order_id: string, amount: number, currency: string, payment_method: string }
output: { payment_url: string, expires_at: string }
注意: 返回支付链接给消费者确认，Agent 永远不能自主完成支付
```

#### `approve_refund`
申请退款（超阈值需人类确认）。

```
input:  { case_id: string, amount: number, reason: string }
output: {
  requires_human_confirmation: true,
  confirmation_request_id: string,
  timeout_minutes: number
}
流程: 发送确认请求给品牌运营 → 等待人类确认令牌 → 执行退款
```

---

## Phase 2 — A2A 工具（预留）

### Agent OAuth 认证

消费者 Agent 调用需持有 OAuth 令牌：

```
Authorization: Bearer <agent_oauth_token>
X-Agent-Id: <consumer_agent_id>
X-Consumer-Id: <human_consumer_id>
```

令牌包含 scope 声明：`read:product`, `read:warranty`, `write:case`, `write:feedback`

### 预留工具

- `a2a_negotiate_resolution` — Agent 间协商解决方案
- `a2a_escalate_to_human` — Agent 请求人类介入
- `a2a_get_session_history` — 获取 A2A 会话历史

---

## 审计要求

所有 MCP 工具调用自动记录：

```json
{
  "timestamp": "ISO8601",
  "agent_id": "string | null",
  "consumer_id": "string | null",
  "tool_name": "string",
  "input_hash": "sha256",
  "output_hash": "sha256",
  "duration_ms": "number",
  "auth_method": "jwt | oauth | anonymous",
  "ip_country": "string"
}
```

---

## 错误响应格式

所有 MCP 工具使用统一错误格式：

```json
{
  "error": {
    "type": "AgentError | HumanRequiredError | SystemError",
    "code": "string",
    "message": "string",
    "details": {},
    "human_contact": "string | null"
  }
}
```

| 类型 | 含义 | 消费者 Agent 应如何处理 |
|------|------|------------------------|
| `AgentError` | 调用参数错误或业务规则拒绝 | 修正参数后重试 |
| `HumanRequiredError` | 需要人类介入 | 通知消费者联系客服 |
| `SystemError` | 系统内部错误 | 稍后重试或通知消费者 |

---

## 4. 汇率工具（内部 Agent 专用）

认证：内部 Agent JWT（`x-agent-token` header）
端点前缀：`GET /exchange-rates`

---

### `get_exchange_rate`

获取指定货币对的汇率（最新或指定日期）。

```
端点：GET /exchange-rates/daily/mcp
参数：
  base:   string          必填，基础货币，如 "USD"
  target: string          必填，目标货币，如 "CNY"
  date?:  string          可选，ISO date "YYYY-MM-DD"；不传返回最新一天

响应（成功）：
  {
    date:           string,   // "YYYY-MM-DD"
    baseCurrency:   string,
    targetCurrency: string,
    rate:           number,   // 1 base = rate target
    source:         string    // provider 名称
  }

响应（无数据）：null
```

**使用场景：**
- 利润计算时将 CNY 成本转换为目标市场货币
- 多货币定价策略推理
- 广告预算跨货币估算

---

### `get_monthly_avg_rate`

获取指定月份的月均汇率（含高低点和样本数）。

```
端点：GET /exchange-rates/monthly/mcp
参数：
  base:   string   必填，基础货币
  target: string   必填，目标货币
  year:   number   必填，年份，如 2025
  month:  number   必填，月份 1–12

响应（成功）：
  {
    year:           number,
    month:          number,
    baseCurrency:   string,
    targetCurrency: string,
    avgRate:        number,   // 月平均汇率
    minRate:        number,   // 月内最低汇率
    maxRate:        number,   // 月内最高汇率
    sampleCount:    number    // 计算使用的天数
  }

响应（无数据）：null
```

**使用场景：**
- 月度成本核算跨货币换算
- 历史利润趋势分析
- 汇率波动风险评估（通过 minRate/maxRate 判断月内震荡幅度）

---

### 数据安全保证（ADR-014）

- 两个工具均只返回已写入数据库的快照/月均值记录
- 不透传外部 API 原始响应，不含 `rawPayload` 字段
- AI 层只读，不可通过 MCP 工具修改汇率配置或触发同步
