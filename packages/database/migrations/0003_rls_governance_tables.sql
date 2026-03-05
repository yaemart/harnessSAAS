-- 0003_rls_governance_tables.sql
-- 补齐 harness_governance_runtime 迁移遗漏的 FORCE + POLICY
-- 生产级写法：current_setting 为空时返回 0 行而非抛异常
-- 执行账号：postgres (superuser)

-- ── KnowledgeEntry ─────────────────────────────────────────────────────────
ALTER TABLE "KnowledgeEntry" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_knowledge_entry ON "KnowledgeEntry";
CREATE POLICY tenant_isolation_knowledge_entry ON "KnowledgeEntry"
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  );

-- ── FeedbackSignal ─────────────────────────────────────────────────────────
ALTER TABLE "FeedbackSignal" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_feedback_signal ON "FeedbackSignal";
CREATE POLICY tenant_isolation_feedback_signal ON "FeedbackSignal"
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  );

-- ── ConfidenceLedger ───────────────────────────────────────────────────────
ALTER TABLE "ConfidenceLedger" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_confidence_ledger ON "ConfidenceLedger";
CREATE POLICY tenant_isolation_confidence_ledger ON "ConfidenceLedger"
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  );

-- ── TenantMaturity ─────────────────────────────────────────────────────────
ALTER TABLE "TenantMaturity" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenant_maturity ON "TenantMaturity";
CREATE POLICY tenant_isolation_tenant_maturity ON "TenantMaturity"
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND "tenantId" = current_setting('app.tenant_id', true)::uuid
  );

-- ── 验证块 ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  missing TEXT[] := '{}';
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'KnowledgeEntry', 'FeedbackSignal', 'ConfidenceLedger', 'TenantMaturity'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = tbl AND policyname LIKE 'tenant_isolation_%'
    ) THEN
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'RLS policy missing on: %', missing;
  END IF;

  RAISE NOTICE 'All 4 governance tables have tenant_isolation policies.';
END $$;
