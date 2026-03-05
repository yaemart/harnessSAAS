const required = ['DATABASE_URL'] as const;

type RequiredKey = (typeof required)[number];

function getEnv(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

const PRODUCTION_REQUIRED_SECRETS = [
  'RUN_INTENT_SIGNING_SECRET',
  'DECISION_TOKEN_SECRET',
  'S2S_SIGNING_SECRET',
  'PORTAL_JWT_SECRET',
  'EXCHANGE_RATE_ENCRYPTION_KEY',
] as const;

if (process.env.NODE_ENV === 'production') {
  for (const key of PRODUCTION_REQUIRED_SECRETS) {
    if (!process.env[key]) {
      throw new Error(`Missing required secret in production: ${key}`);
    }
  }
}

const erKey = process.env.EXCHANGE_RATE_ENCRYPTION_KEY;
if (erKey !== undefined && erKey !== '') {
  if (!/^[0-9a-fA-F]{64}$/.test(erKey)) {
    throw new Error(
      'EXCHANGE_RATE_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: getEnv('DATABASE_URL'),
  DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL ?? getEnv('DATABASE_URL'),
  APPROVAL_SSE_CHANNEL: process.env.APPROVAL_SSE_CHANNEL ?? 'approvals',
  AMAZON_ADS_MODE: process.env.AMAZON_ADS_MODE ?? 'mock',
  ADS_AGENT_RUNTIME: process.env.ADS_AGENT_RUNTIME ?? 'node',
  AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL ?? 'http://localhost:8001',
  APPROVAL_FRESHNESS_TTL_MINUTES: Number(process.env.APPROVAL_FRESHNESS_TTL_MINUTES ?? 30),
  RUN_INTENT_SIGNING_SECRET: process.env.RUN_INTENT_SIGNING_SECRET ?? 'dev-intent-signing-secret-change-me',
  RUN_INTENT_MAX_SKEW_SECONDS: Number(process.env.RUN_INTENT_MAX_SKEW_SECONDS ?? 300),
  TRUSTED_INTENT_ORIGIN: process.env.TRUSTED_INTENT_ORIGIN ?? 'policy-engine',
  DECISION_TOKEN_SECRET: process.env.DECISION_TOKEN_SECRET ?? 'dev-decision-token-secret-change-me',
  DECISION_TOKEN_TTL_SECONDS: Number(process.env.DECISION_TOKEN_TTL_SECONDS ?? 300),
  NONCE_RETENTION_HOURS: Number(process.env.NONCE_RETENTION_HOURS ?? 24),
  NONCE_CLEANUP_INTERVAL_SECONDS: Number(process.env.NONCE_CLEANUP_INTERVAL_SECONDS ?? 600),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  AUTH_MODE: (process.env.AUTH_MODE ?? 'passthrough') as 'full' | 'passthrough' | 'disabled',
  S2S_SIGNING_SECRET: process.env.S2S_SIGNING_SECRET ?? 'dev-s2s-secret-change-me',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
  DB_POOL_MAX: Number(process.env.DB_POOL_MAX ?? 30),
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me-in-production',
  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ?? '',
  JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY ?? '',
  PORTAL_JWT_SECRET: process.env.PORTAL_JWT_SECRET ?? 'dev-portal-jwt-secret-change-me',
  // 双写迁移开关（第3份交付物 §8 回滚预案）
  // legacy   = 只写旧路径（旧 Listing/SKU 表）
  // dual     = 双写（旧路径 + external_id_mapping），默认
  // new_only = 仅写 external_id_mapping，旧路径禁止写入
  MAPPING_WRITE_MODE: (process.env.MAPPING_WRITE_MODE ?? 'dual') as 'legacy' | 'dual' | 'new_only',
  // legacy  = 从旧 Listing/SKU 字段读取
  // hybrid  = 新表优先，降级读旧
  // new     = 全量读 external_id_mapping / View
  MAPPING_READ_MODE: (process.env.MAPPING_READ_MODE ?? 'legacy') as 'legacy' | 'hybrid' | 'new',
  // AI 仓储层数据源（强隔离开关）
  // view_only = 只读 approved_entity_mapping / approved_cost_version
  // legacy    = 读旧字段（过渡期兼容，上线后禁止）
  AI_MAPPING_SOURCE: (process.env.AI_MAPPING_SOURCE ?? 'view_only') as 'view_only' | 'legacy',
  EXCHANGE_RATE_CRON_ENABLED: (process.env.EXCHANGE_RATE_CRON_ENABLED ?? 'true') === 'true',
};
