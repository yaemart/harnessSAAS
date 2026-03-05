-- Master Data & Identity Resolution Phase 1
-- Core objects: ExternalIdMapping, MappingHistory, CostVersion
-- AI isolation views: approved_entity_mapping, approved_cost_version

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MappingStatus') THEN
    CREATE TYPE "MappingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'SOFT_REVOKED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntityType') THEN
    CREATE TYPE "EntityType" AS ENUM ('PRODUCT', 'LISTING', 'SUPPLIER', 'WAREHOUSE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ExternalIdMapping" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "globalId" UUID NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalSubId" TEXT,
  "status" "MappingStatus" NOT NULL DEFAULT 'PENDING',
  "confidenceScore" DECIMAL(5,4),
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL DEFAULT 'system',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT,
  "candidatePayload" JSONB,
  "rawPayload" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExternalIdMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalIdMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExternalIdMapping_effective_window_chk" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE IF NOT EXISTS "MappingHistory" (
  "id" UUID NOT NULL,
  "mappingId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "oldStatus" "MappingStatus",
  "newStatus" "MappingStatus",
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MappingHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MappingHistory_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "ExternalIdMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MappingHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CostVersion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "productGlobalId" UUID NOT NULL,
  "purchaseCost" DECIMAL(14,2),
  "shippingCost" DECIMAL(14,2),
  "fbaFee" DECIMAL(14,2),
  "otherCost" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "sourceSystem" TEXT,
  "sourceRef" TEXT,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CostVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CostVersion_productGlobalId_fkey" FOREIGN KEY ("productGlobalId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CostVersion_effective_window_chk" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE INDEX IF NOT EXISTS "ExternalIdMapping_tenantId_status_createdAt_idx"
  ON "ExternalIdMapping"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalIdMapping_tenantId_sourceSystem_entityType_status_createdAt_idx"
  ON "ExternalIdMapping"("tenantId", "sourceSystem", "entityType", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ExternalIdMapping_tenantId_entityType_globalId_status_idx"
  ON "ExternalIdMapping"("tenantId", "entityType", "globalId", "status");

CREATE INDEX IF NOT EXISTS "ExternalIdMapping_tenantId_effectiveFrom_effectiveTo_idx"
  ON "ExternalIdMapping"("tenantId", "effectiveFrom", "effectiveTo");

CREATE INDEX IF NOT EXISTS "MappingHistory_tenantId_createdAt_idx"
  ON "MappingHistory"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "MappingHistory_mappingId_createdAt_idx"
  ON "MappingHistory"("mappingId", "createdAt");

CREATE INDEX IF NOT EXISTS "CostVersion_tenantId_productGlobalId_effectiveFrom_idx"
  ON "CostVersion"("tenantId", "productGlobalId", "effectiveFrom");

-- Only one active APPROVED mapping per external key
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalIdMapping_approved_unique_idx"
  ON "ExternalIdMapping"(
    "tenantId", "entityType", "sourceSystem", "externalId", COALESCE("externalSubId", '')
  )
  WHERE "status" = 'APPROVED';

-- AI must only read approved + effective mappings
CREATE OR REPLACE VIEW "approved_entity_mapping" AS
SELECT
  "id",
  "tenantId",
  "entityType",
  "globalId",
  "sourceSystem",
  "externalId",
  "externalSubId",
  "confidenceScore",
  "effectiveFrom",
  "effectiveTo",
  "approvedBy",
  "approvedAt",
  "updatedAt"
FROM "ExternalIdMapping"
WHERE "status" = 'APPROVED'
  AND now() >= "effectiveFrom"
  AND ("effectiveTo" IS NULL OR now() < "effectiveTo");

-- Profit/feature computation should read active effective cost rows only
CREATE OR REPLACE VIEW "approved_cost_version" AS
SELECT
  "id",
  "tenantId",
  "productGlobalId",
  "purchaseCost",
  "shippingCost",
  "fbaFee",
  "otherCost",
  "currency",
  "effectiveFrom",
  "effectiveTo",
  "updatedAt"
FROM "CostVersion"
WHERE "status" = 'ACTIVE'
  AND now() >= "effectiveFrom"
  AND ("effectiveTo" IS NULL OR now() < "effectiveTo");
