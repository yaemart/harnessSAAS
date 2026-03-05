-- =========================================
-- 每日对账 SQL（双写期使用）
-- 执行环境：psql / DBA 工具，以 app_user 或 superuser 运行
-- 频率：每天一次，建议 UTC 00:30
-- =========================================

-- ─── 1. P0：双 APPROVED 冲突检查 ───────────────────────
-- 预期：结果集为空。有记录即为 P0（阻断），立即修复。
SELECT
  tenant_id,
  entity_type,
  source_system,
  external_id,
  COALESCE(external_sub_id, '') AS sub_id,
  COUNT(*) AS approved_count
FROM external_id_mapping
WHERE status = 'APPROVED'
GROUP BY tenant_id, entity_type, source_system, external_id, COALESCE(external_sub_id, '')
HAVING COUNT(*) > 1;

-- ─── 2. P1：状态分布总览（每日快照对比）──────────────────
SELECT
  tenant_id,
  status,
  entity_type,
  COUNT(*) AS cnt
FROM external_id_mapping
GROUP BY tenant_id, status, entity_type
ORDER BY tenant_id, status, entity_type;

-- ─── 3. P1：新 APPROVED 映射覆盖率（按来源系统）─────────
SELECT
  source_system,
  entity_type,
  COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
  COUNT(*) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'APPROVED')::numeric / NULLIF(COUNT(*), 0) * 100, 2
  ) AS coverage_pct
FROM external_id_mapping
GROUP BY source_system, entity_type
ORDER BY source_system, entity_type;

-- ─── 4. P1：有效期内 APPROVED 但 effective_to 已过期 ────
SELECT id, tenant_id, entity_type, source_system, external_id, effective_to
FROM external_id_mapping
WHERE status = 'APPROVED'
  AND effective_to IS NOT NULL
  AND effective_to < now();

-- ─── 5. P2：cost_version 有效期重叠检测（同产品）────────
SELECT
  a.tenant_id,
  a.product_global_id,
  a.id AS version_a,
  b.id AS version_b,
  a.effective_from AS a_from,
  a.effective_to AS a_to,
  b.effective_from AS b_from,
  b.effective_to AS b_to
FROM cost_version a
JOIN cost_version b
  ON a.tenant_id = b.tenant_id
  AND a.product_global_id = b.product_global_id
  AND a.id < b.id
  AND a.status = 'ACTIVE'
  AND b.status = 'ACTIVE'
  AND tstzrange(a.effective_from, COALESCE(a.effective_to, 'infinity'), '[)')
  && tstzrange(b.effective_from, COALESCE(b.effective_to, 'infinity'), '[)');

-- ─── 6. P2：mapping_history 缺失检查（有状态变更但无记录）
-- 按 mapping 统计 history 数量，发现 count=0 的为缺失
SELECT
  m.id,
  m.tenant_id,
  m.status,
  COUNT(h.id) AS history_count
FROM external_id_mapping m
LEFT JOIN mapping_history h ON h.mapping_id = m.id
WHERE m.status IN ('APPROVED','REJECTED','REVOKED','SOFT_REVOKED')
GROUP BY m.id, m.tenant_id, m.status
HAVING COUNT(h.id) = 0
LIMIT 50;
