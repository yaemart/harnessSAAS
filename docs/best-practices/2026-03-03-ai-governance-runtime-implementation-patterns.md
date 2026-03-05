# AI Governance Runtime — 最佳实践与实现模式

> 针对 TypeScript / Prisma / PostgreSQL / Hono 技术栈的 AI Governance Runtime 实现指南。结合行业最佳实践与项目现有 schema 给出可直接落地的代码模式。

---

## 1. Knowledge Injection into LLM Prompts

### 1.1 Token 预算策略

将 context window 视为硬约束，预先分配 token 预算。[来源: AWS Prescriptive Guidance, Context Window Optimization]

```typescript
// apps/api/src/lib/token-budget.ts

const TOKEN_BUDGET = {
  systemInstructions: 500,   // Constitution + Authority
  userQuery: 200,
  conversationHistory: 1000,
  reservedOutput: 1000,
  safetyMargin: 200,
} as const;

export function getKnowledgeTokenBudget(modelContextWindow: number): number {
  return Math.floor(
    modelContextWindow -
    TOKEN_BUDGET.systemInstructions -
    TOKEN_BUDGET.userQuery -
    TOKEN_BUDGET.conversationHistory -
    TOKEN_BUDGET.reservedOutput -
    TOKEN_BUDGET.safetyMargin
  );
}
```

### 1.2 Category-Based Filtering + Weight Ranking（无向量搜索）

适用于 KnowledgeEntry 已有 category、effectiveWeight 的 schema：

```typescript
// apps/api/src/portal-agent.ts — loadTenantKnowledge

async function loadTenantKnowledge(
  prisma: PrismaClient,
  tenantId: string,
  opts: { category?: string; limit?: number; maxTokens?: number } = {}
): Promise<KnowledgeForPrompt[]> {
  const limit = opts.limit ?? 10;
  const where: Prisma.KnowledgeEntryWhereInput = {
    tenantId,
    status: { in: ['ACTIVE', 'DECAYING'] },
  };
  if (opts.category) where.category = opts.category;

  const entries = await prisma.knowledgeEntry.findMany({
    where,
    select: { id: true, content: true, effectiveWeight: true, category: true },
    orderBy: [
      { effectiveWeight: 'desc' },
      { usageCount: 'desc' },
      { lastUsedAt: 'desc' },
    ],
    take: limit * 2, // 多取一些，按 token 截断
  });

  // Token-aware selection: 每条限制 ~200 字，优先高权重
  const maxChars = (opts.maxTokens ?? 2500) * 4; // 粗略 1 token ≈ 4 chars
  const result: KnowledgeForPrompt[] = [];
  let totalChars = 0;
  for (const e of entries) {
    const truncated = e.content.length > 180 ? e.content.slice(0, 180) + '...' : e.content;
    if (totalChars + truncated.length > maxChars) break;
    result.push({ id: e.id, content: truncated, weight: e.effectiveWeight });
    totalChars += truncated.length;
  }
  return result;
}
```

### 1.3 Prompt 注入格式

```typescript
// 在 buildSystemPrompt 中注入

function buildKnowledgeSection(entries: KnowledgeForPrompt[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map(
    (e) => `[KE-${e.id.slice(0, 8)}] (weight: ${e.weight.toFixed(2)}): ${e.content}`
  );
  return `## Relevant Knowledge\n${lines.join('\n')}\n\nWhen citing knowledge, use [KE-xxx] markers.`;
}
```

### 1.4 追踪「哪些知识被 LLM 实际使用」

**方法 A：结构化输出（推荐）**

要求 LLM 在回复中附带 `knowledgeCited: string[]`：

```typescript
const responseSchema = z.object({
  reply: z.string(),
  knowledgeCited: z.array(z.string()).describe('IDs of knowledge entries cited'),
});

