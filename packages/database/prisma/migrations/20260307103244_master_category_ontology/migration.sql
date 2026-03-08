/*
  Warnings:

  - You are about to alter the column `contextEmbedding` on the `AgentExperience` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(384)")`.

*/
-- Enable pgvector (optional — skip if extension not available)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available, skipping';
END $$;

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('starter', 'pro', 'enterprise');

-- DropIndex
DROP INDEX IF EXISTS "ConfidenceLedger_knowledgeUsed_gin";

-- AlterTable (only if vector extension loaded)
DO $$ BEGIN
  ALTER TABLE "AgentExperience" ALTER COLUMN "contextEmbedding" SET DATA TYPE vector(384) USING "contextEmbedding"::vector(384);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'vector cast skipped — contextEmbedding remains TEXT';
END $$;

-- AlterTable
ALTER TABLE "BrandPortalConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CaseMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConfidenceLedger" ADD COLUMN     "agentDomain" TEXT NOT NULL DEFAULT 'portal',
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ConsumerFAQ" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CostVersion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ExternalIdMapping" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FeedbackSignal" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalCategory" ADD COLUMN     "attributeSchema" JSONB,
ADD COLUMN     "mappingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nameZh" TEXT,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "replacedBy" UUID,
ADD COLUMN     "slugPath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalErpSystem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalMarket" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalPlatform" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalTool" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalWarehouse" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KnowledgeEntry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MediaAnalysis" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PortalConsumer" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductFeedback" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QRScanEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportCase" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "plan" "TenantPlan" NOT NULL DEFAULT 'starter';

-- AlterTable
ALTER TABLE "TenantMaturity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WarrantyRegistration" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlatformCategory" (
    "id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "platformCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "marketCode" TEXT,
    "parentId" UUID,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryPlatformMapping" (
    "id" UUID NOT NULL,
    "globalCategoryId" UUID NOT NULL,
    "platformCategoryId" UUID,
    "platform" TEXT NOT NULL,
    "marketCode" TEXT,
    "externalCategoryId" TEXT,
    "externalPath" TEXT,
    "mappingType" TEXT NOT NULL DEFAULT 'EXACT',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "direction" TEXT NOT NULL DEFAULT 'BIDIRECTIONAL',
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryPlatformMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAlias" (
    "id" UUID NOT NULL,
    "globalCategoryId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFeatureSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productGlobalId" UUID NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalSales" DECIMAL(14,2),
    "totalAdSpend" DECIMAL(14,2),
    "profit" DECIMAL(14,2),
    "inventory" INTEGER,
    "acos" DECIMAL(5,4),
    "roas" DECIMAL(8,4),
    "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mappingConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceMapping" TEXT,
    "market" TEXT,
    "platform" TEXT,
    "featureJson" JSONB,
    "writtenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityHash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "inputFeatures" JSONB,
    "outputAction" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "decisionLogId" UUID,
    "entityHash" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "attributionWindowHours" INTEGER NOT NULL DEFAULT 24,
    "rawSignal" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformCategory_platform_marketCode_idx" ON "PlatformCategory"("platform", "marketCode");

-- CreateIndex
CREATE INDEX "PlatformCategory_parentId_idx" ON "PlatformCategory"("parentId");

-- CreateIndex
CREATE INDEX "PlatformCategory_platform_level_idx" ON "PlatformCategory"("platform", "level");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCategory_platform_platformCategoryId_marketCode_key" ON "PlatformCategory"("platform", "platformCategoryId", "marketCode");

-- CreateIndex
CREATE INDEX "CategoryPlatformMapping_platform_marketCode_idx" ON "CategoryPlatformMapping"("platform", "marketCode");

-- CreateIndex
CREATE INDEX "CategoryPlatformMapping_globalCategoryId_idx" ON "CategoryPlatformMapping"("globalCategoryId");

-- CreateIndex
CREATE INDEX "CategoryPlatformMapping_platformCategoryId_idx" ON "CategoryPlatformMapping"("platformCategoryId");

-- CreateIndex
CREATE INDEX "CategoryPlatformMapping_status_idx" ON "CategoryPlatformMapping"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryPlatformMapping_globalCategoryId_platformCategoryId_key" ON "CategoryPlatformMapping"("globalCategoryId", "platformCategoryId", "marketCode");

-- CreateIndex
CREATE INDEX "CategoryAlias_globalCategoryId_idx" ON "CategoryAlias"("globalCategoryId");

