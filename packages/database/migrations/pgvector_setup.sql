-- pgvector extension and embedding column for semantic memory
-- Run after pgvector is installed on the PostgreSQL server

CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to AgentExperience
-- Using 384 dimensions (MiniLM-L6-v2) for memory efficiency
ALTER TABLE "AgentExperience"
  ADD COLUMN IF NOT EXISTS "contextEmbedding" vector(384);

-- HNSW index for approximate nearest neighbor search
-- m=16, ef_construction=64 balances speed and recall
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experience_embedding_hnsw
  ON "AgentExperience"
  USING hnsw ("contextEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index for filtered semantic search
-- Filter by tenant + domain first, then vector search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_experience_tenant_domain_created
  ON "AgentExperience" ("tenantId", "intentDomain", "createdAt" DESC);
