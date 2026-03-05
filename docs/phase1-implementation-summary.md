# Phase 1 实施完成文档（MVP）

## 1. 文档目的
本文件用于沉淀 Phase 1（Week0-Week8）落地结果，明确：
- 已完成的实施细节
- 当前系统的核心特点与能力边界
- 继续开发（Phase 2+）时必须遵循的注意事项

适用读者：技术负责人、后端/API、Agent 开发、前端运营面板开发、测试与运维。

---

## 2. 总体完成度概览
Phase 1 目标是将系统从“人工经验运营”推进为“可编程运营体”。当前已达成：
- Product-Centric 数据底座落地（Product/Commodity/Listing/PerformanceSnapshot）
- Agent-Native 执行链路跑通（Intent -> Policy/Constitution -> Execution/Approval）
- Human-in-the-loop 审批中断/恢复闭环完成
- Week7 真实适配器工程骨架完成（LWA 刷新、分组限流、报告解析链路）
- Week8 一键验收脚本与 soak 稳定性脚本可直接执行

当前仓库状态已支持：
- `pnpm week8:validate`（6 个 E2E 场景）
- `pnpm week8:soak`（可配置压测时长/频率）

---

## 3. 实施细节（按周）

## Week0：工程骨架与协作契约
- 建立 pnpm + Turbo monorepo。
- 建立 OpenAPI 契约作为 TS/Python 协作单一真相源。
- 建立基础目录：`apps/api`、`apps/web`、`apps/agent-py`、`packages/*`。

关键产物：
- `packages/agent-contract/openapi.yaml`
- 根级 `turbo.json` / `pnpm-workspace.yaml` / CI workflow

## Week1：数据内核（Product-Centric）
- 完成 Prisma 核心模型：Tenant/Brand/Product/Commodity/Listing/PerformanceSnapshot/ApprovalQueue/AgentExecutionLog/PolicyConfig/PolicySnapshot。
- 实现 SQL 硬化：RLS、排他约束、防重叠策略窗口、PG NOTIFY 审批事件触发。
- 建立 Killer Query 与基准脚本。

关键结论：
- 同一 Commodity 在同一平台可有多 Listing（支持主次与 A/B）。

## Week2：API + Queue + Mock Adapter
- Hono API 路由落地。
- pg-boss 队列接入，`ads-agent:run` 可异步执行。
- Mock Amazon Ads 适配器落地：确定性数据、500ms 延迟、报告状态流转。
- 审批 SSE 通道打通。

## Week3：审批 Dashboard + SSE 实时联动
- Next.js Dashboard 落地（审批列表、approve/reject、SSE 连接状态）。
- API 增加 CORS 与事件推送稳定性处理。

## Week4：LangGraph 核心大脑接入
- Python `agent-py` 服务落地：`/run` + `/run/sync`。
- LangGraph 节点链路实现：
  - `load_performance_node`
  - `analyze_and_decide_node`
  - `risk_check_node`
  - `constitution_check`
  - `auto_execute_node`
- API 队列支持运行时切换到 Python（`ADS_AGENT_RUNTIME=python`）。

## Week5：产品中心重构增强 + 双层 Agent
- API 增加 Listing 管理接口。
- 生命周期自下而上同步实现：`Listing -> Commodity -> Product`。
- Agent 双层协同实现：
  - `Commodity Supervisor`
  - `Listing Agent`

## Week6：Human-in-the-loop 完整化
- 高风险中断后进入审批，审批通过可 resume。
- 新鲜度校验（`validate_freshness`）加入 Agent 图。
- `resolveParams` 四级参数解析与 `PolicySnapshot` 持久化。
- 批量审批过期接口实现（`/approvals/expire`）。

## Week7：真实环境接入骨架 + 断路器
- Real Amazon adapter 实现：
  - LWA token 并发安全刷新
  - API 分组限流（p-queue）
  - 报告轮询、GZIP 下载、NDJSON 解析
- 跨运行断路器实现：同目标连续 3 次异常后第 4 次 `CIRCUIT_OPEN`。

