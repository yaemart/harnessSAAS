import { prisma } from './db.js';

const BATCH_SIZE = 200;

interface WeightStats {
  processed: number;
  weightUpdated: number;
}

interface LifecycleStats {
  transitioned: number;
  archived: number;
}

export async function recalculateWeights(tenantId?: string): Promise<WeightStats> {
  const stats: WeightStats = { processed: 0, weightUpdated: 0 };
  const now = new Date();

  const tenantFilter = tenantId ? { tenantId } : {};
  let skip = 0;

  while (true) {
    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        ...tenantFilter,
        status: { in: ['ACTIVE', 'DECAYING'] },
      },
      select: {
        id: true,
        decayRate: true,
        lastUsedAt: true,
        createdAt: true,
        effectiveWeight: true,
      },
      orderBy: [{ status: 'asc' }, { effectiveWeight: 'desc' }, { id: 'asc' }],
      skip,
      take: BATCH_SIZE,
    });

    if (entries.length === 0) break;

    const updates: { id: string; weight: number }[] = [];
    for (const entry of entries) {
      const referenceDate = entry.lastUsedAt ?? entry.createdAt;
      const daysSinceUsed = Math.max(0, (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      const newWeight = Math.exp(-entry.decayRate * daysSinceUsed);
      const clampedWeight = Math.max(0, Math.min(1, newWeight));

      if (Math.abs(clampedWeight - entry.effectiveWeight) > 0.001) {
        updates.push({ id: entry.id, weight: clampedWeight });
      }
      stats.processed++;
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map(({ id, weight }) =>
          prisma.knowledgeEntry.update({ where: { id }, data: { effectiveWeight: weight } }),
        ),
      );
      stats.weightUpdated += updates.length;
    }

    skip += entries.length;
    if (entries.length < BATCH_SIZE) break;
  }

  return stats;
}

export async function transitionLifecycle(tenantId?: string): Promise<LifecycleStats> {
  const stats: LifecycleStats = { transitioned: 0, archived: 0 };
  const tenantFilter = tenantId ? { tenantId } : {};
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const activeToDecaying = await prisma.knowledgeEntry.updateMany({
    where: {
      ...tenantFilter,
      status: 'ACTIVE',
      effectiveWeight: { lt: 0.1 },
    },
    data: { status: 'DECAYING' },
  });
  stats.transitioned += activeToDecaying.count;

  const decayingToDormant = await prisma.knowledgeEntry.updateMany({
    where: {
      ...tenantFilter,
      status: 'DECAYING',
      effectiveWeight: { lt: 0.05 },
    },
    data: { status: 'DORMANT' },
  });
  stats.transitioned += decayingToDormant.count;

  const dormantToArchived = await prisma.knowledgeEntry.updateMany({
    where: {
      ...tenantFilter,
      status: 'DORMANT',
      updatedAt: { lt: sixtyDaysAgo },
    },
    data: { status: 'ARCHIVED', effectiveWeight: 0 },
  });
  stats.archived = dormantToArchived.count;

  return stats;
}

// ─── Drift Detection ──────────────────────────────────

const DRIFT_WINDOW_DAYS = 30;
const DRIFT_THRESHOLD_PCT = 0.20;
const DRIFT_MIN_ENTRIES = 3;

export interface DriftAlert {
  tenantId: string;
  category: string;
  currentAvgImpact: number;
  previousAvgImpact: number;
  driftPct: number;
  entryCount: number;
  detectedAt: string;
}

export async function detectDrift(tenantId?: string): Promise<DriftAlert[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - DRIFT_WINDOW_DAYS * 86_400_000);
  const prevWindowStart = new Date(windowStart.getTime() - DRIFT_WINDOW_DAYS * 86_400_000);

  const tenantFilter = tenantId ? { tenantId } : {};

  const driftStatuses = ['ACTIVE', 'DECAYING', 'DORMANT'] as const;
  const [currentGroups, prevGroups] = await Promise.all([
    prisma.knowledgeEntry.groupBy({
      by: ['tenantId', 'category'],
      where: {
        ...tenantFilter,
        status: { in: [...driftStatuses] },
        createdAt: { gte: windowStart, lte: now },
      },
      _avg: { impactScore: true },
      _count: true,
    }),
    prisma.knowledgeEntry.groupBy({
      by: ['tenantId', 'category'],
      where: {
        ...tenantFilter,
        status: { in: [...driftStatuses] },
        createdAt: { gte: prevWindowStart, lt: windowStart },
      },
      _avg: { impactScore: true },
      _count: true,
    }),
  ]);

  const prevMap = new Map<string, { avg: number; count: number }>();
  for (const g of prevGroups) {
    prevMap.set(`${g.tenantId}:${g.category}`, {
      avg: g._avg.impactScore ?? 0,
      count: g._count,
    });
  }

  const alerts: DriftAlert[] = [];
  for (const group of currentGroups) {
    if (group._count < DRIFT_MIN_ENTRIES) continue;
    const currentAvg = group._avg.impactScore ?? 0;

    const prev = prevMap.get(`${group.tenantId}:${group.category}`);
    if (!prev || prev.count < DRIFT_MIN_ENTRIES || prev.avg <= 0) continue;

    const driftPct = (prev.avg - currentAvg) / prev.avg;
    if (driftPct >= DRIFT_THRESHOLD_PCT) {
      alerts.push({
        tenantId: group.tenantId,
        category: group.category,
        currentAvgImpact: Math.round(currentAvg * 1000) / 1000,
        previousAvgImpact: Math.round(prev.avg * 1000) / 1000,
        driftPct: Math.round(driftPct * 100) / 100,
        entryCount: group._count,
        detectedAt: now.toISOString(),
      });
    }
  }

  return alerts;
}

export async function runDailyDecayJob(): Promise<void> {
  const start = Date.now();
  console.log('[Harness:Decay] Starting daily decay job');

  try {
    const weightStats = await recalculateWeights();
    console.log(`[Harness:Decay] Weights recalculated: ${weightStats.processed} processed, ${weightStats.weightUpdated} updated`);

    const dayOfWeek = new Date().getUTCDay();
    if (dayOfWeek === 1) {
      const lifecycleStats = await transitionLifecycle();
      console.log(`[Harness:Decay] Lifecycle transitions: ${lifecycleStats.transitioned} transitioned, ${lifecycleStats.archived} archived`);
    }

    const driftAlerts = await detectDrift();
    if (driftAlerts.length > 0) {
      console.log(`[Harness:Decay] Drift detected in ${driftAlerts.length} categories:`);
      for (const alert of driftAlerts) {
        console.log(`  [${alert.tenantId}] ${alert.category}: ${(alert.driftPct * 100).toFixed(0)}% decline (${alert.previousAvgImpact} → ${alert.currentAvgImpact})`);
      }
    }
  } catch (e) {
    console.error('[Harness:Decay] Daily job failed:', e instanceof Error ? e.message : 'unknown');
  }

  console.log(`[Harness:Decay] Completed in ${Date.now() - start}ms`);
}
