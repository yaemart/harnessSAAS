-- Week 2: Add plan field to Tenant for OPA policy binding
CREATE TYPE "TenantPlan" AS ENUM ('starter', 'pro', 'enterprise');
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS plan "TenantPlan" NOT NULL DEFAULT 'starter';
