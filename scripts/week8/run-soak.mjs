import { setTimeout as sleep } from 'node:timers/promises';
import crypto from 'node:crypto';

const API_BASE = process.env.WEEK8_API_BASE ?? 'http://127.0.0.1:3300';
const TENANT_ID = process.env.WEEK8_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';
const DURATION_MINUTES = Number(process.env.WEEK8_SOAK_MINUTES ?? 10);
const INTERVAL_SECONDS = Number(process.env.WEEK8_SOAK_INTERVAL_SECONDS ?? 20);
const RUN_SIGNING_SECRET =
  process.env.WEEK8_RUN_SIGNING_SECRET ??
  process.env.RUN_INTENT_SIGNING_SECRET ??
  'week8-signing-secret';

function nowIso() {
  return new Date().toISOString();
}

async function compileSingleIntent(count) {
  const body = {
    tenantId: TENANT_ID,
    target: { type: 'listing', id: `SOAK-LIST-${count % 5}` },
    runtimeFacts: {
      platform: 'amazon',
      market: 'US',
      risk_profile: 'CONSERVATIVE',
      acos: 31,
      bid_change_pct: 5,
      inventory_days: 20,
    },
    ast: {
      version: '1.0',
      rules: [
        {
          ruleId: `SOAK-${Date.now()}-${count}`,
          domain: 'ads',
          priority: 20,
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
            params: { currentBid: 1.0, minBid: 0.1, bidDeltaPct: 5, signalTimestamp: nowIso() },
          },
          reasoning: 'week8 soak',
          sourceText: 'week8 soak',
          confidence: 0.9,
        },
      ],
    },
  };

  const res = await fetch(`${API_BASE}/rules/compile-intents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`compile-intents failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const first = data?.intents?.[0];
  if (!first?.intent || !first?.decisionToken) {
    throw new Error('compile-intents returned no executable intent/decisionToken');
  }
  return { intent: first.intent, decisionToken: first.decisionToken };
}

async function run() {
  const endAt = Date.now() + DURATION_MINUTES * 60 * 1000;
  let count = 0;
  let failures = 0;

  while (Date.now() < endAt) {
    count += 1;

    try {
      const compiled = await compileSingleIntent(count);
      const payload = {
        tenantId: TENANT_ID,
        intent: compiled.intent,
      };
      const body = JSON.stringify(payload);
      const origin = 'policy-engine';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = `soak_${Date.now()}_${count}`;
      const signature = crypto
        .createHmac('sha256', RUN_SIGNING_SECRET)
        .update(`${timestamp}.${TENANT_ID}.${origin}.${body}`)
        .digest('hex');
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-intent-ts': timestamp,
          'x-intent-signature': signature,
          'x-intent-nonce': nonce,
          'x-tenant-id': TENANT_ID,
          'x-intent-origin': origin,
          'x-decision-token': compiled.decisionToken,
        },
        body,
      });

      if (!res.ok) {
        failures += 1;
      }
    } catch {
      failures += 1;
    }

    process.stdout.write(`[soak] sent=${count} failures=${failures}\n`);
    await sleep(INTERVAL_SECONDS * 1000);
  }

  process.stdout.write(`[soak] completed sent=${count} failures=${failures}\n`);
  if (failures > 0) process.exitCode = 2;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
