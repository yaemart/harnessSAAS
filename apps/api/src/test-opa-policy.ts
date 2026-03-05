/**
 * OPA 策略验证脚本
 * 验证 plan 配额边界 + PolicyConfig 自定义覆盖优先级
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { evaluatePolicy, PLAN_QUOTAS } from './opa-policy.js';
import { checkRateLimit, invalidateTenantCache } from './rate-limiter.js';

const TENANT_ENTERPRISE = '11111111-1111-1111-1111-111111111111';
const TENANT_PRO        = '22222222-2222-2222-2222-222222222222';
const TENANT_STARTER    = '33333333-3333-3333-3333-333333333333';

const adminPool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom',
});

let passed = 0;
let failed = 0;

function ok(name: string) { console.log(`  [PASS] ${name}`); passed++; }
function fail(name: string, detail: string) { console.log(`  [FAIL] ${name}: ${detail}`); failed++; }

// ─────────────────────────────────────────────
// Test 1: starter plan — boundary conditions (pure policy engine)
// ─────────────────────────────────────────────
function test_starter_boundary() {
  console.log('\n[Test 1] starter plan 边界 (evaluatePolicy 纯逻辑)');

  const limit = PLAN_QUOTAS.starter.ai_op;

  const allow = evaluatePolicy({ tenantId: 'x', plan: 'starter', action: 'ai_op', currentCount: limit - 1 });
  const deny  = evaluatePolicy({ tenantId: 'x', plan: 'starter', action: 'ai_op', currentCount: limit });

  if (allow.allow) ok(`currentCount=${limit - 1} → allow`);
  else fail('starter allow', `expected allow at ${limit - 1}, got deny`);

  if (!deny.allow) ok(`currentCount=${limit} → deny (${deny.reason})`);
  else fail('starter deny', `expected deny at ${limit}, got allow`);
}

// ─────────────────────────────────────────────
// Test 2: pro plan boundary
// ─────────────────────────────────────────────
function test_pro_boundary() {
  console.log('\n[Test 2] pro plan 边界');

  const limit = PLAN_QUOTAS.pro.ai_op;
  const deny = evaluatePolicy({ tenantId: 'x', plan: 'pro', action: 'ai_op', currentCount: limit });

  if (!deny.allow) ok(`pro: currentCount=${limit} → deny`);
  else fail('pro deny', `expected deny at ${limit}`);
}

// ─────────────────────────────────────────────
// Test 3: enterprise — effectively unlimited
// ─────────────────────────────────────────────
function test_enterprise_unlimited() {
  console.log('\n[Test 3] enterprise plan 无上限');

  const allow = evaluatePolicy({ tenantId: 'x', plan: 'enterprise', action: 'ai_op', currentCount: 999_998 });

  if (allow.allow) ok(`enterprise: currentCount=999998 → allow`);
  else fail('enterprise unlimited', `expected allow, got deny: ${allow.reason}`);
}

// ─────────────────────────────────────────────
// Test 4: PolicyConfig override > plan default
// ─────────────────────────────────────────────
async function test_policy_config_override() {
  console.log('\n[Test 4] PolicyConfig 自定义覆盖优先级');

  const customLimit = 200;
  let policyId: string | null = null;

  try {
    // Insert a custom PolicyConfig override for TENANT_STARTER
    policyId = randomUUID();
    await adminPool.query(
      `INSERT INTO "PolicyConfig"(id, "tenantId", "policyKey", "policyValue", "effectiveFrom", "updatedAt")
       VALUES ($1, $2, 'maxDailyOps', $3::jsonb, now() - interval '1 minute', now())`,
      [policyId, TENANT_STARTER, JSON.stringify({ value: customLimit })],
    );

    // Invalidate cache so rate-limiter picks up the new config
    invalidateTenantCache(TENANT_STARTER);

    // evaluatePolicy with customLimit should use 200 not 100
    const allow = evaluatePolicy({
      tenantId: TENANT_STARTER,
      plan: 'starter',
      action: 'ai_op',
      currentCount: 150,
      customLimit,
    });
    const deny = evaluatePolicy({
      tenantId: TENANT_STARTER,
      plan: 'starter',
      action: 'ai_op',
      currentCount: 200,
      customLimit,
    });

    if (allow.allow && allow.limit === customLimit) ok(`customLimit=200: count=150 → allow (limit=${allow.limit})`);
    else fail('override allow', `expected allow with limit=200, got: allow=${allow.allow} limit=${allow.limit}`);

    if (!deny.allow && deny.limit === customLimit) ok(`customLimit=200: count=200 → deny`);
    else fail('override deny', `expected deny with limit=200`);

  } finally {
    if (policyId) {
      await adminPool.query(`DELETE FROM "PolicyConfig" WHERE id = $1`, [policyId]).catch(() => null);
      invalidateTenantCache(TENANT_STARTER);
    }
  }
}

// ─────────────────────────────────────────────
// Test 5: checkRateLimit reads plan from DB
// ─────────────────────────────────────────────
async function test_rate_limiter_reads_plan() {
  console.log('\n[Test 5] checkRateLimit 从 DB 读取 plan 并返回正确 maxOps');

  invalidateTenantCache(TENANT_STARTER);
  invalidateTenantCache(TENANT_PRO);
  invalidateTenantCache(TENANT_ENTERPRISE);

  const [rStarter, rPro, rEnterprise] = await Promise.all([
    checkRateLimit(TENANT_STARTER),
    checkRateLimit(TENANT_PRO),
    checkRateLimit(TENANT_ENTERPRISE),
  ]);

  if (rStarter.maxOps === PLAN_QUOTAS.starter.ai_op && rStarter.plan === 'starter')
    ok(`starter → maxOps=${rStarter.maxOps}`);
  else fail('starter maxOps', `got maxOps=${rStarter.maxOps} plan=${rStarter.plan}`);

  if (rPro.maxOps === PLAN_QUOTAS.pro.ai_op && rPro.plan === 'pro')
    ok(`pro → maxOps=${rPro.maxOps}`);
  else fail('pro maxOps', `got maxOps=${rPro.maxOps} plan=${rPro.plan}`);

  if (rEnterprise.maxOps === PLAN_QUOTAS.enterprise.ai_op && rEnterprise.plan === 'enterprise')
    ok(`enterprise → maxOps=${rEnterprise.maxOps}`);
  else fail('enterprise maxOps', `got maxOps=${rEnterprise.maxOps} plan=${rEnterprise.plan}`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('============================================');
  console.log('  OPA 策略验证测试');
  console.log('============================================');

  test_starter_boundary();
  test_pro_boundary();
  test_enterprise_unlimited();
  await test_policy_config_override();
  await test_rate_limiter_reads_plan();

  console.log('\n============================================');
  console.log(`  结果: ${passed} 通过 / ${failed} 失败`);
  console.log('============================================\n');

  await adminPool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
