# Harness AI Governance Runtime — Performance Analysis

**分析日期**: 2026-03-03  
**分析范围**: harness-ledger-service.ts, portal-agent.ts, harness-routes.ts, support-routes.ts

---

## 1. Performance Summary

| 维度 | 评估 | 说明 |
|------|------|------|
| **handleConsumerMessage 热路径** | 中风险 | 存在冗余查询 + 同步写入，预估 +50–80ms DB 延迟 |
| **loadTenantKnowledge** | 低风险 | 使用 updateMany 已为批量写，1000 回复/天可承受 |
| **POST /harness/feedback** | 高风险 | N+1：updateKnowledgeImpact 逐条 update |
| **POST /cases/:id/close** | 低风险 | 事务 2–3 操作，时长短 |
| **updateKnowledgeImpact** | 高风险 | 必须改为 updateMany |
| **loadAgentPolicy** | 中风险 | maturityConfig 被重复加载 |
| **缺失索引** | 中风险 | ConfidenceLedger 反馈查询缺少复合索引 |

---

## 2. Critical Issues

### 2.1 【高】updateKnowledgeImpact — N+1 查询

**位置**: `harness-ledger-service.ts:140–155`

```typescript
for (const id of knowledgeIds) {
  await prisma.knowledgeEntry.update({
    where: { id },
    data: { impactScore: { increment: delta } },
  });
}
```

**影响**:
- knowledgeUsed 一般为 1–5 条，每次 feedback 会触发 1–5 次独立 UPDATE
- 100 条 feedback/天 × 平均 3 条 knowledge → 300 次 UPDATE
- 规模放大时（例如 1000 feedback/天）→ 3000 次 UPDATE，明显放大数据库负载

**建议**:

```typescript
export async function updateKnowledgeImpact(
  knowledgeIds: string[],
  delta: number,
): Promise<void> {
  if (knowledgeIds.length === 0) return;
  try {
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: knowledgeIds } },
      data: { impactScore: { increment: delta } },
    });
  } catch (e) {
    console.error('[Harness] Knowledge impact update failed:', e instanceof Error ? e.message : 'unknown');
  }
}
```

**预期**: 单次 feedback 从 N 次 UPDATE 变为 1 次，10x feedback 场景下约减少 90% 写操作。

---

### 2.2 【高】POST /harness/feedback 调用链导致的 N+1

**位置**: `harness-routes.ts:82–112`

流程为：
1. `feedbackSignal.create` — 1 写
2. `confidenceLedger.findFirst` — 1 读
3. `updateLedgerFeedback` → `findUnique` + `update` — 2 次操作
4. `updateKnowledgeImpact(knowledgeUsed)` — 当前为 N 次 update

**建议**: 在完成对 `updateKnowledgeImpact` 的优化（2.1）后，整体 feedback 路径的 DB 操作数会显著下降，无需再单独优化其它步骤。

---

## 3. Optimization Opportunities

### 3.1 【中】handleConsumerMessage — maturityConfig 重复加载

**位置**: `portal-agent.ts:245–253`

```typescript
const [policy, maturityConfig] = await Promise.all([
  loadAgentPolicy(tenantId),      // 内部已调用 loadTenantMaturityConfig
  loadTenantMaturityConfig(tenantId),  // 重复
]);
```

`loadAgentPolicy` 内部已并行调用 `loadTenantMaturityConfig`，外部再次调用造成重复查询。

**影响**:
- 每次 agent 回复多 1 次 `tenantMaturity.findUnique`
- 约 +5–15ms，取决于 DB 延迟

**建议**: 让 `loadAgentPolicy` 一并返回 maturity 信息，避免二次查询：

```typescript
// loadAgentPolicy 改为返回 { policy, maturityConfig }
async function loadAgentPolicy(tenantId: string): Promise<{
  policy: AgentPolicyConfig;
  maturityConfig: { maturityScore: number; autonomyLevel: string; escalationThreshold: number };
}> {
  const [policyRow, maturityConfig] = await Promise.all([...]);
  return {
    policy: { ... },
    maturityConfig,
  };
}

// handleConsumerMessage
const { policy, maturityConfig } = await loadAgentPolicy(tenantId);
```

---

### 3.2 【中】handleConsumerMessage 热路径 DB 序列

**当前顺序**:
1. 2 并行：policy + maturity（含冗余）
2. loadContext：1 查询 + 2 并行（warranty + faqs）
3. loadTenantKnowledge：findMany + updateMany
4. LLM 调用
5. create message + update case
6. writeConfidenceLedger（void，异步）

