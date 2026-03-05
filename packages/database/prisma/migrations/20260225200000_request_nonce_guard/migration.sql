-- Request nonce guard for /run anti-replay
CREATE TABLE "RequestNonce" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "nonce" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequestNonce_tenantId_nonce_key" ON "RequestNonce"("tenantId", "nonce");
CREATE INDEX "RequestNonce_tenantId_createdAt_idx" ON "RequestNonce"("tenantId", "createdAt");

ALTER TABLE "RequestNonce"
  ADD CONSTRAINT "RequestNonce_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
