# ADR: pg-boss + K8s CronJob 替代 Celery

## 状态

Accepted

## 背景

Phase 1 规范要求 Celery 骨架 + `dispatch_by_tenant` 签名。
本系统在 Phase 0 阶段已选择 pg-boss (PostgreSQL-backed queue) 作为调度基础设施，
配合 K8s CronJob 和 Python asyncio scheduler 完成了全部调度需求。

引入 Celery 将制造双调度系统，增加运维复杂度且无额外收益。

## 决策

保持 pg-boss (TS) + asyncio scheduler (Python) + K8s CronJob 路线。不引入 Celery。

## 等价映射

| Celery 概念 | 本系统映射 | 对应代码位置 |
|------------|-----------|-------------|
| `task.delay()` | `pg-boss.publish()` | `apps/api/src/queue.ts` |
| worker | queue.ts work handler | `apps/api/src/queue.ts` L545+ |
| Beat scheduler | K8s CronJob | `k8s/cronjobs/market-updater.yaml` |
| `tenant-first` arg | `job.data.tenantId` | queue.ts 每个 handler 首参数 |
| result backend | `AgentExecutionLog` | Prisma schema + RLS |
| retry/backoff | pg-boss built-in retry | pg-boss `retryLimit` + `retryDelay` |

## tenant-first dispatch 验证

pg-boss 每个 job handler 开头执行:
```sql
SET_CONFIG('app.tenant_id', job.data.tenantId, true)
```
确保 RLS 在整个任务执行链路中生效。

## 验证

- pg-boss worker 启动无报错: `pnpm --filter @apps/api dev`
- tenant dispatch 可审计: `AgentExecutionLog` 记录 `tenantId`
- K8s CronJob 已配置 3 层调度: hourly (exchange rate) / quarterly (tax rate AI check) / monthly (compliance scan)
