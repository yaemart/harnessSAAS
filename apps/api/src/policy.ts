import type { PrismaClient } from '@prisma/client';

interface ResolveInput {
  tenantId: string;
  brandId?: string | null;
  productId?: string | null;
}

export interface ResolvedPolicy {
  resolvedAt: string;
  values: {
    targetAcos: number;
    minBid: number;
    maxDailyBudgetChangePct: number;
    freshnessTtlMinutes: number;
  };
  source: Record<string, 'SYSTEM' | 'TENANT' | 'BRAND' | 'PRODUCT'>;
}

const SYSTEM_DEFAULTS: ResolvedPolicy['values'] = {
  targetAcos: Number(process.env.POLICY_DEFAULT_ACOS_TARGET ?? 0.3),
  minBid: Number(process.env.POLICY_DEFAULT_MIN_BID ?? 0.2),
  maxDailyBudgetChangePct: Number(process.env.POLICY_DEFAULT_BUDGET_DELTA_PCT ?? 0.3),
  freshnessTtlMinutes: Number(process.env.POLICY_DEFAULT_FRESHNESS_TTL_MINUTES ?? 30),
};

function specificityOf(row: { productId: string | null; brandId: string | null; tenantId: string | null }): number {
  if (row.productId) return 3;
  if (row.brandId) return 2;
  if (row.tenantId) return 1;
  return 0;
}

function scopeOf(row: { productId: string | null; brandId: string | null; tenantId: string | null }): 'SYSTEM' | 'TENANT' | 'BRAND' | 'PRODUCT' {
  if (row.productId) return 'PRODUCT';
  if (row.brandId) return 'BRAND';
  if (row.tenantId) return 'TENANT';
  return 'SYSTEM';
}

export async function resolveParams(prisma: PrismaClient, input: ResolveInput): Promise<ResolvedPolicy> {
  const now = new Date();

  const rows = await prisma.policyConfig.findMany({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      AND: [
        {
          OR: [
            { tenantId: null },
            { tenantId: input.tenantId },
          ],
        },
        {
          OR: [
            { brandId: null },
            ...(input.brandId ? [{ brandId: input.brandId }] : []),
          ],
        },
        {
          OR: [
            { productId: null },
            ...(input.productId ? [{ productId: input.productId }] : []),
          ],
        },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const result: ResolvedPolicy = {
    resolvedAt: new Date().toISOString(),
    values: { ...SYSTEM_DEFAULTS },
    source: {
      targetAcos: 'SYSTEM',
      minBid: 'SYSTEM',
      maxDailyBudgetChangePct: 'SYSTEM',
      freshnessTtlMinutes: 'SYSTEM',
    },
  };

  const keys = Object.keys(result.values) as Array<keyof ResolvedPolicy['values']>;
  for (const key of keys) {
    const candidates = rows
      .filter((row) => row.policyKey === key)
      .sort((a, b) => specificityOf(b) - specificityOf(a));

    const winner = candidates[0];
    if (!winner) continue;

    const raw = winner.policyValue as unknown;
    const num =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : typeof raw === 'object' && raw !== null && 'value' in (raw as Record<string, unknown>)
            ? Number((raw as Record<string, unknown>).value)
            : Number.NaN;

    if (!Number.isNaN(num)) {
      result.values[key] = num;
      result.source[key] = scopeOf(winner);
    }
  }

  return result;
}