// 解析后写入 ConfidenceLedger.knowledgeUsed
```

**方法 B：后处理匹配**

从 LLM 回复文本中提取 `[KE-xxx]` 或 `KE-` 模式：

```typescript
function extractCitedKnowledgeIds(replyText: string, injectedIds: string[]): string[] {
  const cited: string[] = [];
  const prefixLen = 'KE-'.length;
  for (const id of injectedIds) {
    const short = id.slice(0, 8);
    if (replyText.includes(`[KE-${short}`) || replyText.includes(`KE-${short}`)) {
      cited.push(id);
    }
  }
  return cited;
}
```

**方法 C：Grounding API（若使用 Vertex AI）**

Vertex AI Search 提供 `check grounding` API，返回 support score 和 citation mapping；自建模型则依赖方法 A/B。

---

## 2. Confidence Ledger / Audit Log Patterns

### 2.1 不可变审计表设计

原则：**只 INSERT，不 UPDATE/DELETE**。需要“修正”时，写入新事件覆盖旧记录的可信状态，但保留原始行。

```sql
-- 已有 ConfidenceLedger 设计已符合 append-only
-- 建议：单独 schema 或 role 限制

-- 可选：增加 hash chain 用于篡改检测（高级）
-- ALTER TABLE "ConfidenceLedger" ADD COLUMN prev_hash TEXT;
-- ALTER TABLE "ConfidenceLedger" ADD COLUMN row_hash TEXT;
```

```prisma
// 如需更强不可变性，可增加：
model ConfidenceLedger {
  // ... 现有字段
  rowHash     String?   // SHA256(JSON.stringify(关键字段))
  prevRowHash String?   // 前一条的 rowHash，形成链
}
```

### 2.2 Fire-and-Forget 写入

主请求不等待 Ledger 写入完成，避免阻塞响应：

```typescript
// apps/api/src/lib/ledger-writer.ts

