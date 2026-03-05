-- CreateEnum
CREATE TYPE "PatternGrade" AS ENUM ('SHADOW', 'SUGGEST', 'AUTO_LOW', 'AUTO_FULL');

-- DropIndex
DROP INDEX "Commodity_productId_market_language_key";

-- DropIndex
DROP INDEX "Commodity_tenantId_market_idx";

-- DropIndex
DROP INDEX "Listing_commodityId_platform_idx";

-- DropIndex
DROP INDEX "Listing_platform_externalListingId_key";

-- DropIndex
DROP INDEX "Listing_tenantId_platform_fulfillment_idx";

-- DropIndex
DROP INDEX "Product_tenantId_brandId_category_idx";

-- AlterTable
ALTER TABLE "AgentExecutionLog" ADD COLUMN     "targetKey" TEXT;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Commodity" DROP COLUMN "market",
ADD COLUMN     "complianceDocuments" JSONB,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "localBaseCost" DECIMAL(14,2),
ADD COLUMN     "localDimensions" JSONB,
ADD COLUMN     "localMsrp" DECIMAL(14,2),
ADD COLUMN     "localSupportContact" TEXT,
ADD COLUMN     "marketId" UUID NOT NULL,
ADD COLUMN     "routingWarehouseId" UUID,
ADD COLUMN     "semanticSynonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetMargin" DECIMAL(5,2),
ADD COLUMN     "warrantyPeriodMonths" INTEGER;

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "fulfillment",
DROP COLUMN "platform",
ADD COLUMN     "mappedAt" TIMESTAMP(3),
ADD COLUMN     "mappedBy" TEXT,
ADD COLUMN     "mappingStatus" TEXT NOT NULL DEFAULT 'mapped',
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "platformFulfillmentModeId" UUID,
ADD COLUMN     "platformId" UUID NOT NULL,
ADD COLUMN     "rawPlatformData" JSONB,
ADD COLUMN     "thirdPartyLogisticsId" UUID,
ALTER COLUMN "commodityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category",
ADD COLUMN     "asin" TEXT,
ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "categoryId" UUID NOT NULL,
ADD COLUMN     "competitiveEdges" JSONB,
ADD COLUMN     "costPrice" DECIMAL(14,2),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "msrp" DECIMAL(14,2),
ADD COLUMN     "scenarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "structuredFeatures" JSONB,
ADD COLUMN     "supplierId" UUID,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetIntents" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "upc" TEXT,
ADD COLUMN     "weight" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "ExecutionReceipt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "executionLogId" UUID NOT NULL,
    "intentId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rollbackSupported" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExperience" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "traceId" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "intentDomain" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "categoryId" TEXT,
    "observeSnapshot" JSONB NOT NULL,
    "orientAnalysis" JSONB NOT NULL,
    "decideRationale" JSONB NOT NULL,
    "actIntent" JSONB NOT NULL,
    "executionStatus" TEXT NOT NULL,
    "executionReceipt" JSONB,
    "outcomeMetrics" JSONB,
    "qualityScore" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "contextEmbedding" vector(384),
    "distilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcomeMeasuredAt" TIMESTAMP(3),

    CONSTRAINT "AgentExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketLanguage" (
    "id" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiType" TEXT NOT NULL,
    "apiCredentials" JSONB,
    "apiStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFulfillmentMode" (
    "id" UUID NOT NULL,
    "platformId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PlatformFulfillmentMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttributeSchema" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "enumValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "aiHint" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttributeSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCategory" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyLogistics" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiCredentials" JSONB,
    "apiStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdPartyLogistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'transit',
    "country" TEXT NOT NULL DEFAULT 'CN',
    "address" TEXT,
    "capacity" INTEGER,
    "apiCredentials" JSONB,
    "apiStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "leadTimeDays" INTEGER,
    "moq" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "country" TEXT NOT NULL DEFAULT 'CN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSystem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "erpType" TEXT NOT NULL,
    "apiCredentials" JSONB,
    "apiStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "syncDirection" TEXT NOT NULL DEFAULT 'bidirectional',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityMedia" (
    "id" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'youtube',
    "language" TEXT NOT NULL,
    "aiSummary" TEXT,
    "duration" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommodityMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChangeLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSkuMapping" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "externalSku" TEXT NOT NULL,
    "externalName" TEXT,
    "rawData" JSONB,
    "mappingStatus" TEXT NOT NULL DEFAULT 'unmapped',
    "mappedBy" TEXT,
    "mappedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalSkuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistilledPattern" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentDomain" TEXT NOT NULL,
    "platform" TEXT,
    "market" TEXT,
    "lifecycleStage" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleTree" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "grade" "PatternGrade" NOT NULL DEFAULT 'SHADOW',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastValidatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistilledPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternApplication" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patternId" UUID NOT NULL,
    "experienceId" UUID,
    "traceId" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeLayerA" (
    "id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "version" INTEGER NOT NULL DEFAULT 1,
    "requiresDualApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeLayerA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeLayerB" (
    "id" UUID NOT NULL,
    "industryCategory" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "contributingTenants" INTEGER NOT NULL DEFAULT 0,
    "noiseApplied" BOOLEAN NOT NULL DEFAULT false,
    "aggregationMethod" TEXT NOT NULL DEFAULT 'median',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeLayerB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "tenantId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionReceipt_executionLogId_key" ON "ExecutionReceipt"("executionLogId");

-- CreateIndex
CREATE INDEX "ExecutionReceipt_tenantId_createdAt_idx" ON "ExecutionReceipt"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionReceipt_intentId_idx" ON "ExecutionReceipt"("intentId");

-- CreateIndex
CREATE INDEX "AgentExperience_tenantId_intentDomain_idx" ON "AgentExperience"("tenantId", "intentDomain");

-- CreateIndex
CREATE INDEX "AgentExperience_platform_market_idx" ON "AgentExperience"("platform", "market");

-- CreateIndex
CREATE INDEX "AgentExperience_createdAt_idx" ON "AgentExperience"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentExperience_distilled_idx" ON "AgentExperience"("distilled");

-- CreateIndex
CREATE INDEX "Market_tenantId_idx" ON "Market"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_tenantId_code_key" ON "Market"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MarketLanguage_marketId_language_key" ON "MarketLanguage"("marketId", "language");

-- CreateIndex
CREATE INDEX "Platform_tenantId_idx" ON "Platform"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_tenantId_code_key" ON "Platform"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFulfillmentMode_platformId_code_key" ON "PlatformFulfillmentMode"("platformId", "code");

-- CreateIndex
CREATE INDEX "Category_tenantId_parentId_idx" ON "Category"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_code_key" ON "Category"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeSchema_categoryId_fieldKey_key" ON "CategoryAttributeSchema"("categoryId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCategory_brandId_categoryId_key" ON "BrandCategory"("brandId", "categoryId");

-- CreateIndex
CREATE INDEX "ThirdPartyLogistics_tenantId_idx" ON "ThirdPartyLogistics"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPartyLogistics_tenantId_code_key" ON "ThirdPartyLogistics"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ErpSystem_tenantId_idx" ON "ErpSystem"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSystem_tenantId_code_key" ON "ErpSystem"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CommodityMedia_commodityId_type_idx" ON "CommodityMedia"("commodityId", "type");

-- CreateIndex
CREATE INDEX "ProductChangeLog_tenantId_productId_createdAt_idx" ON "ProductChangeLog"("tenantId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalSkuMapping_tenantId_mappingStatus_idx" ON "ExternalSkuMapping"("tenantId", "mappingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSkuMapping_tenantId_sourceType_sourceId_externalSku_key" ON "ExternalSkuMapping"("tenantId", "sourceType", "sourceId", "externalSku");

-- CreateIndex
CREATE INDEX "DistilledPattern_tenantId_intentDomain_isActive_idx" ON "DistilledPattern"("tenantId", "intentDomain", "isActive");

-- CreateIndex
CREATE INDEX "DistilledPattern_tenantId_grade_idx" ON "DistilledPattern"("tenantId", "grade");

-- CreateIndex
CREATE INDEX "PatternApplication_tenantId_patternId_createdAt_idx" ON "PatternApplication"("tenantId", "patternId", "createdAt");

-- CreateIndex
CREATE INDEX "PatternApplication_patternId_outcome_idx" ON "PatternApplication"("patternId", "outcome");

-- CreateIndex
CREATE INDEX "KnowledgeLayerA_domain_isActive_idx" ON "KnowledgeLayerA"("domain", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeLayerA_domain_key_key" ON "KnowledgeLayerA"("domain", "key");

-- CreateIndex
CREATE INDEX "KnowledgeLayerB_industryCategory_metricKey_idx" ON "KnowledgeLayerB"("industryCategory", "metricKey");

-- CreateIndex
CREATE INDEX "KnowledgeLayerB_periodStart_periodEnd_idx" ON "KnowledgeLayerB"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeLayerB_industryCategory_metricKey_periodStart_key" ON "KnowledgeLayerB"("industryCategory", "metricKey", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "UserScope_userId_tenantId_idx" ON "UserScope"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScope_userId_tenantId_scopeType_scopeValue_key" ON "UserScope"("userId", "tenantId", "scopeType", "scopeValue");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_tenantId_idx" ON "RefreshToken"("tenantId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_tenantId_targetKey_createdAt_idx" ON "AgentExecutionLog"("tenantId", "targetKey", "createdAt");

-- CreateIndex
CREATE INDEX "Commodity_tenantId_marketId_idx" ON "Commodity"("tenantId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_productId_marketId_language_key" ON "Commodity"("productId", "marketId", "language");

-- CreateIndex
CREATE INDEX "Listing_tenantId_platformId_mappingStatus_idx" ON "Listing"("tenantId", "platformId", "mappingStatus");

-- CreateIndex
CREATE INDEX "Listing_commodityId_platformId_idx" ON "Listing"("commodityId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_platformId_externalListingId_key" ON "Listing"("platformId", "externalListingId");

-- CreateIndex
CREATE INDEX "Product_tenantId_brandId_categoryId_idx" ON "Product"("tenantId", "brandId", "categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_routingWarehouseId_fkey" FOREIGN KEY ("routingWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_platformFulfillmentModeId_fkey" FOREIGN KEY ("platformFulfillmentModeId") REFERENCES "PlatformFulfillmentMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_thirdPartyLogisticsId_fkey" FOREIGN KEY ("thirdPartyLogisticsId") REFERENCES "ThirdPartyLogistics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ExecutionReceipt_executionLogId_fkey" FOREIGN KEY ("executionLogId") REFERENCES "AgentExecutionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExperience" ADD CONSTRAINT "AgentExperience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketLanguage" ADD CONSTRAINT "MarketLanguage_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformFulfillmentMode" ADD CONSTRAINT "PlatformFulfillmentMode_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttributeSchema" ADD CONSTRAINT "CategoryAttributeSchema_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyLogistics" ADD CONSTRAINT "ThirdPartyLogistics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSystem" ADD CONSTRAINT "ErpSystem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityMedia" ADD CONSTRAINT "CommodityMedia_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChangeLog" ADD CONSTRAINT "ProductChangeLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSkuMapping" ADD CONSTRAINT "ExternalSkuMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSkuMapping" ADD CONSTRAINT "ExternalSkuMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistilledPattern" ADD CONSTRAINT "DistilledPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternApplication" ADD CONSTRAINT "PatternApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternApplication" ADD CONSTRAINT "PatternApplication_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "DistilledPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

