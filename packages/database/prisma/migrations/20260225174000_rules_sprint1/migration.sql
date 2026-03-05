-- Sprint 1 rules management tables

-- Create enums
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "RuleConflictSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');
CREATE TYPE "RuleConflictType" AS ENUM ('DIRECT_CONTRADICTION', 'LOGIC_CONFLICT', 'RANGE_OVERLAP', 'PRIORITY_AMBIGUITY');

-- Create tables
CREATE TABLE "RuleSet" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "status" "RuleSetStatus" NOT NULL DEFAULT 'DRAFT',
  "activeVersion" INTEGER,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuleVersion" (
  "id" UUID NOT NULL,
  "ruleSetId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "changeSummary" TEXT,
  "createdBy" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "conflicts" JSONB,
  "suggestions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuleConflictRecord" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ruleSetId" UUID,
  "ruleVersionId" UUID,
  "conflictType" "RuleConflictType" NOT NULL,
  "severity" "RuleConflictSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "payload" JSONB,
  "ignored" BOOLEAN NOT NULL DEFAULT FALSE,
  "ignoredReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuleConflictRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RuleSuggestionRecord" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ruleSetId" UUID,
  "ruleVersionId" UUID,
  "suggestionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "rationale" JSONB,
  "applied" BOOLEAN NOT NULL DEFAULT FALSE,
  "ignored" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuleSuggestionRecord_pkey" PRIMARY KEY ("id")
);

-- Constraints
CREATE UNIQUE INDEX "RuleVersion_ruleSetId_version_key" ON "RuleVersion"("ruleSetId", "version");

CREATE INDEX "RuleSet_tenantId_status_updatedAt_idx" ON "RuleSet"("tenantId", "status", "updatedAt");
CREATE INDEX "RuleVersion_ruleSetId_createdAt_idx" ON "RuleVersion"("ruleSetId", "createdAt");
CREATE INDEX "RuleConflictRecord_tenantId_createdAt_idx" ON "RuleConflictRecord"("tenantId", "createdAt");
CREATE INDEX "RuleConflictRecord_ruleSetId_idx" ON "RuleConflictRecord"("ruleSetId");
CREATE INDEX "RuleConflictRecord_ruleVersionId_idx" ON "RuleConflictRecord"("ruleVersionId");
CREATE INDEX "RuleSuggestionRecord_tenantId_createdAt_idx" ON "RuleSuggestionRecord"("tenantId", "createdAt");
CREATE INDEX "RuleSuggestionRecord_ruleSetId_idx" ON "RuleSuggestionRecord"("ruleSetId");
CREATE INDEX "RuleSuggestionRecord_ruleVersionId_idx" ON "RuleSuggestionRecord"("ruleVersionId");

ALTER TABLE "RuleSet"
  ADD CONSTRAINT "RuleSet_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RuleVersion"
  ADD CONSTRAINT "RuleVersion_ruleSetId_fkey"
  FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RuleConflictRecord"
  ADD CONSTRAINT "RuleConflictRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RuleSuggestionRecord"
  ADD CONSTRAINT "RuleSuggestionRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
