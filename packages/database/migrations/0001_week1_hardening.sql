-- Week 1 hardening migration
-- Apply after Prisma created base tables.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enable row-level security (tenant isolation)
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Commodity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Listing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentExecutionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PolicyConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PolicySnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RuleSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RuleConflictRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RuleSuggestionRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestNonce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAuditEvent" ENABLE ROW LEVEL SECURITY;

-- Force RLS to apply even for table owners
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Brand" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Commodity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Listing" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceSnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AgentExecutionLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalQueue" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PolicyConfig" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PolicySnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RuleSet" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RuleConflictRecord" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RuleSuggestionRecord" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RequestNonce" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SecurityAuditEvent" FORCE ROW LEVEL SECURITY;

-- Use app.tenant_id session variable to enforce isolation.
DROP POLICY IF EXISTS tenant_isolation_brand ON "Brand";
CREATE POLICY tenant_isolation_brand ON "Brand"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_product ON "Product";
CREATE POLICY tenant_isolation_product ON "Product"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_commodity ON "Commodity";
CREATE POLICY tenant_isolation_commodity ON "Commodity"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_listing ON "Listing";
CREATE POLICY tenant_isolation_listing ON "Listing"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_snapshot ON "PerformanceSnapshot";
CREATE POLICY tenant_isolation_snapshot ON "PerformanceSnapshot"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_exec ON "AgentExecutionLog";
CREATE POLICY tenant_isolation_exec ON "AgentExecutionLog"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_approval ON "ApprovalQueue";
CREATE POLICY tenant_isolation_approval ON "ApprovalQueue"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_policy_config ON "PolicyConfig";
CREATE POLICY tenant_isolation_policy_config ON "PolicyConfig"
  USING ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" IS NULL OR "tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_policy_snapshot ON "PolicySnapshot";
CREATE POLICY tenant_isolation_policy_snapshot ON "PolicySnapshot"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_rule_set ON "RuleSet";
CREATE POLICY tenant_isolation_rule_set ON "RuleSet"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_rule_conflict ON "RuleConflictRecord";
CREATE POLICY tenant_isolation_rule_conflict ON "RuleConflictRecord"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_rule_suggestion ON "RuleSuggestionRecord";
CREATE POLICY tenant_isolation_rule_suggestion ON "RuleSuggestionRecord"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_request_nonce ON "RequestNonce";
CREATE POLICY tenant_isolation_request_nonce ON "RequestNonce"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_security_audit ON "SecurityAuditEvent";
CREATE POLICY tenant_isolation_security_audit ON "SecurityAuditEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- Optional tenant self visibility
DROP POLICY IF EXISTS tenant_self_visibility ON "Tenant";
CREATE POLICY tenant_self_visibility ON "Tenant"
  USING ("id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("id" = current_setting('app.tenant_id', true)::uuid);

-- Prevent overlap in PolicyConfig effective windows for same scope+key
ALTER TABLE "PolicyConfig"
  DROP CONSTRAINT IF EXISTS policy_config_no_overlap;

ALTER TABLE "PolicyConfig"
  ADD CONSTRAINT policy_config_no_overlap EXCLUDE USING gist (
    coalesce("tenantId", '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    coalesce("brandId", '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    coalesce("productId", '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    "policyKey" WITH =,
    tsrange("effectiveFrom", coalesce("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  );

-- Notify on new approval queue item
CREATE OR REPLACE FUNCTION notify_approval_created()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'approvals',
    json_build_object(
      'id', NEW.id,
      'tenantId', NEW."tenantId",
      'intentId', NEW."intentId",
      'domain', NEW.domain,
      'action', NEW.action,
      'status', NEW.status,
      'createdAt', NEW."createdAt"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_approval_created ON "ApprovalQueue";
CREATE TRIGGER trg_notify_approval_created
AFTER INSERT ON "ApprovalQueue"
FOR EACH ROW EXECUTE FUNCTION notify_approval_created();

-- Extra support indexes for killer query
CREATE INDEX IF NOT EXISTS idx_snapshot_scope_day_desc
ON "PerformanceSnapshot" (
  "tenantId", platform, market, brand, category, fulfillment, "snapshotDate" DESC
);

CREATE INDEX IF NOT EXISTS idx_listing_scope
ON "Listing" ("tenantId", "platformId", "commodityId");
