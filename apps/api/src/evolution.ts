import { prisma } from './db.js';
import type { Prisma } from '@prisma/client';

export type PatternGrade = 'SHADOW' | 'SUGGEST' | 'AUTO_LOW' | 'AUTO_FULL';

interface DistillRequest {
  tenantId: string;
  intentDomain: string;
  platform?: string;
  market?: string;
  minSamples?: number;
  daysBack?: number;
}

interface DistillResult {
  patternsCreated: number;
  patterns: Array<{
    name: string;
    confidence: number;
    sampleCount: number;
    grade: PatternGrade;
    ruleTree: Record<string, unknown>;
  }>;
}

interface ExperienceRow {
  id: string;
  intentType: string;
  platform: string;
  market: string;
  executionStatus: string;
  qualityScore: number | null;
  observeSnapshot: Prisma.JsonValue;
  decideRationale: Prisma.JsonValue;
}

function gradeFromStats(confidence: number, sampleCount: number): PatternGrade {
  if (confidence >= 0.9 && sampleCount >= 100) return 'AUTO_FULL';
  if (confidence >= 0.8 && sampleCount >= 30) return 'AUTO_LOW';
  if (confidence >= 0.6 && sampleCount >= 10) return 'SUGGEST';
  return 'SHADOW';
}

function clusterExperiences(
  experiences: ExperienceRow[],
): Map<string, ExperienceRow[]> {
  const clusters = new Map<string, ExperienceRow[]>();
  for (const exp of experiences) {
    const obs = (exp.observeSnapshot ?? {}) as Record<string, unknown>;
    const lifecycleStage = String(obs['lifecycleStage'] ?? obs['lifecycle.stage'] ?? 'UNKNOWN');
    const key = `${exp.intentType}::${lifecycleStage}::${exp.platform}`;
    const group = clusters.get(key) ?? [];
    group.push(exp);
    clusters.set(key, group);
  }
  return clusters;
}

function extractRuleTree(
  cluster: ExperienceRow[],
): { ruleTree: Record<string, unknown>; confidence: number } {
  const successful = cluster.filter((e) => e.executionStatus === 'SUCCESS');
  const successRate = cluster.length > 0 ? successful.length / cluster.length : 0;

  const rawAvgQuality =
    successful.reduce((sum, e) => sum + (e.qualityScore ?? 0), 0) /
    (successful.length || 1);
  const avgQuality = Math.min(1.0, Math.max(0.0, rawAvgQuality));

  const actionCounts = new Map<string, number>();
  for (const exp of successful) {
    const rationale = (exp.decideRationale ?? {}) as Record<string, unknown>;
    const action = String(rationale['action'] ?? rationale['selectedAction'] ?? 'unknown');
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  }

  let dominantAction = 'unknown';
  let maxCount = 0;
  for (const [action, count] of actionCounts) {
    if (count > maxCount) {
      dominantAction = action;
      maxCount = count;
    }
  }

  const actionConfidence = successful.length > 0 ? maxCount / successful.length : 0;
  const confidence = Math.round(successRate * 0.5 * 1000 + avgQuality * 0.3 * 1000 + actionConfidence * 0.2 * 1000) / 1000;

  return {
    ruleTree: {
      dominantAction,
      successRate: Math.round(successRate * 1000) / 1000,
      avgQualityScore: Math.round(avgQuality * 1000) / 1000,
      actionConfidence: Math.round(actionConfidence * 1000) / 1000,
      sampleBreakdown: {
        total: cluster.length,
        successful: successful.length,
        failed: cluster.length - successful.length,
      },
    },
    confidence: Math.min(1.0, Math.max(0.0, confidence)),
  };
}

