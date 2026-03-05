# CLAUDE.md — AI IDE 基准文件

## 1. 项目概述

跨境电商 AI 原生 SaaS 系统。
核心模型: Tenant > Brand > Product > Commodity > Listing
技术栈: pnpm + Turbo monorepo, Next.js 15, Hono, Prisma, LangGraph, Google GenAI

→ 详见 [PROJECT.md](./PROJECT.md)

## 2. 架构与结构

→ 详见 [ARCHITECTURE.md](./ARCHITECTURE.md)（14 个 ADR）
→ 详见 [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)（实体关系）
→ 详见 [MCP_SPEC.md](./MCP_SPEC.md)（Agent 接口规范）

目录速查:

```
apps/api        — Hono 后端 (port 3300)
apps/web        — 运营 Dashboard (Next.js)
apps/portal     — 品牌消费者门户 (Next.js, port 3100)
apps/agent-py   — Python AI Agent (FastAPI + LangGraph, port 8001)
apps/copilot    — Copilot 前端
packages/database — Prisma schema + migrations
markets_seed/   — 市场合规种子数据（独立 CLAUDE.md）
infra/docker    — Docker Compose (Postgres + Redis + MinIO)
k8s/cronjobs    — 生产调度 (3-layer market updater)
scripts/        — CI/Lint/DB setup 脚本
```

## 3. 常用命令

```bash
# 依赖安装
pnpm install

# 基础设施
docker compose -f infra/docker/docker-compose.yml up -d

# 开发
pnpm dev                              # 启动所有 dev server
pnpm build                            # 全量构建
pnpm typecheck                        # TypeScript 类型检查
pnpm lint                             # ESLint

# 数据库
pnpm db:generate                      # Prisma client 生成
pnpm db:migrate                       # Prisma 迁移
psql $DATABASE_ADMIN_URL -f scripts/setup-app-user.sql
psql $DATABASE_ADMIN_URL -f packages/database/migrations/0001_week1_hardening.sql
psql $DATABASE_ADMIN_URL -f packages/database/migrations/0003_rls_governance_tables.sql

# 种子数据
pnpm --filter @apps/api seed:harness  # Harness 全量种子

# 测试
pnpm test                             # Vitest (TS 单元测试)
pytest tests/test_phase1_harness.py -v  # Phase 1 Harness 12 项门禁
pytest markets_seed/tests/test_markets_compliance.py -v  # 市场合规
pytest apps/agent-py/test_sovereign_flow.py -v  # Agent 主权流

# 基础设施验证
bash scripts/test-infra-connectivity.sh

# Death Line
python scripts/lint_death_line.py
```

## 4. 编码规则

→ 详见 [AI_CODING_RULES.md](./AI_CODING_RULES.md)（16 节强制规则）
→ 详见 [.cursorrules](./.cursorrules)（主权架构宪法）

**Top 5 绝对禁令:**

1. 必须 tenantId 隔离 — 所有查询必须限定租户
2. 禁止硬编码 LLM 模型名 — 必须通过 ModelRouter
3. Death Line: 认知层禁止 import 平台/DB 模块
4. 所有功能必须双轨（UI + MCP Tool）
5. 支付/退款必须 Human Gate

## 5. 关键上下文与陷阱

- `Product × Market = Commodity`（非直觉的领域模型）
- RLS 基于 `SET LOCAL app.tenant_id`，非 WHERE 条件
- Mapping 查询永远用 `status = 'APPROVED'`，禁止 `!= 'REJECTED'`
- entity_hash 格式: `platform:entity_type:external_id` (全小写, SHA256)
- CostVersion 查询必须包含时间窗口: `effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo > now)`

**调度层决策（替代 Celery）:**
本系统未采用 Celery。调度层使用 pg-boss (Postgres-backed queue) + K8s CronJob + asyncio scheduler，功能等价且满足 Phase 1 所有 tenant-first dispatch 要求。
→ 详见 [docs/decisions/celery-equivalence.md](./docs/decisions/celery-equivalence.md)

## 6. 测试策略

| 层级 | 工具 | 命令 |
|------|------|------|
| TS 单元测试 | Vitest | `pnpm test` |
| Phase 1 Harness | pytest (12 项黑盒) | `pytest tests/test_phase1_harness.py -v` |
| 市场合规 | pytest | `pytest markets_seed/tests/test_markets_compliance.py -v` |
| Agent 主权流 | pytest | `pytest apps/agent-py/test_sovereign_flow.py -v` |
| RLS 隔离验证 | tsx | `tsx apps/api/src/test-tenant-isolation.ts` |
| Infra 连通性 | bash | `bash scripts/test-infra-connectivity.sh` |
| Death Line | python | `python scripts/lint_death_line.py` |

CI 流水线 (`.github/workflows/ci.yml`) 包含 4 个 job:
1. `checks` — TS typecheck + lint + test + build
2. `python-tests` — Agent sovereign flow
3. `death-line` — Death Line + import-linter
4. `phase1-harness` — 12 项 Harness 门禁（需 Postgres + Redis + MinIO 服务）
