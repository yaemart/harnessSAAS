-- GIN index for causal-chain queries on ConfidenceLedger.knowledgeUsed (has: knowledgeId)
CREATE INDEX IF NOT EXISTS "ConfidenceLedger_knowledgeUsed_gin" ON "ConfidenceLedger" USING gin ("knowledgeUsed");

-- KnowledgeEntry: index for detectDrift groupBy by tenantId, status, createdAt
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_tenantId_status_createdAt_idx" ON "KnowledgeEntry"("tenantId", "status", "createdAt");

-- FeedbackSignal: unique for FAQ feedback dedup (TOCTOU-safe; intentId NULLs allowed multiple)
CREATE UNIQUE INDEX IF NOT EXISTS "FeedbackSignal_tenantId_sourceRole_agentAction_intentId_key" ON "FeedbackSignal"("tenantId", "sourceRole", "agentAction", "intentId");
