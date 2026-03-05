-- Experience table monthly partitioning plan
-- Run this AFTER converting the table to partitioned format
-- NOTE: Prisma doesn't support partitioned tables natively.
-- This must be run as a raw SQL migration.

-- Step 1: Create partitioned table (run once, replace existing)
-- WARNING: Back up data before running in production
/*
CREATE TABLE agent_experience_partitioned (
  LIKE "AgentExperience" INCLUDING ALL
) PARTITION BY RANGE ("createdAt");

-- Step 2: Create monthly partitions
CREATE TABLE agent_experience_y2026m01 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE agent_experience_y2026m02 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE agent_experience_y2026m03 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE agent_experience_y2026m04 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE agent_experience_y2026m05 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE agent_experience_y2026m06 PARTITION OF agent_experience_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Step 3: Default partition for future data
CREATE TABLE agent_experience_default PARTITION OF agent_experience_partitioned DEFAULT;

-- Step 4: Archive policy (run periodically)
-- Detach partitions older than 90 days:
-- ALTER TABLE agent_experience_partitioned DETACH PARTITION agent_experience_y2025m12;
*/

-- For now, add indexes to improve query performance on the existing table
-- Prisma maps camelCase fields to quoted "camelCase" columns in PostgreSQL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experience_tenant_created
  ON "AgentExperience" ("tenantId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experience_domain_platform
  ON "AgentExperience" ("intentDomain", "platform", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experience_category
  ON "AgentExperience" ("categoryId", "createdAt" DESC)
  WHERE "categoryId" IS NOT NULL;
