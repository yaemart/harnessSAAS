-- Security audit events for replay/signature governance
CREATE TABLE "SecurityAuditEvent" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityAuditEvent_tenantId_eventType_createdAt_idx"
  ON "SecurityAuditEvent"("tenantId", "eventType", "createdAt");
CREATE INDEX "SecurityAuditEvent_tenantId_createdAt_idx"
  ON "SecurityAuditEvent"("tenantId", "createdAt");

ALTER TABLE "SecurityAuditEvent"
  ADD CONSTRAINT "SecurityAuditEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
