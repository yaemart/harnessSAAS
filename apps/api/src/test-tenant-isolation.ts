/**
 * 租户隔离本地验证脚本（修正版）
 * - adminPool (postgres 超级用户)：数据准备 / 清理
 * - appPool   (app_user 受限角色)：RLS 隔离断言
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { queryMemory } from './memory.js';

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';

// 超级用户：DDL / 数据准备 / 清理
const adminPool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/ai_ecom',
});

// 受限用户：RLS 断言（RLS 对此角色生效）
const appPool = new Pool({
  connectionString: 'postgresql://app_user:app_user_password@localhost:5432/ai_ecom',
});

let passed = 0;
let failed = 0;

function ok(name: string) {
  console.log(`  [PASS] ${name}`);
  passed++;
}
function fail(name: string, detail: string) {
  console.log(`  [FAIL] ${name}: ${detail}`);
  failed++;
}

// ─────────────────────────────────────────────
// 前置：确保测试租户存在（超级用户执行，绕过 RLS）
// ─────────────────────────────────────────────
async function ensureTenants() {
  const admin = await adminPool.connect();
  try {
    for (const [id, code, name] of [
      [TENANT_A_ID, 'tenant-a', 'Tenant A (Test)'],
      [TENANT_B_ID, 'tenant-b', 'Tenant B (Test)'],
    ]) {
      await admin.query(
        `INSERT INTO "Tenant"(id, code, name, "updatedAt") VALUES ($1, $2, $3, now()) ON CONFLICT DO NOTHING`,
        [id, code, name],
      );
    }
    console.log('  租户 A / B 已就绪');
  } finally {
    admin.release();
  }
}

// ─────────────────────────────────────────────
// 测试 0：确认 app_user 不是超级用户
// ─────────────────────────────────────────────
async function test_confirm_not_superuser() {
  console.log('\n[Test 0] 确认 app_user 不是超级用户');
  const client = await appPool.connect();
  try {
    const r = await client.query<{ current_user: string; is_super: boolean }>(
      `SELECT current_user,
              pg_catalog.pg_has_role(current_user, 'pg_read_all_data', 'member') AS is_super`,
    );
    const { current_user } = r.rows[0];
    const roleCheck = await adminPool.query<{ rolsuper: boolean }>(
      `SELECT rolsuper FROM pg_roles WHERE rolname = $1`,
      [current_user],
    );
    const isSuper = roleCheck.rows[0]?.rolsuper ?? true;
    if (!isSuper) {
      ok(`连接用户 "${current_user}" 不是超级用户，RLS 将生效`);
    } else {
      fail('角色确认', `当前用户 ${current_user} 是超级用户，RLS 不会生效`);
    }
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// 测试 1：RLS 读隔离 — 租户 A 看不到租户 B 的数据
// ─────────────────────────────────────────────
async function test_rls_brand_isolation() {
  console.log('\n[Test 1] RLS 读隔离 — 租户 A 看不到租户 B 的 Brand');
  const brandId = randomUUID();
  const admin = await adminPool.connect();
  try {
    // 超级用户直接插入 tenant B 的 Brand（绕过 RLS）
    await admin.query(
      `INSERT INTO "Brand"(id, "tenantId", name, code, "updatedAt")
       VALUES ($1, $2, 'B-TestBrand-RLS', 'B-RLS-TEST', now())
       ON CONFLICT DO NOTHING`,
      [brandId, TENANT_B_ID],
    );
  } finally {
    admin.release();
  }

  // app_user 以 tenant A 身份查询
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = '${TENANT_A_ID}'`);

    const result = await client.query(
      `SELECT COUNT(*) AS cnt FROM "Brand" WHERE code = 'B-RLS-TEST'`,
    );
    const cnt = parseInt(result.rows[0].cnt, 10);

    if (cnt === 0) {
      ok('租户 A 看不到租户 B 的 Brand（RLS 生效）');
    } else {
      fail('RLS 读隔离失效', `租户 A 查到了 ${cnt} 条租户 B 的数据`);
    }
    await client.query('COMMIT');
  } finally {
    client.release();
    // 清理
    const adm = await adminPool.connect();
    await adm.query(`DELETE FROM "Brand" WHERE id = $1`, [brandId]).catch(() => null);
    adm.release();
  }
}

// ─────────────────────────────────────────────
// 测试 2：RLS 写保护 — 租户 A 无法写入租户 B 的数据
// ─────────────────────────────────────────────
async function test_rls_write_protection() {
  console.log('\n[Test 2] RLS 写保护 — 租户 A 无法写入租户 B 的 Brand');
  const client = await appPool.connect();
  let blocked = false;
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = '${TENANT_A_ID}'`);

    try {
      await client.query(
        `INSERT INTO "Brand"(id, "tenantId", name, code, "updatedAt")
         VALUES ($1, $2, 'B-WriteTest', 'B-WRITE-TEST', now())`,
        [randomUUID(), TENANT_B_ID],
      );
    } catch {
      blocked = true;
    }

    if (blocked) {
      ok('RLS WITH CHECK 阻止了跨租户写入');
      await client.query('ROLLBACK');
    } else {
      await client.query('ROLLBACK');
      // 清理（超级用户）
      const adm = await adminPool.connect();
      await adm.query(`DELETE FROM "Brand" WHERE code = 'B-WRITE-TEST'`).catch(() => null);
      adm.release();
      fail('RLS 写保护失效', '租户 A 成功写入了租户 B 的数据');
    }
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// 测试 3：向量记忆应用层隔离
// ─────────────────────────────────────────────
async function test_memory_isolation() {
  console.log('\n[Test 3] 向量记忆应用层隔离');
  const expId = randomUUID();

  // 超级用户直接插入 tenant A 的记忆（需要 AgentExperience 表 RLS 绕过）
  const admin = await adminPool.connect();
  try {
    await admin.query(
      `INSERT INTO "AgentExperience"(
         id, "tenantId", "traceId", "intentType", "intentDomain",
         platform, market, "executionStatus",
         "observeSnapshot", "orientAnalysis", "decideRationale", "actIntent"
       ) VALUES ($1, $2, $3, 'PRICING', 'pricing', 'AMAZON', 'US', 'SUCCESS',
         '{}', '{}', '{}', '{}')`,
      [expId, TENANT_A_ID, `trace-isolation-${Date.now()}`],
    );
  } finally {
    admin.release();
  }

  try {
    // 以租户 B 身份查询，不应看到租户 A 的记录
    const results = await queryMemory({ tenantId: TENANT_B_ID, domain: 'pricing' });
    const leaked = results.find((r) => r.id === expId);
    if (!leaked) {
      ok('租户 B 查询不到租户 A 的 AgentExperience（应用层隔离生效）');
    } else {
      fail('向量记忆跨租户泄露', `租户 B 查到了 id=${expId}`);
    }
  } finally {
    const adm = await adminPool.connect();
    await adm.query(`DELETE FROM "AgentExperience" WHERE id = $1`, [expId]).catch(() => null);
    adm.release();
  }
}

// ─────────────────────────────────────────────
// 测试 4：同一租户内正常读写
// ─────────────────────────────────────────────
async function test_same_tenant_access() {
  console.log('\n[Test 4] 同租户内正常读写');
  const brandId = randomUUID();
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.tenant_id = '${TENANT_A_ID}'`);

    await client.query(
      `INSERT INTO "Brand"(id, "tenantId", name, code, "updatedAt")
       VALUES ($1, $2, 'A-SelfTest', 'A-SELF-TEST', now())`,
      [brandId, TENANT_A_ID],
    );

    const check = await client.query(
      `SELECT COUNT(*) AS cnt FROM "Brand" WHERE code = 'A-SELF-TEST'`,
    );
    const cnt = parseInt(check.rows[0].cnt, 10);

    if (cnt >= 1) {
      ok('租户 A 可正常读写自己的 Brand');
    } else {
      fail('同租户访问异常', `期望 >=1 条，实际 ${cnt} 条`);
    }

    await client.query(`DELETE FROM "Brand" WHERE id = $1`, [brandId]);
    await client.query('COMMIT');
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => null);
    const msg = e instanceof Error ? e.message : String(e);
    fail('同租户访问测试异常', msg);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────
async function main() {
  console.log('============================================');
  console.log('  租户隔离验证测试');
  console.log('  TENANT_A:', TENANT_A_ID);
  console.log('  TENANT_B:', TENANT_B_ID);
  console.log('============================================');

  await ensureTenants();

  await test_confirm_not_superuser();
  await test_rls_brand_isolation();
  await test_rls_write_protection();
  await test_memory_isolation();
  await test_same_tenant_access();

  console.log('\n============================================');
  console.log(`  结果: ${passed} 通过 / ${failed} 失败`);
  console.log('============================================\n');

  await adminPool.end();
  await appPool.end();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
