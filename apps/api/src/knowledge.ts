import { prisma } from './db.js';
import type { Prisma } from '@prisma/client';

const EXCLUDED_FIELDS = new Set([
  'costPrice', 'msrp', 'profitMarginPct', 'supplierCode',
  'apiCredentials', 'contactEmail',
]);

const K_ANONYMITY_THRESHOLD = 5;

function applyLaplaceNoise(value: number, epsilon: number = 0.05): number {
  const u = Math.max(-0.4999, Math.min(0.4999, Math.random() - 0.5));
  const noise = -(epsilon / 2) * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return Math.round((value + value * noise) * 100) / 100;
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    if (typeof value === 'number') {
      cleaned[key] = applyLaplaceNoise(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export interface PublicKnowledge {
  id: string;
  domain: string;
  key: string;
  title: string;
  content: Prisma.JsonValue;
  version: number;
  approvedBy: string[];
  isActive: boolean;
  createdAt: Date;
}

export async function listPublicKnowledge(domain?: string, includeInactive = false): Promise<PublicKnowledge[]> {
  const where: Prisma.KnowledgeLayerAWhereInput = {};
  if (!includeInactive) where.isActive = true;
  if (domain) where.domain = domain;

  return prisma.knowledgeLayerA.findMany({
    where,
    select: {
      id: true,
      domain: true,
      key: true,
      title: true,
      content: true,
      version: true,
      approvedBy: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
}

export async function getPublicKnowledge(id: string): Promise<PublicKnowledge | null> {
  return prisma.knowledgeLayerA.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      key: true,
      title: true,
      content: true,
      version: true,
      approvedBy: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function upsertPublicKnowledge(
  domain: string,
  key: string,
  title: string,
  content: Prisma.InputJsonValue,
  approver: string,
): Promise<{ id: string; needsSecondApproval: boolean }> {
  const existing = await prisma.knowledgeLayerA.findUnique({
    where: { domain_key: { domain, key } },
  });

  if (existing) {
    const contentChanged =
      JSON.stringify(existing.content) !== JSON.stringify(content) ||
      existing.title !== title;

    const approvedBy = contentChanged
      ? [approver]
      : existing.approvedBy.includes(approver)
        ? existing.approvedBy
        : [...existing.approvedBy, approver];

    const readyToPublish = approvedBy.length >= 2 || !existing.requiresDualApproval;

    await prisma.knowledgeLayerA.update({
      where: { id: existing.id },
      data: {
        title,
        content,
        approvedBy,
        version: readyToPublish ? existing.version + 1 : existing.version,
        isActive: readyToPublish,
      },
    });

    return { id: existing.id, needsSecondApproval: !readyToPublish };
  }

  const created = await prisma.knowledgeLayerA.create({
    data: {
      domain,
      key,
      title,
      content,
      approvedBy: [approver],
      isActive: false,
    },
  });

  return { id: created.id, needsSecondApproval: true };
}

export interface IndustryBenchmark {
  industryCategory: string;
  metricKey: string;
  metricValue: number;
  sampleSize: number;
  aggregationMethod: string;
  periodStart: Date;
  periodEnd: Date;
}

export async function queryIndustryBenchmarks(
  industryCategory: string,
  metricKeys?: string[],
  daysBack: number = 90,
): Promise<IndustryBenchmark[]> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const where: Prisma.KnowledgeLayerBWhereInput = {
    industryCategory,
    contributingTenants: { gte: K_ANONYMITY_THRESHOLD },
    periodStart: { gte: cutoff },
  };
  if (metricKeys && metricKeys.length > 0) {
    where.metricKey = { in: metricKeys };
  }

  const results = await prisma.knowledgeLayerB.findMany({
    where,
    select: {
      industryCategory: true,
      metricKey: true,
      metricValue: true,
      sampleSize: true,
      contributingTenants: true,
      aggregationMethod: true,
      periodStart: true,
      periodEnd: true,
    },
    orderBy: { periodStart: 'desc' },
    take: 200,
  });

  return results.map((r) => ({
    ...r,
    metricValue: applyLaplaceNoise(r.metricValue),
  }));
}

const tenantContributionCache = new Map<string, Set<string>>();

function hasTenantContributed(benchmarkId: string, tenantId: string): boolean {
  const tenants = tenantContributionCache.get(benchmarkId);
  return tenants?.has(tenantId) ?? false;
}

function markTenantContributed(benchmarkId: string, tenantId: string): void {
  let tenants = tenantContributionCache.get(benchmarkId);
  if (!tenants) {
    tenants = new Set();
    tenantContributionCache.set(benchmarkId, tenants);
  }
  tenants.add(tenantId);
}

export async function contributeToIndustryBenchmark(
  tenantId: string,
  industryCategory: string,
  metricKey: string,
  metricValue: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ deduplicated: boolean }> {
  const existing = await prisma.knowledgeLayerB.findUnique({
    where: {
      industryCategory_metricKey_periodStart: {
        industryCategory,
        metricKey,
        periodStart,
      },
    },
  });

  if (existing) {
    const isDuplicate = hasTenantContributed(existing.id, tenantId);
    const newSample = existing.sampleSize + 1;
    const medianApprox = existing.metricValue + (metricValue - existing.metricValue) / newSample;

    await prisma.knowledgeLayerB.update({
      where: { id: existing.id },
      data: {
        metricValue: Math.round(medianApprox * 1000) / 1000,
        sampleSize: newSample,
        contributingTenants: isDuplicate ? existing.contributingTenants : existing.contributingTenants + 1,
        noiseApplied: false,
        periodEnd,
      },
    });

    markTenantContributed(existing.id, tenantId);
    return { deduplicated: isDuplicate };
  }

  const created = await prisma.knowledgeLayerB.create({
    data: {
      industryCategory,
      metricKey,
      metricValue,
      sampleSize: 1,
      contributingTenants: 1,
      periodStart,
      periodEnd,
    },
  });

  markTenantContributed(created.id, tenantId);
  return { deduplicated: false };
}

export type ColdStartPhase = 'COLD' | 'WARMING' | 'MATURE';

export interface ColdStartConfig {
  phase: ColdStartPhase;
  experienceCount: number;
  weights: { layerA: number; layerB: number; layerC: number };
  explorationRate: number;
  maxPriceAdjustPct: number;
}

export function determineColdStartPhase(experienceCount: number): ColdStartConfig {
  if (experienceCount < 50) {
    return {
      phase: 'COLD',
      experienceCount,
      weights: { layerA: 0.50, layerB: 0.40, layerC: 0.10 },
      explorationRate: 0.30,
      maxPriceAdjustPct: 0.05,
    };
  }
  if (experienceCount <= 500) {
    return {
      phase: 'WARMING',
      experienceCount,
      weights: { layerA: 0.30, layerB: 0.30, layerC: 0.40 },
      explorationRate: 0.15,
      maxPriceAdjustPct: 0.08,
    };
  }
  return {
    phase: 'MATURE',
    experienceCount,
    weights: { layerA: 0.10, layerB: 0.20, layerC: 0.70 },
    explorationRate: 0.05,
    maxPriceAdjustPct: 0.12,
  };
}

export async function getTenantColdStartConfig(tenantId: string): Promise<ColdStartConfig> {
  const count = await prisma.agentExperience.count({
    where: { tenantId },
  });
  return determineColdStartPhase(count);
}

export { sanitizeRecord };
