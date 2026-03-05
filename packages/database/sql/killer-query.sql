-- Killer Query: multi-dimension product-centric performance rollup
EXPLAIN (ANALYZE, BUFFERS)
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