**延迟估算**:
- 步骤 1–3：约 4–6 次 DB 往返（若去重后约 4–5 次）
- 每次约 5–15ms → 合计约 20–75ms
- LLM 流式调用通常为 500–2000ms，占比最大

**建议**:
- 完成 3.1 的去重，可节省约 1 次 DB 调用
- `writeConfidenceLedger` 已为 `void`，不阻塞响应，符合预期

---

### 3.3 【低】loadTenantKnowledge — usageCount 写入量

**位置**: `harness-ledger-service.ts:93–117`

每次 agent 回复会：
- 1 次 `findMany`（limit=5）
- 1 次 `updateMany`（更新最多 5 条记录的 usageCount/lastUsedAt）

**影响**: 1000 回复/天 ≈ 42 次/小时，每次 1 读 + 1 写，负载可接受。

**可选优化**: 若未来写入成为瓶颈，可改为：
- 采样写入（如每 10 次写入 1 次）
- 或使用后台任务批量更新（需评估一致性）

当前规模下无需改动。

---

## 4. Scalability Assessment

### 4.1 数据量增长

| 指标 | 当前假设 | 10x | 100x |
|------|----------|-----|------|
| Agent 回复/天 | 100–500 | 1k–5k | 10k–50k |
| Feedback/天 | 20–100 | 200–1k | 2k–10k |
| Knowledge 条目/tenant | 50–200 | 500–2k | 5k–20k |

**建议**:
- 必须先完成 `updateKnowledgeImpact` 的 updateMany 优化
- 10x 以上时考虑 `loadTenantKnowledge` 的 usageCount 写入策略（采样或异步）

### 4.2 并发用户

- `handleConsumerMessage` 为无状态，LLM 为主要瓶颈
- 每请求的 DB 调用数控制在约 6–8 次（去重后），可支撑较高并发
- `writeConfidenceLedger` 为 fire-and-forget，不增加响应时间

### 4.3 内存

- Knowledge 注入：最多 5 条 × 200 字符 ≈ 1KB
- 历史消息：maxHistoryMessages 默认 20，每条数百字符，总量约 10–20KB
- 整体内存压力低，无需特别优化

---

## 5. Database Index Recommendations

### 5.1 ConfidenceLedger — 反馈查询

**当前查询**（`harness-routes.ts:90–95`）:
```typescript
where: { caseId: body.caseId, tenantId: auth.tenantId, feedbackType: null }
orderBy: { createdAt: 'desc' }
```

**现有索引**: `@@index([tenantId, caseId])`

**建议**: 为 `feedbackType` 和排序增加复合索引，减少过滤和排序代价：

```prisma
@@index([tenantId, caseId, feedbackType, createdAt(sort: Desc)])
```

### 5.2 PolicyConfig — 时间范围查询

**当前查询**（`portal-agent.ts:26–35`）:
```typescript
where: {
  tenantId,
  policyKey: 'portal_agent',
  effectiveFrom: { lte: new Date() },
  OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
}
orderBy: { effectiveFrom: 'desc' }
```

**现有索引**: `@@index([tenantId, brandId, productId, policyKey])`

该索引对 `tenantId + policyKey` 前缀足够；若 `policyKey` 常为固定值（如 `portal_agent`），查询计划通常可接受。可先观察 EXPLAIN，如有必要再考虑 `(tenantId, policyKey, effectiveFrom DESC)` 复合索引。

### 5.3 KnowledgeEntry

**现有**:
- `@@index([tenantId, status, effectiveWeight(sort: Desc)])`
- `@@index([tenantId, category])`

`loadTenantKnowledge` 按 `tenantId + status + category` 过滤并按 `effectiveWeight DESC` 排序，现有索引已基本覆盖。

---

## 6. Recommended Actions (优先级)

| 优先级 | 操作 | 预期收益 | 实现成本 |
|--------|------|----------|----------|
| P0 | updateKnowledgeImpact 改为 updateMany | 显著降低 feedback 路径 DB 负载 | 低 |
| P1 | 消除 maturityConfig 重复加载 | 每请求省 1 次 DB 调用、约 5–15ms | 低 |
| P2 | ConfidenceLedger 复合索引 | 加快反馈查询 | 低 |
| P3 | 监控 loadTenantKnowledge 写入量 | 为 10x+ 场景提前评估 | 中 |

---

## 7. Transaction Duration (POST /cases/:id/close)

**位置**: `support-routes.ts:154–179`

事务内仅包含：
- 1× `supportCase.update`
- 0–1× `knowledgeEntry.create`（有 writeback 时）

均为单表写操作，预计事务时长在 10–30ms 内，无需额外优化。
