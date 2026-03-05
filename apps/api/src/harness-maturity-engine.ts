import { prisma } from './db.js';

type AAL = 'GUIDED' | 'ASSISTED' | 'SUPERVISED' | 'AUTONOMOUS';

interface AALConfig {
  level: AAL;
  escalationThreshold: number;
}

const AAL_TIERS: { maxTms: number; config: AALConfig }[] = [
  { maxTms: 0.2, config: { level: 'GUIDED', escalationThreshold: 0.9 } },
  { maxTms: 0.5, config: { level: 'ASSISTED', escalationThreshold: 0.75 } },
  { maxTms: 0.8, config: { level: 'SUPERVISED', escalationThreshold: 0.6 } },
  { maxTms: Infinity, config: { level: 'AUTONOMOUS', escalationThreshold: 0.4 } },
];

function deriveAAL(tms: number): AALConfig {
  for (const tier of AAL_TIERS) {
    if (tms < tier.maxTms) return tier.config;
  }
  return AAL_TIERS[AAL_TIERS.length - 1].config;
}

const KNOWLEDGE_TARGET = 30;
const FEEDBACK_TARGET = 50;

async function recalculateTMS(tenantId: string): Promise<{
  tms: number;
  aal: AALConfig;
  knowledgeScore: number;
  feedbackScore: number;
}> {
  const [activeKnowledgeCount, positiveFeedbackCount] = await Promise.all([
    prisma.knowledgeEntry.count({
      where: { tenantId, status: 'ACTIVE' },
    }),
    prisma.feedbackSignal.count({
      where: { tenantId, type: { in: ['accept', 'resolved'] } },
    }),
  ]);

  const knowledgeScore = Math.min(1.0, activeKnowledgeCount / KNOWLEDGE_TARGET);
  const feedbackScore = Math.min(1.0, positiveFeedbackCount / FEEDBACK_TARGET);
  const tms = 0.5 * knowledgeScore + 0.5 * feedbackScore;
  const aal = deriveAAL(tms);

  return { tms, aal, knowledgeScore, feedbackScore };
}

export async function applyTMSUpdate(tenantId: string): Promise<{
  tms: number;
  aal: AALConfig;
  changed: boolean;
}> {
  const { tms, aal, knowledgeScore, feedbackScore } = await recalculateTMS(tenantId);

  const existing = await prisma.tenantMaturity.findUnique({
    where: { tenantId },
    select: { autonomyLevel: true, autonomyOverride: true, maturityScore: true },
  });

  let effectiveLevel = aal.level;
  if (existing?.autonomyOverride) {
    const overrideIndex = AAL_TIERS.findIndex((t) => t.config.level === existing.autonomyOverride);
    const computedIndex = AAL_TIERS.findIndex((t) => t.config.level === aal.level);
    if (overrideIndex > -1 && computedIndex > -1 && overrideIndex < computedIndex) {
      effectiveLevel = existing.autonomyOverride as AAL;
    }
  }

  const effectiveConfig = AAL_TIERS.find((t) => t.config.level === effectiveLevel)?.config ?? aal;
  const changed = !existing || existing.autonomyLevel !== effectiveLevel || Math.abs(existing.maturityScore - tms) > 0.01;

  await prisma.tenantMaturity.upsert({
    where: { tenantId },
    create: {
      tenantId,
      maturityScore: tms,
      autonomyLevel: effectiveLevel,
      knowledgeScore,
      feedbackScore,
      escalationThreshold: effectiveConfig.escalationThreshold,
      lastCalculatedAt: new Date(),
    },
    update: {
      maturityScore: tms,
      autonomyLevel: effectiveLevel,
      knowledgeScore,
      feedbackScore,
      escalationThreshold: effectiveConfig.escalationThreshold,
      lastCalculatedAt: new Date(),
    },
  });

  if (changed) {
    console.log(`[Harness:Maturity] Tenant ${tenantId.slice(0, 8)}: TMS=${tms.toFixed(3)} AAL=${effectiveLevel} (threshold=${effectiveConfig.escalationThreshold})`);
  }

  return { tms, aal: effectiveConfig, changed };
}

const CONCURRENCY = 5;

export async function runDailyMaturityJob(): Promise<void> {
  const start = Date.now();
  console.log('[Harness:Maturity] Starting daily maturity recalculation');

  try {
    const [existingTenants, knowledgeTenants, feedbackTenants] = await Promise.all([
      prisma.tenantMaturity.findMany({ select: { tenantId: true } }),
      prisma.knowledgeEntry.groupBy({ by: ['tenantId'], _count: true }),
      prisma.feedbackSignal.groupBy({ by: ['tenantId'], _count: true }),
    ]);

    const uniqueIds = [
      ...new Set([
        ...existingTenants.map((t) => t.tenantId),
        ...knowledgeTenants.map((t) => t.tenantId),
        ...feedbackTenants.map((t) => t.tenantId),
      ]),
    ];

    let updated = 0;
    let idx = 0;

    async function worker() {
      while (idx < uniqueIds.length) {
        const tid = uniqueIds[idx++];
        try {
          const result = await applyTMSUpdate(tid);
          if (result.changed) updated++;
        } catch (e) {
          console.error(`[Harness:Maturity] Failed for tenant ${tid.slice(0, 8)}:`, e instanceof Error ? e.message : 'unknown');
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uniqueIds.length) }, () => worker()));

    console.log(`[Harness:Maturity] Processed ${uniqueIds.length} tenants, ${updated} updated`);
  } catch (e) {
    console.error('[Harness:Maturity] Daily job failed:', e instanceof Error ? e.message : 'unknown');
  }

  console.log(`[Harness:Maturity] Completed in ${Date.now() - start}ms`);
}
