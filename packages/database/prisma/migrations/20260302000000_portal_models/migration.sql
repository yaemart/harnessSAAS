-- Portal: Brand Support Portal Models

-- BrandPortalConfig
CREATE TABLE "BrandPortalConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "customDomain" TEXT,
    "themeId" TEXT NOT NULL DEFAULT 'editorial',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "primaryColor" TEXT,
    "welcomeMessage" TEXT,
    "supportEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandPortalConfig_pkey" PRIMARY KEY ("id")
);

-- PortalConsumer
CREATE TABLE "PortalConsumer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalConsumer_pkey" PRIMARY KEY ("id")
);

-- WarrantyRegistration
CREATE TABLE "WarrantyRegistration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "consumerId" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "purchaseChannel" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyRegistration_pkey" PRIMARY KEY ("id")
);

-- SupportCase
CREATE TABLE "SupportCase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "consumerId" UUID,
    "commodityId" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'portal',
    "issueType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "agentConfidence" DOUBLE PRECISION,
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "knowledgeWriteback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CaseMessage
CREATE TABLE "CaseMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseMessage_pkey" PRIMARY KEY ("id")
);

-- MediaAnalysis
CREATE TABLE "MediaAnalysis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "keyFrameUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "originalFileRef" TEXT,
    "originalDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAnalysis_pkey" PRIMARY KEY ("id")
);

-- ConsumerFAQ
CREATE TABLE "ConsumerFAQ" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "commodityId" UUID,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumerFAQ_pkey" PRIMARY KEY ("id")
);

-- ProductFeedback
CREATE TABLE "ProductFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "consumerId" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'nice_to_have',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "agentSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- QRScanEvent
CREATE TABLE "QRScanEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipCountry" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRScanEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "BrandPortalConfig_brandId_key" ON "BrandPortalConfig"("brandId");
CREATE UNIQUE INDEX "BrandPortalConfig_customDomain_key" ON "BrandPortalConfig"("customDomain");
CREATE UNIQUE INDEX "PortalConsumer_tenantId_brandId_email_key" ON "PortalConsumer"("tenantId", "brandId", "email");
CREATE UNIQUE INDEX "WarrantyRegistration_tenantId_serialNumber_key" ON "WarrantyRegistration"("tenantId", "serialNumber");

-- Indexes
CREATE INDEX "BrandPortalConfig_tenantId_idx" ON "BrandPortalConfig"("tenantId");
CREATE INDEX "PortalConsumer_tenantId_brandId_idx" ON "PortalConsumer"("tenantId", "brandId");
CREATE INDEX "WarrantyRegistration_tenantId_consumerId_idx" ON "WarrantyRegistration"("tenantId", "consumerId");
CREATE INDEX "WarrantyRegistration_commodityId_idx" ON "WarrantyRegistration"("commodityId");
CREATE INDEX "SupportCase_tenantId_status_idx" ON "SupportCase"("tenantId", "status");
CREATE INDEX "SupportCase_tenantId_consumerId_idx" ON "SupportCase"("tenantId", "consumerId");
CREATE INDEX "SupportCase_commodityId_idx" ON "SupportCase"("commodityId");
CREATE INDEX "CaseMessage_caseId_createdAt_idx" ON "CaseMessage"("caseId", "createdAt");
CREATE INDEX "CaseMessage_tenantId_idx" ON "CaseMessage"("tenantId");
CREATE INDEX "MediaAnalysis_caseId_idx" ON "MediaAnalysis"("caseId");
CREATE INDEX "MediaAnalysis_tenantId_idx" ON "MediaAnalysis"("tenantId");
CREATE INDEX "ConsumerFAQ_tenantId_brandId_commodityId_idx" ON "ConsumerFAQ"("tenantId", "brandId", "commodityId");
CREATE INDEX "ProductFeedback_tenantId_commodityId_feedbackType_idx" ON "ProductFeedback"("tenantId", "commodityId", "feedbackType");
CREATE INDEX "QRScanEvent_tenantId_commodityId_source_idx" ON "QRScanEvent"("tenantId", "commodityId", "source");
CREATE INDEX "QRScanEvent_scannedAt_idx" ON "QRScanEvent"("scannedAt");

-- Foreign keys
ALTER TABLE "BrandPortalConfig" ADD CONSTRAINT "BrandPortalConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BrandPortalConfig" ADD CONSTRAINT "BrandPortalConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortalConsumer" ADD CONSTRAINT "PortalConsumer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalConsumer" ADD CONSTRAINT "PortalConsumer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "PortalConsumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "PortalConsumer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseMessage" ADD CONSTRAINT "CaseMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseMessage" ADD CONSTRAINT "CaseMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAnalysis" ADD CONSTRAINT "MediaAnalysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAnalysis" ADD CONSTRAINT "MediaAnalysis_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsumerFAQ" ADD CONSTRAINT "ConsumerFAQ_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsumerFAQ" ADD CONSTRAINT "ConsumerFAQ_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsumerFAQ" ADD CONSTRAINT "ConsumerFAQ_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "PortalConsumer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QRScanEvent" ADD CONSTRAINT "QRScanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QRScanEvent" ADD CONSTRAINT "QRScanEvent_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
