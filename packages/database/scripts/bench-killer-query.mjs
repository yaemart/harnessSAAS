import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tenantId = process.env.BENCH_TENANT_ID;
if (!tenantId) {
  console.error('BENCH_TENANT_ID is required');
  process.exit(1);
}

const platform = process.env.BENCH_PLATFORM || 'amazon';
const market = process.env.BENCH_MARKET || 'US';
const brand = process.env.BENCH_BRAND || 'default-brand';
const category = process.env.BENCH_CATEGORY || 'default-category';
const fulfillment = process.env.BENCH_FULFILLMENT || 'FBA';
const fromDate = process.env.BENCH_FROM_DATE || '2025-01-01';
const toDate = process.env.BENCH_TO_DATE || '2025-01-31';

const sql = `
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  ps."productId",
  SUM(ps.spend) AS total_spend,
  SUM(ps.sales) AS total_sales,
  SUM(ps.clicks) AS total_clicks,
  SUM(ps.orders) AS total_orders,
  CASE WHEN SUM(ps.spend) = 0 THEN 0 ELSE SUM(ps.sales) / SUM(ps.spend) END AS roas
FROM "PerformanceSnapshot" ps
WHERE ps."tenantId" = $1::uuid
  AND ps.platform = $2
  AND ps.market = $3
  AND ps.brand = $4
  AND ps.category = $5
  AND ps.fulfillment = $6
  AND ps."snapshotDate" BETWEEN $7::date AND $8::date
GROUP BY ps."productId"
ORDER BY total_sales DESC
LIMIT 50;
`;

async function main() {
  const start = Date.now();
  const result = await prisma.$queryRawUnsafe(
    sql,
    tenantId,
    platform,
    market,
    brand,
    category,
    fulfillment,
    fromDate,
    toDate,
  );

  const duration = Date.now() - start;
  const queryPlan = result?.[0]?.['QUERY PLAN']?.[0];
  const execMs = queryPlan?.['Execution Time'];

  console.log(JSON.stringify({ durationMs: duration, executionTimeMs: execMs, queryPlan }, null, 2));

  if (typeof execMs === 'number' && execMs > 100) {
    console.warn(`SLO WARN: killer query execution time ${execMs}ms exceeds 100ms target.`);
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
