import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const PG_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const PG_PORT = Number(process.env.WEEK8_PG_PORT ?? 55450);
const API_PORT = Number(process.env.WEEK8_API_PORT ?? 3315);
const DATA_DIR = process.env.WEEK8_PG_DATA_DIR ?? `/tmp/ai_ecom_pgdata_week8_${Date.now()}`;
const DB_URL = `postgresql://gaoyuehebabadiannao@localhost:${PG_PORT}/ai_ecom`;
const RUN_SIGNING_SECRET = process.env.WEEK8_RUN_SIGNING_SECRET ?? 'week8-signing-secret';
const DECISION_TOKEN_SECRET = process.env.WEEK8_DECISION_TOKEN_SECRET ?? 'week8-decision-secret';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function log(msg) {
  process.stdout.write(`[week8] ${msg}\n`);
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: `${PG_BIN}:${process.env.PATH ?? ''}`,
        LANG: 'C',
        LC_ALL: 'C',
      },
      ...options,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/health`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('API did not become healthy in time');
}

async function api(path, init) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}${path}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data };
}

async function psql(sql) {
  const { stdout } = await run('psql', [DB_URL, '-t', '-A', '-c', sql]);
  return stdout.trim();
}

async function waitForSqlMatch(sql, matcher, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await psql(sql);
    if (matcher(value)) return value;
    await sleep(400);
  }
  return await psql(sql);
}

function nowIso() {
  return new Date().toISOString();
}

async function compileSingleIntent(input) {
  const body = {
    tenantId: TENANT_ID,
    target: { type: 'listing', id: input.targetId },
    runtimeFacts: {
      platform: 'amazon',
      market: 'US',
      risk_profile: 'CONSERVATIVE',
      acos: 31,
      bid_change_pct: Number(input.params?.bidDeltaPct ?? 0),
      inventory_days: 20,
    },
    ast: {
      version: '1.0',
      rules: [
        {
          ruleId: `W8-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          domain: 'ads',
          priority: input.priority,
          scope: {
            platform: 'amazon',
            market: 'US',
            fulfillment: 'ALL',
            listingLifecycle: 'ALL',
          },
          when: {
            kind: 'predicate',
            field: 'platform',
            operator: '=',
            value: 'amazon',
          },
          then: {
            type: 'AdjustBid',
            params: {
              currentBid: 1.0,
              minBid: 0.1,
              signalTimestamp: nowIso(),
              ...input.params,
            },
          },
          reasoning: input.reasoning,
          sourceText: input.reasoning,
          confidence: 0.9,
        },
      ],
    },
  };

  const compiled = await api('/rules/compile-intents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (compiled.status !== 200) {
    throw new Error(`compile-intents failed: ${compiled.status} ${JSON.stringify(compiled.data)}`);
  }

  const first = compiled.data?.intents?.[0];
  if (!first?.intent || !first?.decisionToken) {
    throw new Error('compile-intents returned no executable intent/decisionToken');
  }

  return {
    intent: first.intent,
    decisionToken: first.decisionToken,
  };
}

