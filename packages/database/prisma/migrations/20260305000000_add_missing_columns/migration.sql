-- Add columns defined in schema.prisma but missing from previous migrations

-- Product: dataQualityScore, featureFrozen, featureFrozenReason, lastVerifiedAt
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dataQualityScore" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "featureFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "featureFrozenReason" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3);

-- ExternalIdMapping: mappingConfidencePassedAt
ALTER TABLE "ExternalIdMapping" ADD COLUMN IF NOT EXISTS "mappingConfidencePassedAt" TIMESTAMP(3);