## Week8：验收自动化
- 一键 E2E 验收脚本：`pnpm week8:validate`。
- 稳定性压测脚本：`pnpm week8:soak`。
- 新增审批取消端点，覆盖“审批过期取消”场景。

---

## 4. Phase 1 已实现特点

## 4.1 架构特点
- Intent-First：Agent 输出标准 Intent，不绕过治理层直接改核心数据。
- Product-Centric：以 Product/Commodity/Listing 为主轴，不以 Campaign 作为真相源。
- Federated-Ready：平台适配层可插拔，Mock/Real 可环境变量切换。
- Governance-Gated：高风险走审批，执行路径可追溯。

## 4.2 工程特点
- API/Agent/DB 职责边界清晰：
  - API：协调/治理/路由
  - Agent：策略与决策图
  - DB：审计与状态事实
- 审计可回放：`AgentExecutionLog` + `PolicySnapshot` + `ApprovalQueue`。
- 事件驱动链路：PG NOTIFY -> SSE -> Dashboard。

## 4.3 可运维性特点
- 一键验收脚本可重复执行。
- 支持 soak 压测与关键链路回归。
- 断路器降低连续异常导致资金风险。

---

## 5. 当前能力边界（明确不在 Phase 1 范围）
- 未接入完整多平台生产连接（Walmart/Meta/TikTok 仍待扩展）。
- Contextual Bandit / RL 仅预留路线，未进入生产策略闭环。
- GDO 多 Swarm 仲裁尚未形成完整“政府层”执行体。
- 真实 Amazon 线上联通依赖实际账号凭据、配额和安全策略。

---

## 6. 继续开发注意事项（重点）

## 6.1 架构约束（必须遵守）
1. Agent 不可直接写库或直连业务执行函数，必须经 Intent + Policy + Approval 路径。
2. 不得绕过 Product/Commodity/Listing 模型做“平台特化捷径”建模。
3. 跨域协作优先事件驱动，避免服务间直接读写彼此数据库。

## 6.2 数据与治理
1. 所有新增策略参数必须进入 PolicyConfig 体系，禁止硬编码。
2. 每次运行必须保留 policySnapshot 与 reasoning 证据链。
3. 审批恢复必须做 freshness 验证，避免“旧信号新执行”。

## 6.3 稳定性与风控
1. 保持断路器策略可解释且可人工复位。
2. 真实 API 接入需做好：幂等、重试退避、速率配额告警。
3. 高风险默认拦截，任何自动放宽阈值都应可审计并有人工授权。

## 6.4 测试策略
1. 每次新增治理规则，都需新增至少一个 E2E 场景覆盖。
2. 保持 `week8:validate` 为主回归入口，不允许长期漂移失效。
3. 对关键状态机（AWAITING_APPROVAL/RESUMED_COMPLETED/CIRCUIT_OPEN/EXPIRED）建立断言级测试。

## 6.5 配置与环境
1. 将敏感凭据放入安全密钥管理，不写入仓库。
2. 生产环境中区分 Mock 与 Real，禁止混用配置。
3. 对 `AMAZON_ADS_MODE=real` 增加启动前配置自检与失败快速退出。

---

## 7. 建议的 Phase 2 开发顺序
1. Co-pilot 意图解析与路由（自然语言 -> Intent）
2. 多平台插件扩展（Walmart/Meta/TikTok）
3. Priority Resolver + GDO（多 Agent 冲突治理）
4. Contextual Bandit 替换固定调参逻辑

说明：在 GDO/优先级机制未上线前，不建议同时大规模扩展多自治 Agent 写操作能力。

---

## 8. 运维与验收命令
- 一键验收：`pnpm week8:validate`
- 稳定性压测：`pnpm week8:soak`
- 全仓校验：`pnpm lint && pnpm test && pnpm build`

---

## 9. 交接结论
Phase 1 已达到“可编程运营体”目标：
- 有单一真相源的数据内核
- 有可拦截、可审批、可恢复的治理链路
- 有可观测、可回放、可压测的工程基础

Phase 2 起建议重点放在“多 Agent 协调治理能力”而非盲目增加策略复杂度。
