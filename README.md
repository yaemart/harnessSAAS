# Cross-border Ecom AI Digital Enterprise (Phase 1 Week 1)

This repository contains the Week 1 foundation for a product-centric, agent-native system.

## Stack baseline
- Monorepo: pnpm + Turbo
- API runtime: Node.js (Hono in Week 2)
- Database: PostgreSQL + Prisma
- Prisma config: `packages/database/prisma.config.ts` (Prisma 7 style datasource URL)
- Agent runtime: Python (LangGraph in Week 4)
- Contract-first: OpenAPI in `packages/agent-contract/openapi.yaml`

## Workspace
- `apps/api` - API app placeholder
- `apps/web` - dashboard placeholder
- `apps/agent-py` - Python agent placeholder
- `apps/copilot` - copilot placeholder
- `packages/database` - Prisma schema, SQL migrations, benchmark scripts
- `packages/agent-contract` - OpenAPI contract
- `packages/shared-types` - shared TS types (Intent/AAP)
- `packages/policy-engine` - policy gate placeholder
- `packages/platform-adapters` - platform adapter placeholder

## Quick start
1. Install dependencies:
   - `pnpm install`
2. Start PostgreSQL:
   - `docker compose -f infra/docker/docker-compose.yml up -d`
3. Configure env:
   - `cp .env.example .env`
4. Generate Prisma client:
   - `pnpm db:generate`
5. Apply Prisma migrations (when created in Week 2+):
   - `pnpm db:migrate`
6. Apply hardening SQL manually:
   - `psql "$DATABASE_URL" -f packages/database/migrations/0001_week1_hardening.sql`
   - if your Prisma URL includes extra query params, pass a plain URL to psql, e.g. `psql "postgresql://user@localhost:5432/ai_ecom" -f ...`

## Week 1 deliverables map
- Day 1: monorepo/tooling/CI baseline
- Day 2: OpenAPI + Intent schema + shared TS types
- Day 3: product-centric Prisma model (12 tables)
- Day 4: SQL hardening (RLS + btree_gist + PG NOTIFY trigger)
- Day 5: killer query SQL + benchmark script

## Killer query benchmark
Run explain benchmark script:

```bash
BENCH_TENANT_ID=<uuid> pnpm --filter @repo/database db:bench
```

SLO target is 100ms execution time for indexed query path.

## Week 2 API (Hono + pg-boss + Mock + SSE)
1. Ensure database is migrated and hardened:
   - `pnpm db:migrate`
   - `DATABASE_URL=<your-url> pnpm --filter @repo/database exec prisma db execute --file migrations/0001_week1_hardening.sql`
2. Start API:
   - `DATABASE_URL=<your-url> AMAZON_ADS_MODE=mock pnpm --filter @apps/api dev`
3. Key endpoints:
   - `GET /health`
   - `POST /run`
   - `GET /approvals`
   - `POST /approvals/:id/approve`
   - `POST /approvals/:id/reject`
   - `GET /events/approvals` (SSE)

## Week 3 Dashboard (Next.js)
1. Start API first (default `http://localhost:3300`).
2. Start web dashboard:
   - `NEXT_PUBLIC_API_BASE_URL=http://localhost:3300 pnpm --filter @apps/web dev`
3. Open:
   - `http://localhost:3001`
4. Features:
   - live approval list
   - approve/reject actions
   - realtime updates from `/events/approvals`

## Week 4 LangGraph Agent
1. Start Python agent service:
   - `python3 -m venv /tmp/agentpy-venv`
   - `source /tmp/agentpy-venv/bin/activate`
   - `pip install -r apps/agent-py/requirements.txt`
   - `DATABASE_URL=<your-url> uvicorn src.main:app --app-dir apps/agent-py --host 127.0.0.1 --port 8001`
2. Start API with Python runtime:
   - `ADS_AGENT_RUNTIME=python AGENT_SERVICE_URL=http://127.0.0.1:8001 DATABASE_URL=<your-url> pnpm --filter @apps/api dev`
3. Contract:
   - `POST /run` returns `ACCEPTED`
   - LangGraph pipeline executes async and writes `AgentExecutionLog`
   - High risk (`score >= 0.7`) writes `ApprovalQueue`

## Week 5 Product-Centric Refinement
1. Dual-layer Agent orchestration in `agent-py`:
   - `Commodity Supervisor` node decides strategy boundaries for a commodity.
   - `Listing Agent` node applies listing-level optimization inside those boundaries.
2. Listing management endpoints:
   - `GET /listings`
   - `POST /listings`
   - `PATCH /listings/:id/status`
3. Lifecycle aggregation sync:
   - `POST /lifecycle/sync`
   - automatic aggregation on listing create/status update:
     - `Listing -> Commodity -> Product`

## Week 6 Human-in-the-loop + MDM policy snapshot
1. Interrupt/Resume:
   - high-risk operations (`risk >= 0.7`) enter `ApprovalQueue` with execution status `AWAITING_APPROVAL`.
   - `POST /approvals/:id/approve` resumes the same intent with `resumeApproved=true`.
2. Freshness validation:
   - API approval gate validates operation age before resume (`APPROVAL_FRESHNESS_TTL_MINUTES`).
   - Agent graph has `validate_freshness` node; stale signals return `REJECTED_STALE_CONTEXT`.
3. Policy MDM resolve + snapshot:
   - `/run` resolves policy inheritance (`Product -> Brand -> Tenant -> System`) and writes `PolicySnapshot`.
   - resolved values are injected into `intent.payload.policyParams`.
4. Approval expiry:
   - `POST /approvals/expire` marks old pending approvals as `EXPIRED`.

## Week 7 Real Amazon Ads integration + stability
1. Real adapter switch with zero business-code change:
   - set `AMAZON_ADS_MODE=real` and provide Amazon credentials in env.
2. LWA token refresh:
   - concurrency-safe refresh in `AmazonLwaTokenManager` (single in-flight refresh).
3. Grouped API throttling:
   - `p-queue` per API group (`reports`, `profile`, `default`).
4. Report pipeline:
   - request report -> poll status with backoff -> download GZIP -> parse NDJSON -> aggregate metrics.
5. Cross-run circuit breaker:
   - if same target has 3 consecutive failures, mark next run as `CIRCUIT_OPEN` and skip execution.

## Week 8 Validation and soak
1. One-shot E2E validation (6 scenarios):
   - `pnpm week8:validate`
   - scenarios include:
     - low-risk auto execute
     - high-risk approval intercept
     - approve -> resume
     - approval expiry
     - circuit breaker trigger
     - lifecycle rollup sync
2. Soak test runner:
   - `pnpm week8:soak`
   - configurable:
     - `WEEK8_SOAK_MINUTES` (default 10)
     - `WEEK8_SOAK_INTERVAL_SECONDS` (default 20)
     - `WEEK8_API_BASE` and `WEEK8_TENANT_ID`