export function writeConfidenceLedgerFireAndForget(
  prisma: PrismaClient,
  data: Prisma.ConfidenceLedgerUncheckedCreateInput
): void {
  // 不 await，不阻塞
  void prisma.confidenceLedger
    .create({ data })
    .catch((err) => {
      // 失败时写入本地/远程 dead-letter 队列，避免静默丢失
      console.error('[ConfidenceLedger] fire-and-forget failed', err);
      // 可选：metrics.increment('ledger.write.failed')
    });
}
```

**注意**：Fire-and-forget 可能导致主流程成功而 Ledger 未写入。若需要最终一致性，推荐：

```typescript
// 方案 B：pg-boss 异步任务（推荐生产环境）
await boss.send('harness:ledger:write', { tenantId, caseId, ... });
// 主流程立即返回，worker 异步写入
```

### 2.3 异步反馈更新已有 Ledger 条目

ConfidenceLedger 允许 `feedbackType`、`feedbackAt`、`confidenceAfter` 等字段后填。为保持“逻辑不可变”，有两种做法：

**做法 A：允许 UPDATE 反馈字段（当前常见）**

仅更新反馈相关字段，不改变核心审计事实：

```typescript
async function applyFeedbackToLedger(
  prisma: PrismaClient,
  caseId: string,
  feedback: { type: string; reason?: string; sourceRole: string }
) {
  const ledger = await prisma.confidenceLedger.findFirst({
    where: { caseId, feedbackType: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!ledger) return;
  const delta = feedback.type === 'accept' ? 0.05 : -0.1;
  await prisma.confidenceLedger.update({
    where: { id: ledger.id },
    data: {
      feedbackType: feedback.type,
      feedbackReason: feedback.reason ?? null,
      feedbackSourceRole: feedback.sourceRole,
      feedbackAt: new Date(),
      confidenceAfter: Math.max(0, Math.min(1, ledger.confidenceBefore + delta)),
    },
  });
}
```

**做法 B：Append-only 修正事件（强不可变）**

不 UPDATE，而是 INSERT 一条 `agentAction: 'feedback_applied'` 的修正记录，通过 `caseId` 关联：

```prisma
// 可选：引入 ConfidenceLedgerCorrection 表
model ConfidenceLedgerCorrection {
  id              String   @id @default(uuid()) @db.Uuid
  ledgerId        String   @db.Uuid
  feedbackType    String
  confidenceAfter Float
  feedbackAt      DateTime @default(now())
  // ...
}
```

查询时 JOIN 取最新 correction 的 `confidenceAfter`。

### 2.4 审计日志保留与归档

**按时间分区**（需 PostgreSQL 10+）：

```sql
-- 将 ConfidenceLedger 改为分区表（需迁移）
CREATE TABLE "ConfidenceLedger" (
  -- 字段同 schema
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "ConfidenceLedger_2026_01" PARTITION OF "ConfidenceLedger"
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**保留策略**：

```typescript
// harness-retention.ts — 配合 pg-boss 日任务

async function archiveOldLedgerPartitions(prisma: PrismaClient, retainDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retainDays);
  // 若使用 pg_partman，可自动 drop 旧分区
  // 或：将旧数据导出到 S3/对象存储，再 TRUNCATE 分区
}
```

建议：热数据保留 90 天，冷数据归档到对象存储，满足合规即可。

---

## 3. Knowledge Decay Mechanisms

### 3.1 指数衰减公式

```typescript
// effectiveWeight = baseWeight × decayFactor × usageBoost × feedbackModifier

function computeDecayFactor(decayRate: number, daysSinceLastUsed: number): number {
  return Math.exp(-decayRate * daysSinceLastUsed);
}

function computeEffectiveWeight(entry: {
  effectiveWeight: number; // 或从 baseWeight 重算
  decayRate: number;
  lastUsedAt: Date | null;
  usageCount: number;
  impactScore: number;
}): number {
  const now = new Date();
  const daysSince =
    entry.lastUsedAt
      ? (now.getTime() - entry.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 999;
  const decayFactor = computeDecayFactor(entry.decayRate, daysSince);
  const usageBoost = Math.min(1.5, 1 + entry.usageCount * 0.02);
  const feedbackModifier = Math.max(0.5, Math.min(1.5, 1 + entry.impactScore * 0.2));
  return decayFactor * usageBoost * feedbackModifier;
}
```

### 3.2 使用 pg-boss 的定时衰减任务

```typescript
// apps/api/src/harness-decay-engine.ts

import PgBoss from 'pg-boss';
import { prisma } from '@codex/database';

export async function registerDecayJobs(boss: PgBoss) {
  await boss.schedule('harness:decay:daily', '0 3 * * *', {}); // 每天 03:00 UTC

  await boss.work(
    'harness:decay:daily',
    { teamSize: 1, teamConcurrency: 1 },
    async () => {
      const entries = await prisma.knowledgeEntry.findMany({
        where: { status: { in: ['ACTIVE', 'DECAYING'] } },
      });
      for (const e of entries) {
        const effectiveWeight = computeEffectiveWeight(e);
        let status = e.status;
        if (effectiveWeight < 0.1 && status === 'ACTIVE') status = 'DECAYING';
        if (effectiveWeight < 0.05 && status === 'DECAYING') status = 'DORMANT';

        await prisma.knowledgeEntry.update({
          where: { id: e.id },
          data: {
            effectiveWeight: Math.round(effectiveWeight * 100) / 100,
            status,
            lastReviewedAt: new Date(),
          },
        });
      }
    }
  );
}
```

### 3.3 漂移检测（Time-Windowed 均值比较）

ADWIN 风格：比较滑动窗口内前后两段均值，差异超过阈值则判定漂移。

```typescript
function detectKnowledgeDrift(
  values: { effectiveWeight: number; createdAt: Date }[],
  options: { windowSize?: number; delta?: number } = {}
): { drifted: boolean; changePoint?: number } {
  const windowSize = options.windowSize ?? 50;
  const delta = options.delta ?? 0.1;
  if (values.length < windowSize * 2) return { drifted: false };

  const sorted = [...values].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (let i = windowSize; i <= sorted.length - windowSize; i++) {
    const left = sorted.slice(i - windowSize, i).map((v) => v.effectiveWeight);
    const right = sorted.slice(i, i + windowSize).map((v) => v.effectiveWeight);
    const meanLeft = left.reduce((a, b) => a + b, 0) / left.length;
    const meanRight = right.reduce((a, b) => a + b, 0) / right.length;
    if (Math.abs(meanRight - meanLeft) > delta) {
      return { drifted: true, changePoint: i };
    }
  }
  return { drifted: false };
}
```

### 3.4 知识生命周期管理

```
ACTIVE → (effectiveWeight < 0.1) → DECAYING → (effectiveWeight < 0.05) → DORMANT
→ (手动或策略) → ARCHIVED
```

DORMANT 超过 N 天可自动归档，或由 Admin 手动归档。

---

## 4. Tenant Maturity Scoring

### 4.1 动态评分模型

```typescript
async function computeTenantMaturity(prisma: PrismaClient, tenantId: string): Promise<TenantMaturityScores> {
  const [knowledgeCount, ruleCount, feedbackCount, ledgerStats] = await Promise.all([
    prisma.knowledgeEntry.count({ where: { tenantId, status: { in: ['ACTIVE', 'DECAYING'] } } }),
    prisma.ruleSet.count({ where: { /* tenant rules */ } }),
    prisma.feedbackSignal.count({ where: { tenantId } }),
    prisma.confidenceLedger.aggregate({
      where: { tenantId },
      _count: { id: true },
      _avg: { confidenceBefore: true },
    }),
  ]);

  const knowledgeScore = Math.min(1, knowledgeCount / 50);
  const ruleScore = Math.min(1, ruleCount / 10);
  const feedbackScore = Math.min(1, feedbackCount / 100);
  const historyScore = Math.min(1, (ledgerStats._count.id ?? 0) / 500);

  const TMS =
    0.3 * knowledgeScore +
    0.2 * ruleScore +
    0.25 * feedbackScore +
    0.25 * historyScore;

  return {
    maturityScore: Math.round(TMS * 100) / 100,
    knowledgeScore,
    ruleScore,
    feedbackScore,
    historyScore,
  };
}
```

### 4.2 TMS → Feature Gates / Autonomy Level

```typescript
const AUTONOMY_BANDS: Record<string, [number, number]> = {
  GUIDED: [0, 0.3],
  ASSISTED: [0.3, 0.6],
  SUPERVISED: [0.6, 0.85],
  AUTONOMOUS: [0.85, 1.0],
};

function maturityToAutonomy(maturityScore: number, override?: AutonomyLevel): AutonomyLevel {
  if (override) return override;
  for (const [level, [min, max]] of Object.entries(AUTONOMY_BANDS)) {
    if (maturityScore >= min && maturityScore < max) return level as AutonomyLevel;
  }
  return 'GUIDED';
}
```

### 4.3 冷启动策略

- 新租户 TMS = 0，`autonomyLevel = GUIDED`
- 预设 `escalationThreshold = 0.9`，低置信度一律升级
- 引导式入驻：首次关单 Writeback、首次 Constitution 规则等可加权提升 TMS，加速解锁下一档

### 4.4 自动降级（连续错误 → 降低自主权）

```typescript
import { subDays } from 'date-fns';

const AUTONOMY_DOWNGRADE: Record<AutonomyLevel, AutonomyLevel> = {
  AUTONOMOUS: 'SUPERVISED',
  SUPERVISED: 'ASSISTED',
  ASSISTED: 'GUIDED',
  GUIDED: 'GUIDED',
};

async function checkAutoDegradation(prisma: PrismaClient, tenantId: string): Promise<void> {
  const sevenDaysAgo = subDays(new Date(), 7);
  const recentRejects = await prisma.confidenceLedger.count({
    where: {
      tenantId,
      feedbackType: 'reject',
      createdAt: { gte: sevenDaysAgo },
    },
  });
  const total = await prisma.confidenceLedger.count({
    where: { tenantId, createdAt: { gte: sevenDaysAgo } },
  });
  const rejectRate = total > 0 ? recentRejects / total : 0;
  if (rejectRate > 0.2) {
    const maturity = await prisma.tenantMaturity.findUnique({ where: { tenantId } });
    if (maturity && maturity.autonomyLevel !== 'GUIDED') {
      await prisma.tenantMaturity.update({
        where: { tenantId },
        data: { autonomyOverride: AUTONOMY_DOWNGRADE[maturity.autonomyLevel] },
      });
    }
  }
}
```

---

## 5. Causal Chain Tracking

### 5.1 多表因果链建模

```
KnowledgeEntry → ConfidenceLedger (knowledgeUsed[]) → SupportCase
       ↓                    ↓
  impactScore          feedbackType → confidenceAfter
```

### 5.2 因果链查询（Prisma）

```typescript
async function getCausalChain(
  prisma: PrismaClient,
  knowledgeId: string
): Promise<CausalChainDto> {
  const knowledge = await prisma.knowledgeEntry.findUnique({
    where: { id: knowledgeId },
    include: { tenant: true },
  });
  if (!knowledge) return null;

  const ledgers = await prisma.confidenceLedger.findMany({
    where: { knowledgeUsed: { has: knowledgeId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const caseIds = [...new Set(ledgers.map((l) => l.caseId).filter(Boolean))];
  const cases = await prisma.supportCase.findMany({
    where: { id: { in: caseIds } },
    select: { id: true, status: true, closedAt: true },
  });
  const caseMap = new Map(cases.map((c) => [c.id, c]));

  return {
    knowledge: knowledge,
    citations: ledgers.map((l) => ({
      ledgerId: l.id,
      caseId: l.caseId,
      case: l.caseId ? caseMap.get(l.caseId) : null,
      confidenceBefore: l.confidenceBefore,
      confidenceAfter: l.confidenceAfter,
      feedbackType: l.feedbackType,
    })),
  };
}
```

### 5.3 影响分计算（Before/After）

```typescript
function computeKnowledgeImpact(
  ledgers: { feedbackType: string | null; knowledgeWeights: number[]; knowledgeUsed: string[] }[],
  targetKnowledgeId: string
): number {
  let impact = 0;
  for (const l of ledgers) {
    const idx = l.knowledgeUsed.indexOf(targetKnowledgeId);
    if (idx < 0) continue;
    const weight = l.knowledgeWeights[idx] ?? 0.5;
    if (l.feedbackType === 'accept') impact += 0.1 * weight;
    if (l.feedbackType === 'reject') impact -= 0.15 * weight;
  }
  return impact;
}
```

### 5.4 Dashboard 展示

- **Insight Stream**：`KnowledgeEntry → 被引用次数 → 平均 confidenceAfter`，按 impact 排序
- **因果链详情页**：KnowledgeEntry 详情 → 引用该知识的 Ledger 列表 → 关联 Case
- 支持筛选：时间范围、feedbackType、tenant

---

## Stack 速查

| 能力           | 推荐工具/方式                            |
|----------------|------------------------------------------|
| 定时任务       | pg-boss `schedule`                        |
| 异步 Ledger 写 | Fire-and-forget 或 pg-boss job           |
| 分区/归档      | PostgreSQL RANGE 分区 + pg_partman（可选）|
| Token 估算     | `tiktoken` 或模型提供商 API              |
| 因果链查询     | Prisma `where: { knowledgeUsed: { has } }` |

---

## 来源与参考

- **RAG / Prompt**：AWS Prescriptive Guidance (Writing best practices RAG), Context Window Optimization
- **Audit Log**：Append-only patterns, hash chaining (AppMaster, immudb), Hoop.dev
- **Decay**：Milvus exponential decay, RagAboutIt knowledge decay, Langflow retrieval weighting
- **Drift**：ADWIN (skmultiflow), OPTWIN
- **Retention**：PostgreSQL partitioning (AppMaster, Elephas), pg_partman (Crunchy)
- **pg-boss**：LogSnag, Barrad, npm pg-boss
- **Citation**：Cohere docs, RankStudio, Vertex AI grounding
