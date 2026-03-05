-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('ACTIVE', 'DECAYING', 'DORMANT', 'ARCHIVED');
CREATE TYPE "FeedbackPriorityClass" AS ENUM ('SAFETY', 'EXPERIENCE');
CREATE TYPE "AutonomyLevel" AS ENUM ('GUIDED', 'ASSISTED', 'SUPERVISED', 'AUTONOMOUS');

-- CreateTable: KnowledgeEntry
CREATE TABLE "KnowledgeEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRef" TEXT,
    "supersededBy" UUID,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "decayRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeedbackSignal
CREATE TABLE "FeedbackSignal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceRole" TEXT NOT NULL,
    "priorityClass" "FeedbackPriorityClass" NOT NULL DEFAULT 'EXPERIENCE',
    "caseId" UUID,
    "intentId" TEXT,
    "agentAction" TEXT NOT NULL,
    "reason" TEXT,
    "correction" TEXT,
    "rating" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ConfidenceLedger
CREATE TABLE "ConfidenceLedger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "intentId" TEXT,
    "caseId" UUID,
    "agentAction" TEXT NOT NULL,
    "confidenceBefore" DOUBLE PRECISION NOT NULL,
    "confidenceAfter" DOUBLE PRECISION,
    "knowledgeUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowledgeWeights" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "ruleTriggered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ruleResult" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL,
    "executionResult" TEXT NOT NULL,
    "executionLatencyMs" INTEGER,
    "feedbackType" TEXT,
    "feedbackReason" TEXT,
    "feedbackSourceRole" TEXT,
    "feedbackAt" TIMESTAMP(3),
    "pipelineVersion" TEXT NOT NULL DEFAULT '1.0',
    "tenantMaturityScore" DOUBLE PRECISION,
    "agentAutonomyLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfidenceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TenantMaturity
CREATE TABLE "TenantMaturity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "maturityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'GUIDED',
    "autonomyOverride" "AutonomyLevel",
    "knowledgeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ruleScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedbackScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "historyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escalationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "autoExecuteLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMaturity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeEntry_tenantId_status_effectiveWeight_idx" ON "KnowledgeEntry"("tenantId", "status", "effectiveWeight" DESC);
CREATE INDEX "KnowledgeEntry_tenantId_category_idx" ON "KnowledgeEntry"("tenantId", "category");
CREATE INDEX "KnowledgeEntry_tenantId_source_idx" ON "KnowledgeEntry"("tenantId", "source");

CREATE INDEX "FeedbackSignal_tenantId_type_createdAt_idx" ON "FeedbackSignal"("tenantId", "type", "createdAt");
CREATE INDEX "FeedbackSignal_tenantId_caseId_idx" ON "FeedbackSignal"("tenantId", "caseId");
CREATE INDEX "FeedbackSignal_tenantId_intentId_idx" ON "FeedbackSignal"("tenantId", "intentId");

CREATE INDEX "ConfidenceLedger_tenantId_createdAt_idx" ON "ConfidenceLedger"("tenantId", "createdAt");
CREATE INDEX "ConfidenceLedger_tenantId_agentAction_createdAt_idx" ON "ConfidenceLedger"("tenantId", "agentAction", "createdAt");
CREATE INDEX "ConfidenceLedger_tenantId_caseId_idx" ON "ConfidenceLedger"("tenantId", "caseId");

CREATE UNIQUE INDEX "TenantMaturity_tenantId_key" ON "TenantMaturity"("tenantId");

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeedbackSignal" ADD CONSTRAINT "FeedbackSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfidenceLedger" ADD CONSTRAINT "ConfidenceLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantMaturity" ADD CONSTRAINT "TenantMaturity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS policies (tenant isolation)
ALTER TABLE "KnowledgeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConfidenceLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantMaturity" ENABLE ROW LEVEL SECURITY;
