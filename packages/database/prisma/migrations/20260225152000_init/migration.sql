-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "market" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bulletPoints" JSONB,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "externalListingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fulfillment" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fulfillment" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(14,2) NOT NULL,
    "sales" DECIMAL(14,2) NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "normalizedRoas" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecutionLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "reasoningChain" JSONB NOT NULL,
    "policySnapshotId" UUID,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalQueue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "riskScore" DECIMAL(5,4) NOT NULL,
    "reason" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "brandId" UUID,
    "productId" UUID,
    "policyKey" TEXT NOT NULL,
    "policyValue" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySnapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Brand_tenantId_idx" ON "Brand"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantId_code_key" ON "Brand"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Product_tenantId_brandId_category_idx" ON "Product"("tenantId", "brandId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Commodity_tenantId_market_idx" ON "Commodity"("tenantId", "market");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_productId_market_language_key" ON "Commodity"("productId", "market", "language");

-- CreateIndex
CREATE INDEX "Listing_tenantId_platform_fulfillment_idx" ON "Listing"("tenantId", "platform", "fulfillment");

-- CreateIndex
CREATE INDEX "Listing_commodityId_platform_idx" ON "Listing"("commodityId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_platform_externalListingId_key" ON "Listing"("platform", "externalListingId");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_tenantId_platform_market_brand_category_idx" ON "PerformanceSnapshot"("tenantId", "platform", "market", "brand", "category", "fulfillment", "snapshotDate");

-- CreateIndex
CREATE INDEX "PerformanceSnapshot_tenantId_snapshotDate_idx" ON "PerformanceSnapshot"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceSnapshot_listingId_snapshotDate_key" ON "PerformanceSnapshot"("listingId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "AgentExecutionLog_intentId_key" ON "AgentExecutionLog"("intentId");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_tenantId_createdAt_idx" ON "AgentExecutionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalQueue_intentId_key" ON "ApprovalQueue"("intentId");

-- CreateIndex
CREATE INDEX "ApprovalQueue_tenantId_status_createdAt_idx" ON "ApprovalQueue"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyConfig_tenantId_brandId_productId_policyKey_idx" ON "PolicyConfig"("tenantId", "brandId", "productId", "policyKey");

-- CreateIndex
CREATE INDEX "PolicySnapshot_tenantId_createdAt_idx" ON "PolicySnapshot"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_policySnapshotId_fkey" FOREIGN KEY ("policySnapshotId") REFERENCES "PolicySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalQueue" ADD CONSTRAINT "ApprovalQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyConfig" ADD CONSTRAINT "PolicyConfig_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicySnapshot" ADD CONSTRAINT "PolicySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

