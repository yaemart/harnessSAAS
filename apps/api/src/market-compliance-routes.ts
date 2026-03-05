import { Hono } from 'hono';
import { prisma } from './db.js';
import { extractUser, requireRole } from './auth-middleware.js';
import type { AuthContext } from './auth-middleware.js';

export const marketComplianceRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

marketComplianceRoutes.use('*', extractUser);

// GET /market-compliance — 返回所有活跃市场合规数据
marketComplianceRoutes.get('/', requireRole('system_admin'), async (c) => {
  const markets = await prisma.$queryRaw<
    Array<{
      id: string;
      country_code: string;
      country_name: string;
      region: string;
      currency_code: string;
      currency_symbol: string;
      tax_type: string;
      standard_tax_rate: number;
      reduced_tax_rate: number | null;
      import_duty_threshold_local: number | null;
      import_duty_threshold_usd: number | null;
      vat_threshold_local: number | null;
      marketplace_collects_tax: boolean;
      ioss_supported: boolean;
      prohibited_categories: string[];
      requires_ce_mark: boolean;
      tax_notes: string | null;
      data_source_url: string | null;
      effective_date: Date;
      next_review_date: Date | null;
      is_active: boolean;
      updated_at: Date;
    }>
  >`
    SELECT
      id, country_code, country_name, region,
      currency_code, currency_symbol,
      tax_type,
      CAST(standard_tax_rate AS FLOAT)     AS standard_tax_rate,
      CAST(reduced_tax_rate AS FLOAT)       AS reduced_tax_rate,
      CAST(import_duty_threshold_local AS FLOAT) AS import_duty_threshold_local,
      CAST(import_duty_threshold_usd AS FLOAT)   AS import_duty_threshold_usd,
      CAST(vat_threshold_local AS FLOAT)    AS vat_threshold_local,
      marketplace_collects_tax, ioss_supported,
      prohibited_categories, requires_ce_mark,
      tax_notes, data_source_url,
      effective_date, next_review_date,
      is_active, updated_at
    FROM markets
    WHERE is_active = TRUE
    ORDER BY region, country_code
  `;

  // 计算每个市场的复核状态
  const today = new Date();
  const enriched = markets.map((m) => {
    const reviewDate = m.next_review_date ? new Date(m.next_review_date) : null;
    const daysUntilReview = reviewDate
      ? Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let reviewStatus: 'ok' | 'due_soon' | 'overdue' = 'ok';
    if (daysUntilReview !== null) {
      if (daysUntilReview < 0) reviewStatus = 'overdue';
      else if (daysUntilReview <= 30) reviewStatus = 'due_soon';
    }

    return {
      ...m,
      standard_tax_rate: Number(m.standard_tax_rate),
      reduced_tax_rate: m.reduced_tax_rate !== null ? Number(m.reduced_tax_rate) : null,
      import_duty_threshold_local: m.import_duty_threshold_local !== null ? Number(m.import_duty_threshold_local) : null,
      import_duty_threshold_usd: m.import_duty_threshold_usd !== null ? Number(m.import_duty_threshold_usd) : null,
      vat_threshold_local: m.vat_threshold_local !== null ? Number(m.vat_threshold_local) : null,
      days_until_review: daysUntilReview,
      review_status: reviewStatus,
      effective_date: m.effective_date ? new Date(m.effective_date).toISOString().slice(0, 10) : null,
      next_review_date: reviewDate ? reviewDate.toISOString().slice(0, 10) : null,
      updated_at: new Date(m.updated_at).toISOString(),
    };
  });

  return c.json(enriched);
});

// GET /market-compliance/summary — 摘要统计
marketComplianceRoutes.get('/summary', requireRole('system_admin'), async (c) => {
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, overdueRows, dueSoonRows, lastUpdatedRows] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) AS count FROM markets WHERE is_active = TRUE`,
    prisma.$queryRaw<Array<{ country_code: string; next_review_date: Date }>>`
      SELECT country_code, next_review_date FROM markets
      WHERE is_active = TRUE AND next_review_date < ${today}
    `,
    prisma.$queryRaw<Array<{ country_code: string; next_review_date: Date }>>`
      SELECT country_code, next_review_date FROM markets
      WHERE is_active = TRUE
        AND next_review_date >= ${today}
        AND next_review_date <= ${in30Days}
    `,
    prisma.$queryRaw<[{ updated_at: Date }]>`
      SELECT updated_at FROM markets WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1
    `,
  ]);

  return c.json({
    total_markets: Number((total[0] as { count: bigint }).count),
    overdue_count: overdueRows.length,
    due_soon_count: dueSoonRows.length,
    overdue_markets: overdueRows.map((r) => r.country_code),
    due_soon_markets: dueSoonRows.map((r) => r.country_code),
    last_seed_updated_at: lastUpdatedRows[0]?.updated_at
      ? new Date(lastUpdatedRows[0].updated_at).toISOString()
      : null,
  });
});
