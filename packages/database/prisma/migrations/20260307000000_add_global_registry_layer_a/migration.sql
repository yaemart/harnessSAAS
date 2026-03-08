-- Layer A: Global Registry (System Admin Managed)

-- GlobalMarket
CREATE TABLE "GlobalMarket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "flag" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT 'other',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalMarket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalMarket_code_key" ON "GlobalMarket"("code");

-- GlobalPlatform
CREATE TABLE "GlobalPlatform" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT NOT NULL DEFAULT '',
    "badge" TEXT,
    "badgeColor" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "supportedMarketCodes" TEXT[],
    "enabledMarketCodes" TEXT[],
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalPlatform_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalPlatform_code_key" ON "GlobalPlatform"("code");

-- GlobalCategory
CREATE TABLE "GlobalCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "icon" TEXT NOT NULL DEFAULT '',
    "marketScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalCategory_code_key" ON "GlobalCategory"("code");
CREATE INDEX "GlobalCategory_parentId_idx" ON "GlobalCategory"("parentId");
CREATE INDEX "GlobalCategory_level_idx" ON "GlobalCategory"("level");
ALTER TABLE "GlobalCategory" ADD CONSTRAINT "GlobalCategory_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "GlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GlobalWarehouse
CREATE TABLE "GlobalWarehouse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '3PL',
    "region" TEXT NOT NULL DEFAULT 'us',
    "country" TEXT NOT NULL DEFAULT 'US',
    "nodes" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalWarehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalWarehouse_code_key" ON "GlobalWarehouse"("code");

-- GlobalErpSystem
CREATE TABLE "GlobalErpSystem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalErpSystem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalErpSystem_code_key" ON "GlobalErpSystem"("code");

-- GlobalTool
CREATE TABLE "GlobalTool" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalTool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalTool_code_key" ON "GlobalTool"("code");

-- Add globalXxxCode columns to existing tenant MDM models
ALTER TABLE "Market" ADD COLUMN "globalMarketCode" TEXT;
ALTER TABLE "Platform" ADD COLUMN "globalPlatformCode" TEXT;
ALTER TABLE "Category" ADD COLUMN "globalCategoryCode" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "globalWarehouseCode" TEXT;
ALTER TABLE "ErpSystem" ADD COLUMN "globalErpCode" TEXT;
