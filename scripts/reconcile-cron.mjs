#!/usr/bin/env node
/**
 * reconcile-cron.mjs
 * 每日对账任务入口（双写期使用）
 *
 * 用法：
 *   node scripts/reconcile-cron.mjs
 *   DATABASE_URL=... node scripts/reconcile-cron.mjs
 *
 * 建议：通过系统 cron 或 CI 定时任务每天执行（UTC 00:30）
 *   30 0 * * * /usr/bin/node /app/scripts/reconcile-cron.mjs >> /var/log/reconcile.log 2>&1
 */

import { Client } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
const SLACK_WEBHOOK_URL = process.env.RECONCILE_SLACK_WEBHOOK;
const PAGERDUTY_KEY = process.env.RECONCILE_PAGERDUTY_KEY;

if (!DATABASE_URL) {
  console.error('[reconcile] ERROR: DATABASE_URL is required');
  process.exit(1);
}

async function sendAlert(level, message, details = {}) {
  if (SLACK_WEBHOOK_URL) {
    const emoji = level === 'P0' ? ':rotating_light:' : ':warning:';
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *[MDM Reconcile ${level}]* ${message}`,
        attachments: [{ text: JSON.stringify(details, null, 2) }],
      }),
    }).catch((e) => console.error('[reconcile] Slack alert failed:', e.message));
  }

  if (PAGERDUTY_KEY && level === 'P0') {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: PAGERDUTY_KEY,
        event_action: 'trigger',
        payload: {
          summary: `MDM P0: ${message}`,
          severity: 'critical',
          source: 'reconcile-cron',
          custom_details: details,
        },
      }),
    }).catch((e) => console.error('[reconcile] PagerDuty alert failed:', e.message));
  }
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const date = new Date().toISOString().slice(0, 10);
  console.log(`[reconcile] Starting daily reconciliation for ${date}`);

  const report = {
    date,
    p0_double_approved: 0,
    p0_samples: [],
    p1_expired_approved: 0,
    p2_cost_overlap: 0,
    p2_history_missing: 0,
    status_distribution: [],
    go_no_go: 'GO',
  };

  try {
    // ─── P0: 双 APPROVED 冲突 ────────────────────────────────
    const p0Res = await client.query(`
      SELECT tenant_id, entity_type, source_system, external_id,
             COALESCE(external_sub_id,'') AS sub_id, COUNT(*) AS cnt
      FROM external_id_mapping
      WHERE status = 'APPROVED'
      GROUP BY tenant_id, entity_type, source_system, external_id, COALESCE(external_sub_id,'')
      HAVING COUNT(*) > 1
      LIMIT 20
    `);
    report.p0_double_approved = p0Res.rowCount ?? 0;
    report.p0_samples = p0Res.rows;
    if (report.p0_double_approved > 0) {
      report.go_no_go = 'NO-GO';
      await sendAlert('P0', `${report.p0_double_approved} double-APPROVED conflicts detected`, {
        date: report.date,
        samples: report.p0_samples,
      });
    }

    // ─── Status 分布总览 ─────────────────────────────────────
    const distRes = await client.query(`
      SELECT tenant_id, status, entity_type, COUNT(*) AS cnt
      FROM external_id_mapping
      GROUP BY tenant_id, status, entity_type
      ORDER BY tenant_id, status
    `);
    report.status_distribution = distRes.rows;

    // ─── P1: 有效期已过期的 APPROVED ─────────────────────────
    const expRes = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM external_id_mapping
      WHERE status = 'APPROVED'
        AND effective_to IS NOT NULL
        AND effective_to < now()
    `);
    report.p1_expired_approved = parseInt(expRes.rows[0].cnt, 10);
    if (report.p1_expired_approved > 0) {
      if (report.go_no_go === 'GO') report.go_no_go = 'WARN';
      await sendAlert('P1', `${report.p1_expired_approved} APPROVED records with expired effective_to`, {
        date: report.date,
      });
    }

    // ─── P2: cost_version 有效期重叠 ─────────────────────────
    const costOverlapRes = await client.query(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT a.id FROM cost_version a
        JOIN cost_version b
          ON a.tenant_id = b.tenant_id
         AND a.product_global_id = b.product_global_id
         AND a.id < b.id
         AND a.status = 'ACTIVE' AND b.status = 'ACTIVE'
         AND tstzrange(a.effective_from, COALESCE(a.effective_to,'infinity'), '[)')
         && tstzrange(b.effective_from, COALESCE(b.effective_to,'infinity'), '[)')
      ) sub
    `);
    report.p2_cost_overlap = parseInt(costOverlapRes.rows[0].cnt, 10);
    if (report.p2_cost_overlap > 0) {
      await sendAlert('P2', `${report.p2_cost_overlap} cost_version active-period overlaps detected`, {
        date: report.date,
      });
    }

    // ─── P2: history 缺失 ─────────────────────────────────────
    const histMissingRes = await client.query(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT m.id FROM external_id_mapping m
        LEFT JOIN mapping_history h ON h.mapping_id = m.id
        WHERE m.status IN ('APPROVED','REJECTED','REVOKED','SOFT_REVOKED')
        GROUP BY m.id HAVING COUNT(h.id) = 0
      ) sub
    `);
    report.p2_history_missing = parseInt(histMissingRes.rows[0].cnt, 10);
    if (report.p2_history_missing > 0) {
      await sendAlert('P2', `${report.p2_history_missing} mappings with missing audit history`, {
        date: report.date,
      });
    }

  } finally {
    await client.end();
  }

  // ─── 输出日报 ─────────────────────────────────────────────
  console.log('='.repeat(60));
  console.log(`[reconcile] Date:               ${report.date}`);
  console.log(`[reconcile] Go/No-Go:           ${report.go_no_go}`);
  console.log(`[reconcile] P0 双APPROVED冲突:  ${report.p0_double_approved}`);
  console.log(`[reconcile] P1 过期APPROVED:    ${report.p1_expired_approved}`);
  console.log(`[reconcile] P2 成本版本重叠:    ${report.p2_cost_overlap}`);
  console.log(`[reconcile] P2 history缺失:     ${report.p2_history_missing}`);
  console.log('='.repeat(60));

  if (report.p0_double_approved > 0) {
    console.error('[reconcile] BLOCKING: P0 double-approved conflicts found:');
    console.error(JSON.stringify(report.p0_samples, null, 2));
    console.error('[reconcile] Alert dispatched. Fix immediately before next run.');
    process.exit(2);
  }

  if (report.go_no_go !== 'GO') {
    console.warn('[reconcile] WARNING: issues found, do NOT cut traffic to read-new yet');
    process.exit(1);
  }

  console.log('[reconcile] All checks passed. Safe to proceed.');
}

run().catch((err) => {
  console.error('[reconcile] FATAL:', err);
  process.exit(1);
});
