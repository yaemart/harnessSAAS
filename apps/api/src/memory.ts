import { prisma } from './db.js';

export interface MemoryQuery {
  tenantId: string;
  domain?: string;
  platform?: string;
  market?: string;
  categoryId?: string;
  embedding?: number[];
  limit?: number;
  daysBack?: number;
}

export interface MemoryResult {
  id: string;
  traceId: string;
  intentType: string;
  intentDomain: string;
  platform: string;
  market: string;
  executionStatus: string;
  qualityScore: number | null;
  createdAt: Date;
  similarity?: number;
}

export async function queryMemory(query: MemoryQuery): Promise<MemoryResult[]> {
  const limit = Math.min(query.limit ?? 10, 50);
  const daysBack = query.daysBack ?? 90;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  if (query.embedding && query.embedding.length === 384) {
    const embeddingStr = `[${query.embedding.join(',')}]`;
    const results = await prisma.$queryRawUnsafe<Array<MemoryResult & { similarity: number }>>(
      `SELECT id, "traceId", "intentType", "intentDomain", platform, market,
              "executionStatus", "qualityScore", "createdAt",
              1 - ("contextEmbedding" <=> $1::vector) as similarity
       FROM "AgentExperience"
       WHERE "tenantId" = $2
         AND ($3::text IS NULL OR "intentDomain" = $3)
         AND "createdAt" > $4
         AND "contextEmbedding" IS NOT NULL
       ORDER BY "contextEmbedding" <=> $1::vector
       LIMIT $5`,
      embeddingStr,
      query.tenantId,
      query.domain ?? null,
      cutoff,
      limit,
    );
    return results;
  }

  const where: Record<string, unknown> = {
    tenantId: query.tenantId,
    createdAt: { gte: cutoff },
  };
  if (query.domain) where.intentDomain = query.domain;
  if (query.platform) where.platform = query.platform;
  if (query.market) where.market = query.market;
  if (query.categoryId) where.categoryId = query.categoryId;

  const results = await prisma.agentExperience.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      traceId: true,
      intentType: true,
      intentDomain: true,
      platform: true,
      market: true,
      executionStatus: true,
      qualityScore: true,
      createdAt: true,
    },
  });

  return results;
}

export async function storeEmbedding(
  experienceId: string,
  embedding: number[],
  tenantId?: string,
): Promise<{ updated: boolean }> {
  if (embedding.length !== 384) {
    throw new Error(`Expected 384-dim embedding, got ${embedding.length}`);
  }
  const embeddingStr = `[${embedding.join(',')}]`;
  const whereClause = tenantId
    ? `WHERE id = $2 AND "tenantId" = $3`
    : `WHERE id = $2`;
  const params: unknown[] = [embeddingStr, experienceId];
  if (tenantId) params.push(tenantId);

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE "AgentExperience" SET "contextEmbedding" = $1::vector ${whereClause}`,
    ...params,
  );
  return { updated: affected > 0 };
}