-- CreateIndex
CREATE INDEX "CategoryAlias_alias_idx" ON "CategoryAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAlias_globalCategoryId_alias_language_key" ON "CategoryAlias"("globalCategoryId", "alias", "language");

-- CreateIndex
CREATE INDEX "ProductFeatureSnapshot_tenantId_productGlobalId_snapshotDat_idx" ON "ProductFeatureSnapshot"("tenantId", "productGlobalId", "snapshotDate" DESC);

-- CreateIndex
CREATE INDEX "ProductFeatureSnapshot_tenantId_snapshotDate_idx" ON "ProductFeatureSnapshot"("tenantId", "snapshotDate");

-- CreateIndex
CREATE INDEX "ProductFeatureSnapshot_tenantId_market_platform_snapshotDat_idx" ON "ProductFeatureSnapshot"("tenantId", "market", "platform", "snapshotDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductFeatureSnapshot_tenantId_productGlobalId_snapshotDat_key" ON "ProductFeatureSnapshot"("tenantId", "productGlobalId", "snapshotDate");

-- CreateIndex
CREATE INDEX "DecisionLog_tenantId_entityHash_decidedAt_idx" ON "DecisionLog"("tenantId", "entityHash", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "DecisionLog_tenantId_agentId_decidedAt_idx" ON "DecisionLog"("tenantId", "agentId", "decidedAt");

-- CreateIndex
CREATE INDEX "DecisionLog_tenantId_decisionType_decidedAt_idx" ON "DecisionLog"("tenantId", "decisionType", "decidedAt");

-- CreateIndex
CREATE INDEX "RewardLog_tenantId_entityHash_observedAt_idx" ON "RewardLog"("tenantId", "entityHash", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "RewardLog_tenantId_decisionLogId_idx" ON "RewardLog"("tenantId", "decisionLogId");

-- CreateIndex
CREATE INDEX "RewardLog_tenantId_rewardType_observedAt_idx" ON "RewardLog"("tenantId", "rewardType", "observedAt");

-- CreateIndex
CREATE INDEX "ConfidenceLedger_tenantId_agentDomain_createdAt_idx" ON "ConfidenceLedger"("tenantId", "agentDomain", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackSignal_tenantId_type_createdAt_agentAction_idx" ON "FeedbackSignal"("tenantId", "type", "createdAt", "agentAction");

-- CreateIndex
CREATE INDEX "GlobalCategory_source_idx" ON "GlobalCategory"("source");

-- CreateIndex
CREATE INDEX "GlobalCategory_status_idx" ON "GlobalCategory"("status");

-- CreateIndex
CREATE INDEX "GlobalCategory_sortOrder_idx" ON "GlobalCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_tenantId_source_sourceRef_idx" ON "KnowledgeEntry"("tenantId", "source", "sourceRef");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_tenantId_source_createdAt_idx" ON "KnowledgeEntry"("tenantId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_tenantId_source_lastUsedAt_idx" ON "KnowledgeEntry"("tenantId", "source", "lastUsedAt");

-- CreateIndex
CREATE INDEX "PolicyConfig_tenantId_brandId_productId_policyKey_effective_idx" ON "PolicyConfig"("tenantId", "brandId", "productId", "policyKey", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_status_assignedTo_idx" ON "SupportCase"("tenantId", "status", "assignedTo");

-- AddForeignKey
ALTER TABLE "GlobalCategory" ADD CONSTRAINT "GlobalCategory_replacedBy_fkey" FOREIGN KEY ("replacedBy") REFERENCES "GlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCategory" ADD CONSTRAINT "PlatformCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlatformCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryPlatformMapping" ADD CONSTRAINT "CategoryPlatformMapping_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "GlobalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryPlatformMapping" ADD CONSTRAINT "CategoryPlatformMapping_platformCategoryId_fkey" FOREIGN KEY ("platformCategoryId") REFERENCES "PlatformCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAlias" ADD CONSTRAINT "CategoryAlias_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "GlobalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeatureSnapshot" ADD CONSTRAINT "ProductFeatureSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFeatureSnapshot" ADD CONSTRAINT "ProductFeatureSnapshot_productGlobalId_fkey" FOREIGN KEY ("productGlobalId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLog" ADD CONSTRAINT "RewardLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ExternalIdMapping_tenantId_sourceSystem_entityType_status_creat" RENAME TO "ExternalIdMapping_tenantId_sourceSystem_entityType_status_c_idx";
