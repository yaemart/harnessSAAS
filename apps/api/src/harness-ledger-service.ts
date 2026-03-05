import { prisma } from './db.js';

export interface ConfidenceLedgerPayload {
  tenantId: string;
  agentDomain?: 'portal' | 'ads';
  caseId?: string;
  intentId?: string;
  agentAction: string;
  confidenceBefore: number;
  confidenceAfter: number;
  knowledgeUsed: string[];
  knowledgeWeights: number[];
  ruleTriggered: string[];
  ruleResult: string;
  authorityLevel: string;
  executionResult: string;
  executionLatencyMs: number;
  pipelineVersion: string;
  tenantMaturityScore: number;
  agentAutonomyLevel: string;
}

export const PIPELINE_VERSION = '1.0.0';

export async function writeConfidenceLedger(payload: ConfidenceLedgerPayload): Promise<string | null> {
  try {
    const entry = await prisma.confidenceLedger.create({
      data: {
        tenantId: payload.tenantId,
        agentDomain: payload.agentDomain ?? 'portal',
        intentId: payload.intentId ?? null,
        caseId: payload.caseId ?? null,
        agentAction: payload.agentAction,
        confidenceBefore: payload.confidenceBefore,
        confidenceAfter: payload.confidenceAfter,
        knowledgeUsed: payload.knowledgeUsed,
        knowledgeWeights: payload.knowledgeWeights,
        ruleTriggered: payload.ruleTriggered,
        ruleResult: payload.ruleResult,
        authorityLevel: payload.authorityLevel,
        executionResult: payload.executionResult,
        executionLatencyMs: payload.executionLatencyMs,
        pipelineVersion: payload.pipelineVersion || PIPELINE_VERSION,
        tenantMaturityScore: payload.tenantMaturityScore,
        agentAutonomyLevel: payload.agentAutonomyLevel,
      },
    });
    return entry.id;
  } catch (e) {
    console.error('[Harness] Ledger write failed:', e instanceof Error ? e.message : 'unknown');
    return null;
  }
}

export async function appendLedgerFeedback(
  originalLedgerId: string,
  tenantId: string,
  feedbackType: string,
  feedbackReason: string | null,
  feedbackSourceRole: string,
  confidenceDelta: number,
): Promise<string | null> {
  try {
    const original = await prisma.confidenceLedger.findFirst({
      where: { id: originalLedgerId, tenantId },
      select: {
        agentDomain: true,
        caseId: true,
        intentId: true,
        agentAction: true,
        confidenceAfter: true,
        knowledgeUsed: true,
        knowledgeWeights: true,
        ruleTriggered: true,
        ruleResult: true,
        authorityLevel: true,
        pipelineVersion: true,
        tenantMaturityScore: true,
        agentAutonomyLevel: true,
      },
    });
    if (!original) return null;

    const baseLine = original.confidenceAfter ?? 0;
    const confidenceAfter = Math.max(0, Math.min(1, baseLine + confidenceDelta));

    const entry = await prisma.confidenceLedger.create({
      data: {
        tenantId,
        agentDomain: original.agentDomain,
        caseId: original.caseId,
        intentId: original.intentId,
        agentAction: `feedback_on_${original.agentAction}`,
        confidenceBefore: baseLine,
        confidenceAfter,
        knowledgeUsed: original.knowledgeUsed,
        knowledgeWeights: original.knowledgeWeights,
        ruleTriggered: original.ruleTriggered,
        ruleResult: original.ruleResult,
        authorityLevel: original.authorityLevel,
        executionResult: 'feedback_recorded',
        executionLatencyMs: 0,
        pipelineVersion: original.pipelineVersion,
        tenantMaturityScore: original.tenantMaturityScore,
        agentAutonomyLevel: original.agentAutonomyLevel,
        feedbackType,
        feedbackReason,
        feedbackSourceRole,
        feedbackAt: new Date(),
      },
    });
    return entry.id;
  } catch (e) {
    console.error('[Harness] Ledger feedback append failed:', e instanceof Error ? e.message : 'unknown');
    return null;
  }
}

interface KnowledgeItem {
  id: string;
  content: string;
  effectiveWeight: number;
  category: string;
}

export async function loadTenantKnowledge(
  tenantId: string,
  category?: string | null,
  limit = 5,
): Promise<KnowledgeItem[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      ...(category ? { category } : {}),
    },
    select: { id: true, content: true, effectiveWeight: true, category: true },
    orderBy: { effectiveWeight: 'desc' },
    take: limit,
  });

  if (entries.length > 0) {
    const ids = entries.map((e) => e.id);
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: ids } },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  return entries;
}

export async function loadTenantMaturityConfig(tenantId: string): Promise<{
  maturityScore: number;
  autonomyLevel: string;
  escalationThreshold: number;
}> {
  const maturity = await prisma.tenantMaturity.findUnique({
    where: { tenantId },
    select: { maturityScore: true, autonomyLevel: true, escalationThreshold: true },
  });

  if (!maturity) {
    return { maturityScore: 0, autonomyLevel: 'GUIDED', escalationThreshold: 0.9 };
  }

  return {
    maturityScore: maturity.maturityScore,
    autonomyLevel: maturity.autonomyLevel,
    escalationThreshold: maturity.escalationThreshold,
  };
}

export async function updateKnowledgeImpact(
  tenantId: string,
  knowledgeIds: string[],
  delta: number,
): Promise<void> {
  if (knowledgeIds.length === 0) return;
  try {
    await prisma.knowledgeEntry.updateMany({
      where: { id: { in: knowledgeIds }, tenantId },
      data: { impactScore: { increment: delta } },
    });
  } catch (e) {
    console.error('[Harness] Knowledge impact update failed:', e instanceof Error ? e.message : 'unknown');
  }
}