async function runCompiledIntent(compiled) {
  const payload = {
    tenantId: TENANT_ID,
    intent: compiled.intent,
  };
  const body = JSON.stringify(payload);
  const origin = 'policy-engine';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = `w8_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const signature = crypto
    .createHmac('sha256', RUN_SIGNING_SECRET)
    .update(`${timestamp}.${TENANT_ID}.${origin}.${body}`)
    .digest('hex');

  return api('/run', {
    method: 'POST',
    headers: {
      'x-intent-ts': timestamp,
      'x-intent-signature': signature,
      'x-intent-nonce': nonce,
      'x-tenant-id': TENANT_ID,
      'x-intent-origin': origin,
      'x-decision-token': compiled.decisionToken,
    },
    body,
  });
}

async function main() {
  let apiProc;
  try {
    log('Init temporary PostgreSQL');
    await run('rm', ['-rf', DATA_DIR]);
    await run('initdb', ['-D', DATA_DIR, '--auth=trust', '--encoding=UTF8']);
    await run('pg_ctl', ['-D', DATA_DIR, '-l', `/tmp/week8_pg_${PG_PORT}.log`, '-o', `-p ${PG_PORT}`, 'start']);
    await run('createdb', ['-p', String(PG_PORT), 'ai_ecom']);

    log('Apply schema and hardening SQL');
    await run('pnpm', ['db:migrate'], { env: { ...process.env, DATABASE_URL: DB_URL } });
    await run(
      'pnpm',
      ['--filter', '@repo/database', 'exec', 'prisma', 'db', 'execute', '--file', 'migrations/0001_week1_hardening.sql'],
      {
        cwd: `${process.cwd()}/packages/database`,
        env: { ...process.env, DATABASE_URL: DB_URL },
      },
    );

    log('Seed minimal master data');
    await psql(`insert into "Tenant" (id, code, name, status, "createdAt", "updatedAt") values ('${TENANT_ID}','demo','Demo Tenant','active', now(), now());`);
    await psql(`insert into "Brand" (id, "tenantId", code, name, "createdAt", "updatedAt") values ('22222222-2222-2222-2222-222222222222','${TENANT_ID}','brand1','Brand 1', now(), now());`);
    await psql(`insert into "Product" (id, "tenantId", "brandId", sku, name, category, "lifecycleStage", "createdAt", "updatedAt") values ('33333333-3333-3333-3333-333333333333','${TENANT_ID}','22222222-2222-2222-2222-222222222222','sku-w8','Product W8','cat1','NEW', now(), now());`);
    await psql(`insert into "Commodity" (id, "tenantId", "productId", market, language, title, "lifecycleStage", "createdAt", "updatedAt") values ('44444444-4444-4444-4444-444444444444','${TENANT_ID}','33333333-3333-3333-3333-333333333333','US','en','Commodity W8','NEW', now(), now());`);

    log('Start API service');
    apiProc = spawn('pnpm', ['--filter', '@apps/api', 'dev'], {
      env: {
        ...process.env,
        DATABASE_URL: DB_URL,
        PORT: String(API_PORT),
        AMAZON_ADS_MODE: 'mock',
        ADS_AGENT_RUNTIME: 'node',
        APPROVAL_SSE_CHANNEL: 'approvals',
        APPROVAL_FRESHNESS_TTL_MINUTES: '30',
        RUN_INTENT_SIGNING_SECRET: RUN_SIGNING_SECRET,
        DECISION_TOKEN_SECRET,
      },
      stdio: 'pipe',
    });
    apiProc.stdout.on('data', (d) => process.stdout.write(d.toString()));
    apiProc.stderr.on('data', (d) => process.stderr.write(d.toString()));

    await waitForHealth();
    log('API healthy');

    // Scenario 1: low-risk auto execute
    const s1Intent = await compileSingleIntent({
      targetId: 'LIST-S1',
      priority: 20,
      reasoning: 'low risk',
      params: { bidDeltaPct: 5 },
    });
    const s1 = await runCompiledIntent(s1Intent);
    if (s1.status !== 202) throw new Error(`Scenario1 /run failed: ${JSON.stringify(s1.data)}`);
    const s1Status = await waitForSqlMatch(
      `select status from "AgentExecutionLog" where "intentId"='${s1Intent.intent.intentId}';`,
      (value) => value.includes('COMPLETED'),
      10000,
    );
    if (!s1Status.includes('COMPLETED')) throw new Error(`Scenario1 failed: ${s1Status}`);

    // Scenario 2: high-risk approval intercept
    const s2Intent = await compileSingleIntent({
      targetId: 'LIST-S2',
      priority: 95,
      reasoning: 'high risk',
      params: { bidDeltaPct: 10 },
    });
    await runCompiledIntent(s2Intent);
    const s2Status = await waitForSqlMatch(
      `select status from "AgentExecutionLog" where "intentId"='${s2Intent.intent.intentId}';`,
      (value) => value.includes('AWAITING_APPROVAL'),
      12000,
    );
    if (!s2Status.includes('AWAITING_APPROVAL')) throw new Error(`Scenario2 failed: ${s2Status}`);

    // Scenario 3: approval resume
    const approvalId = await waitForSqlMatch(
      `select id from "ApprovalQueue" where "intentId"='${s2Intent.intent.intentId}' limit 1;`,
      (value) => value.length > 0,
      10000,
    );
    const appr = await api(`/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ reviewerId: 'week8' }),
    });
    if (appr.status !== 200) throw new Error('Scenario3 approve failed');
    const s3Status = await waitForSqlMatch(
      `select status from "AgentExecutionLog" where "intentId"='${s2Intent.intent.intentId}';`,
      (value) => value.includes('RESUMED_COMPLETED'),
      12000,
    );
    if (!s3Status.includes('RESUMED_COMPLETED')) throw new Error(`Scenario3 failed: ${s3Status}`);

    // Scenario 4: approval expiry
    const s4Intent = await compileSingleIntent({
      targetId: 'LIST-S4',
      priority: 95,
      reasoning: 'expire me',
      params: { bidDeltaPct: 10 },
    });
    await runCompiledIntent(s4Intent);
    await waitForSqlMatch(
      `select status from "AgentExecutionLog" where "intentId"='${s4Intent.intent.intentId}';`,
      (value) => value.includes('AWAITING_APPROVAL'),
      12000,
    );
    const exp = await api('/approvals/expire', {
      method: 'POST',
      headers: { 'x-tenant-id': TENANT_ID },
      body: JSON.stringify({ olderThanMinutes: 0 }),
    });
    if (exp.status !== 200 || exp.data.expired < 1) throw new Error('Scenario4 failed: no expired approvals');

    // Scenario 5: circuit breaker
    const cbIntentIds = [];
    for (let i = 1; i <= 4; i += 1) {
      const cbIntent = await compileSingleIntent({
        targetId: 'LIST-S5',
        priority: 20,
        reasoning: `cb-${i}`,
        params: {
          productId: 'PRODUCT-CB-W8',
          forceFailure: true,
          bidDeltaPct: 5,
        },
      });
      cbIntentIds.push(cbIntent.intent.intentId);
      await runCompiledIntent(cbIntent);
      await waitForSqlMatch(
        `select status from "AgentExecutionLog" where "intentId"='${cbIntent.intent.intentId}';`,
        (value) => value.includes('FAILED') || value.includes('CIRCUIT_OPEN'),
        12000,
      );
    }
    const cbLast = await waitForSqlMatch(
      `select status from "AgentExecutionLog" where "intentId"='${cbIntentIds[3]}';`,
      (value) => value.includes('CIRCUIT_OPEN'),
      12000,
    );
    if (!cbLast.includes('CIRCUIT_OPEN')) throw new Error(`Scenario5 failed: ${cbLast}`);

    // Scenario 6: lifecycle sync (multi listing same commodity+platform)
    await api('/listings', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: TENANT_ID,
        commodityId: '44444444-4444-4444-4444-444444444444',
        platform: 'amazon',
        externalListingId: 'W8-A1',
        title: 'W8-A1',
        fulfillment: 'FBA',
        isPrimary: true,
        status: 'ACTIVE',
      }),
    });
    await api('/listings', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: TENANT_ID,
        commodityId: '44444444-4444-4444-4444-444444444444',
        platform: 'amazon',
        externalListingId: 'W8-B1',
        title: 'W8-B1',
        fulfillment: 'FBM',
        isPrimary: false,
        status: 'PAUSED',
      }),
    });
    const listingAId = (await psql(`select id from "Listing" where "externalListingId"='W8-A1' limit 1;`)).trim();
    await api(`/listings/${listingAId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        tenantId: TENANT_ID,
        status: 'PAUSED',
      }),
    });
    const commodityStage = await psql(`select "lifecycleStage" from "Commodity" where id='44444444-4444-4444-4444-444444444444';`);
    const productStage = await psql(`select "lifecycleStage" from "Product" where id='33333333-3333-3333-3333-333333333333';`);
    if (!commodityStage.includes('STABLE') || !productStage.includes('STABLE')) {
      throw new Error(`Scenario6 failed: commodity=${commodityStage}, product=${productStage}`);
    }

    const snapshotCount = await psql(`select count(*) from "PolicySnapshot";`);
    if (Number(snapshotCount) < 1) throw new Error('PolicySnapshot was not created');

    log('All 6 E2E scenarios passed');
  } finally {
    if (apiProc && !apiProc.killed) apiProc.kill('SIGTERM');
    await sleep(300);
    try {
      await run('pg_ctl', ['-D', DATA_DIR, 'stop']);
    } catch {}
    try {
      await run('rm', ['-rf', DATA_DIR]);
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
