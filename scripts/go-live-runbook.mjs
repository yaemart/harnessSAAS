#!/usr/bin/env node
/**
 * go-live-runbook.mjs
 * 上线当日操作手册（Master Data & Identity Resolution Phase 1）
 *
 * 用法：
 *   node scripts/go-live-runbook.mjs [--step <step>] [--dry-run]
 *
 * 步骤编号：
 *   1  pre-flight   上线前检查（对账结果 + 测试通过）
 *   2  cut-read     切换读路径（MAPPING_READ_MODE=new）
 *   3  observe      观察期（2小时监控）
 *   4  cut-write    切换写路径（MAPPING_WRITE_MODE=new_only）
 *   5  finalize     收尾确认
 *   rollback        回滚（切回 legacy）
 */

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const stepArg = process.argv.indexOf('--step');
const STEP = stepArg !== -1 ? process.argv[stepArg + 1] : null;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function warn(msg) {
  console.warn(`[${new Date().toISOString()}] WARN: ${msg}`);
}

function fatal(msg) {
  console.error(`[${new Date().toISOString()}] FATAL: ${msg}`);
  process.exit(1);
}

// ─── Step 1: Pre-flight checks ────────────────────────────────────────
async function preFlight() {
  log('=== STEP 1: Pre-flight checks ===');

  if (!DATABASE_URL) fatal('DATABASE_URL is required');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1.1 双 APPROVED 冲突检查
    const p0 = await client.query(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT 1 FROM external_id_mapping
        WHERE status = 'APPROVED'
        GROUP BY tenant_id, entity_type, source_system, external_id, COALESCE(external_sub_id,'')
        HAVING COUNT(*) > 1
      ) sub
    `);
    const p0Count = parseInt(p0.rows[0].cnt, 10);
    if (p0Count > 0) fatal(`P0 BLOCKING: ${p0Count} double-APPROVED conflicts found. Fix before go-live.`);
    log(`[OK] P0 double-APPROVED conflicts: 0`);

    // 1.2 有效期已过期的 APPROVED
    const expired = await client.query(`
      SELECT COUNT(*) AS cnt FROM external_id_mapping
      WHERE status = 'APPROVED' AND effective_to IS NOT NULL AND effective_to < now()
    `);
    const expiredCount = parseInt(expired.rows[0].cnt, 10);
    if (expiredCount > 0) warn(`P1: ${expiredCount} APPROVED with expired effective_to — fix recommended`);
    else log(`[OK] No expired APPROVED mappings`);

    // 1.3 View 可查询验证
    await client.query('SELECT 1 FROM approved_entity_mapping LIMIT 1');
    log('[OK] View approved_entity_mapping is queryable');
    await client.query('SELECT 1 FROM approved_cost_version LIMIT 1');
    log('[OK] View approved_cost_version is queryable');

    // 1.4 ai_feature_reader 角色存在
    const roleRes = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'ai_feature_reader'`);
    if (roleRes.rowCount === 0) warn('ai_feature_reader role not created — run scripts/setup-ai-reader-role.sql');
    else log('[OK] ai_feature_reader role exists');

  } finally {
    await client.end();
  }

  log('=== Pre-flight: PASSED ===');
}

// ─── Step 2: Cut read path ─────────────────────────────────────────────
async function cutRead() {
  log('=== STEP 2: Cut read path to new (MAPPING_READ_MODE=new) ===');
  log('Action: Set env var MAPPING_READ_MODE=new and redeploy API service.');
  log('Verify: GET /api/mappings should return data from external_id_mapping table.');
  if (DRY_RUN) {
    log('[DRY-RUN] Skipping actual deployment trigger.');
    return;
  }
  log('Reminder: Deploy config change, then proceed to Step 3 (observe).');
}

// ─── Step 3: Observe 2 hours ───────────────────────────────────────────
async function observe() {
  log('=== STEP 3: Observe period (2 hours) ===');
  log('Checklist during observation:');
  log('  - Monitor error rate on /api/mappings/* endpoints');
  log('  - Verify AI feature queries return non-empty results');
  log('  - Check reconcile-cron produces P0=0 report');
  log('  - Check mapping_history count growing normally');
  log('  - Watch for INVALID_STATUS_TRANSITION errors spike');
  log('');
  log('Rollback trigger: Any P0 event → run: node scripts/go-live-runbook.mjs rollback');
}

// ─── Step 4: Cut write path ────────────────────────────────────────────
async function cutWrite() {
  log('=== STEP 4: Cut write path to new_only (MAPPING_WRITE_MODE=new_only) ===');
  log('Prerequisites before executing this step:');
  log('  - Step 3 observe period passed with no P0');
  log('  - reconcile-cron shows P0=0, P1=0 for 3 consecutive days');
  log('');
  log('Action: Set env var MAPPING_WRITE_MODE=new_only and redeploy API service.');
  log('Effect: Old Listing/SKU write paths will be frozen.');
  if (DRY_RUN) {
    log('[DRY-RUN] Skipping actual deployment trigger.');
  }
}

// ─── Step 5: Finalize ─────────────────────────────────────────────────
async function finalize() {
  log('=== STEP 5: Finalize ===');
  log('Post go-live tasks:');
  log('  [ ] Confirm all tenants migrated (reconcile-cron coverage = 100%)');
  log('  [ ] Archive old mapping columns (Listing.mappingStatus, ExternalSkuMapping.mappingStatus)');
  log('  [ ] Update monitoring dashboards to new table metrics');
  log('  [ ] Remove MAPPING_WRITE_MODE=legacy fallback code path (> D14+30)');
  log('  [ ] Document final state in architecture decision record (ADR)');
}

// ─── Rollback ─────────────────────────────────────────────────────────
async function rollback() {
  log('=== ROLLBACK: Reverting to legacy read/write paths ===');
  log('URGENT: Execute within 30 minutes of P0 detection.');
  log('');
  log('Steps:');
  log('  1. Set MAPPING_READ_MODE=legacy  → redeploy API');
  log('  2. Set MAPPING_WRITE_MODE=dual   → redeploy API (or legacy if new_only not yet applied)');
  log('  3. Set AI_MAPPING_SOURCE=legacy  → redeploy AI services (only if view-path was cut)');
  log('  4. Verify: GET /api/mappings returns data (no errors)');
  log('  5. Run reconcile-cron to confirm P0 resolved');
  log('  6. File incident report and schedule fix window');
  log('');
  log('IMPORTANT: Do NOT delete data from external_id_mapping. Keep for audit.');
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  const steps = {
    '1': preFlight,
    'pre-flight': preFlight,
    '2': cutRead,
    'cut-read': cutRead,
    '3': observe,
    'observe': observe,
    '4': cutWrite,
    'cut-write': cutWrite,
    '5': finalize,
    'finalize': finalize,
    'rollback': rollback,
  };

  if (!STEP) {
    log('=== Go-Live Runbook: Full sequence ===');
    if (DRY_RUN) log('[DRY-RUN mode enabled]');
    for (const fn of [preFlight, cutRead, observe, cutWrite, finalize]) {
      await fn();
      log('');
    }
    return;
  }

  const fn = steps[STEP];
  if (!fn) fatal(`Unknown step: ${STEP}. Valid steps: ${Object.keys(steps).join(', ')}`);
  if (DRY_RUN) log('[DRY-RUN mode enabled]');
  await fn();
}

main().catch((err) => {
  fatal(err.message ?? String(err));
});