export async function distillPatterns(req: DistillRequest): Promise<DistillResult> {
  const minSamples = req.minSamples ?? 10;
  const daysBack = req.daysBack ?? 90;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const where: Prisma.AgentExperienceWhereInput = {
    tenantId: req.tenantId,
    intentDomain: req.intentDomain,
    distilled: false,
    createdAt: { gte: cutoff },
  };
  if (req.platform) where.platform = req.platform;
  if (req.market) where.market = req.market;

  const experiences = await prisma.agentExperience.findMany({
    where,
    select: {
      id: true,
      intentType: true,
      platform: true,
      market: true,
      executionStatus: true,
      qualityScore: true,
      observeSnapshot: true,
      decideRationale: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const clusters = clusterExperiences(experiences);
  const created: DistillResult['patterns'] = [];

  for (const [key, cluster] of clusters) {
    if (cluster.length < minSamples) continue;

    const [intentType, lifecycleStage, platform] = key.split('::');
    const { ruleTree, confidence } = extractRuleTree(cluster);

    if (confidence < 0.3) continue;

    const grade = gradeFromStats(confidence, cluster.length);
    const ids = cluster.map((e) => e.id);

    await prisma.$transaction([
      prisma.distilledPattern.create({
        data: {
          tenantId: req.tenantId,
          intentDomain: req.intentDomain,
          platform,
          market: req.market,
          lifecycleStage,
          name: `${intentType}/${lifecycleStage}/${platform}`,
          description: `Auto-distilled from ${cluster.length} experiences`,
          ruleTree: ruleTree as Prisma.InputJsonValue,
          confidence,
          sampleCount: cluster.length,
          grade,
          lastValidatedAt: new Date(),
        },
      }),
      prisma.agentExperience.updateMany({
        where: { id: { in: ids } },
        data: { distilled: true },
      }),
    ]);

    created.push({ name: `${intentType}/${lifecycleStage}/${platform}`, confidence, sampleCount: cluster.length, grade, ruleTree });
  }

  return { patternsCreated: created.length, patterns: created };
}

export interface MatchedPattern {
  id: string;
  name: string;
  grade: PatternGrade;
  confidence: number;
  ruleTree: Prisma.JsonValue;
}

export async function matchPatterns(
  tenantId: string,
  intentDomain: string,
  platform?: string,
  market?: string,
  lifecycleStage?: string,
): Promise<MatchedPattern[]> {
  const where: Prisma.DistilledPatternWhereInput = {
    tenantId,
    intentDomain,
    isActive: true,
  };
  if (platform) where.platform = platform;
  if (market) where.market = market;
  if (lifecycleStage) where.lifecycleStage = lifecycleStage;

  const patterns = await prisma.distilledPattern.findMany({
    where,
    orderBy: { confidence: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      grade: true,
      confidence: true,
      ruleTree: true,
    },
  });

  return patterns;
}

export async function recordPatternApplication(
  tenantId: string,
  patternId: string,
  traceId: string,
  applied: boolean,
  experienceId?: string,
): Promise<void> {
  await prisma.patternApplication.create({
    data: {
      tenantId,
      patternId,
      traceId,
      applied,
      experienceId,
    },
  });
}

export async function recordPatternOutcome(
  tenantId: string,
  patternId: string,
  traceId: string,
  outcome: 'SUCCESS' | 'FAILED',
): Promise<void> {
  const pattern = await prisma.distilledPattern.findFirst({
    where: { id: patternId, tenantId },
    select: { id: true, consecutiveFailures: true, grade: true },
  });
  if (!pattern) return;

  await prisma.patternApplication.updateMany({
    where: { patternId, traceId, tenantId },
    data: { outcome },
  });

  if (outcome === 'FAILED') {
    const newFailures = pattern.consecutiveFailures + 1;
    const updates: Prisma.DistilledPatternUpdateInput = {
      consecutiveFailures: newFailures,
    };

    if (newFailures >= 3 && pattern.grade !== 'SHADOW') {
      updates.grade = 'SUGGEST';
    }

    await prisma.distilledPattern.update({
      where: { id: patternId },
      data: updates,
    });
  } else {
    await prisma.distilledPattern.update({
      where: { id: patternId },
      data: {
        consecutiveFailures: 0,
        lastValidatedAt: new Date(),
      },
    });
  }
}

export async function decayStalePatterns(tenantId: string, staleDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const result = await prisma.distilledPattern.updateMany({
    where: {
      tenantId,
      isActive: true,
      grade: { not: 'SHADOW' },
      lastValidatedAt: { lt: cutoff },
    },
    data: {
      grade: 'SHADOW',
    },
  });

  return result.count;
}

export interface EvolutionStats {
  totalPatterns: number;
  activePatterns: number;
  byGrade: Record<string, number>;
  avgConfidence: number;
  totalApplications: number;
  successRate: number;
  recentExperiences: number;
  avgQualityScore: number;
  qualityTrend: Array<{ date: string; avgScore: number; count: number }>;
}

export async function getEvolutionStats(tenantId: string, daysBack: number = 30): Promise<EvolutionStats> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const [patterns, applications, experiences] = await Promise.all([
    prisma.distilledPattern.findMany({
      where: { tenantId },
      select: { isActive: true, grade: true, confidence: true },
    }),
    prisma.patternApplication.findMany({
      where: { tenantId, createdAt: { gte: cutoff } },
      select: { outcome: true },
    }),
    prisma.agentExperience.findMany({
      where: { tenantId, createdAt: { gte: cutoff } },
      select: { qualityScore: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const active = patterns.filter((p: { isActive: boolean }) => p.isActive);
  const byGrade: Record<string, number> = {};
  for (const p of active) {
    byGrade[p.grade] = (byGrade[p.grade] ?? 0) + 1;
  }

  const avgConfidence = active.length > 0
    ? active.reduce((s: number, p: { confidence: number }) => s + p.confidence, 0) / active.length
    : 0;

  const withOutcome = applications.filter((a: { outcome: string | null }) => a.outcome);
  const successCount = withOutcome.filter((a: { outcome: string | null }) => a.outcome === 'SUCCESS').length;
  const successRate = withOutcome.length > 0 ? successCount / withOutcome.length : 0;

  const scored = experiences.filter((e: { qualityScore: number | null }) => e.qualityScore != null);
  const avgQualityScore = scored.length > 0
    ? scored.reduce((s: number, e: { qualityScore: number | null }) => s + (e.qualityScore ?? 0), 0) / scored.length
    : 0;

  const dailyMap = new Map<string, { total: number; count: number }>();
  for (const exp of scored) {
    const day = exp.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) ?? { total: 0, count: 0 };
    entry.total += exp.qualityScore ?? 0;
    entry.count += 1;
    dailyMap.set(day, entry);
  }

  const qualityTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({
      date,
      avgScore: Math.round((total / count) * 1000) / 1000,
      count,
    }));

  return {
    totalPatterns: patterns.length,
    activePatterns: active.length,
    byGrade,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    totalApplications: applications.length,
    successRate: Math.round(successRate * 1000) / 1000,
    recentExperiences: experiences.length,
    avgQualityScore: Math.round(avgQualityScore * 1000) / 1000,
    qualityTrend,
  };
}
