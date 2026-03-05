import { Hono } from 'hono';
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { extractUser, requireRole } from './auth-middleware.js';
import type { AuthContext } from './auth-middleware.js';

const ENCRYPTION_KEY_HEX = process.env.EXCHANGE_RATE_ENCRYPTION_KEY ?? '';
const ALGORITHM = 'aes-256-gcm';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const VALID_PROVIDERS = ['openexchangerates', 'fixer', 'custom'] as const;

function encryptApiKey(plaintext: string): string {
  if (!ENCRYPTION_KEY_HEX) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EXCHANGE_RATE_ENCRYPTION_KEY is required in production');
    }
    return plaintext;
  }
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptApiKey(stored: string): string {
  if (!ENCRYPTION_KEY_HEX || !stored.includes(':')) return stored;
  const [ivHex, tagHex, encHex] = stored.split(':');
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

function parseDate(str: string | undefined): Date | null {
  if (!str) return null;
  if (!DATE_RE.test(str)) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchRatesFromProvider(config: {
  provider: string;
  apiKey: string;
  apiUrl?: string | null;
  baseCurrency: string;
}): Promise<Record<string, number>> {
  const decrypted = decryptApiKey(config.apiKey);
  let url: string;

  if (config.provider === 'openexchangerates') {
    url = `https://openexchangerates.org/api/latest.json?app_id=${decrypted}&base=${config.baseCurrency}`;
  } else if (config.provider === 'fixer') {
    url = `http://data.fixer.io/api/latest?access_key=${decrypted}&base=${config.baseCurrency}`;
  } else if (config.apiUrl) {
    url = config.apiUrl.replace('{API_KEY}', decrypted).replace('{BASE}', config.baseCurrency);
  } else {
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Provider returned ${res.status}`);
  const json = await res.json() as { rates?: Record<string, number>; error?: unknown };
  if (!json.rates) throw new Error('No rates in provider response');
  return json.rates;
}

export async function syncExchangeRates(): Promise<{ inserted: number; date: string }> {
  const config = await prisma.exchangeRateConfig.findFirst({ where: { enabled: true } });
  if (!config) return { inserted: 0, date: '' };

  const rates = await fetchRatesFromProvider(config);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const upserts = Object.entries(rates).map(([target, rate]) =>
    prisma.exchangeRateDailySnapshot.upsert({
      where: {
        date_baseCurrency_targetCurrency: {
          date: today,
          baseCurrency: config.baseCurrency,
          targetCurrency: target,
        },
      },
      create: {
        date: today,
        baseCurrency: config.baseCurrency,
        targetCurrency: target,
        rate,
        source: config.provider,
      },
      update: { rate, fetchedAt: new Date() },
    })
  );

  await Promise.all(upserts);
  return { inserted: upserts.length, date: today.toISOString().slice(0, 10) };
}

export async function calculateMonthlyAvg(year: number, month: number): Promise<number> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const allRows = await prisma.exchangeRateDailySnapshot.findMany({
    where: { date: { gte: start, lt: end } },
    select: { baseCurrency: true, targetCurrency: true, rate: true },
  });

  const grouped = new Map<string, { baseCurrency: string; targetCurrency: string; rates: number[] }>();
  for (const row of allRows) {
    const key = `${row.baseCurrency}:${row.targetCurrency}`;
    if (!grouped.has(key)) {
      grouped.set(key, { baseCurrency: row.baseCurrency, targetCurrency: row.targetCurrency, rates: [] });
    }
    grouped.get(key)!.rates.push(row.rate);
  }

  let count = 0;
  for (const { baseCurrency, targetCurrency, rates } of grouped.values()) {
    if (!rates.length) continue;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    await prisma.exchangeRateMonthlyAvg.upsert({
      where: { year_month_baseCurrency_targetCurrency: { year, month, baseCurrency, targetCurrency } },
      create: { year, month, baseCurrency, targetCurrency, avgRate: avg, minRate: min, maxRate: max, sampleCount: rates.length },
      update: { avgRate: avg, minRate: min, maxRate: max, sampleCount: rates.length, calculatedAt: new Date() },
    });
    count++;
  }
  return count;
}

export async function purgeOldSnapshots(): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const result = await prisma.exchangeRateDailySnapshot.deleteMany({ where: { date: { lt: cutoff } } });
  return result.count;
}

export const exchangeRateRoutes = new Hono<{ Variables: { auth: AuthContext } }>();

exchangeRateRoutes.use('*', extractUser);

exchangeRateRoutes.get('/config', requireRole('system_admin'), async (c) => {
  const config = await prisma.exchangeRateConfig.findFirst();
  if (!config) return c.json(null);
  return c.json({ ...config, apiKey: '••••••••' });
});

exchangeRateRoutes.post('/config', requireRole('system_admin'), async (c) => {
  const body = await c.req.json<{
    provider: string;
    apiKey?: string;
    apiUrl?: string;
    baseCurrency?: string;
    enabled?: boolean;
  }>();

  if (!VALID_PROVIDERS.includes(body.provider as typeof VALID_PROVIDERS[number])) {
    return c.json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` }, 400);
  }
  const base = body.baseCurrency ?? 'USD';
  if (!CURRENCY_RE.test(base)) {
    return c.json({ error: 'baseCurrency must be a 3-letter uppercase currency code (e.g. USD)' }, 400);
  }
  if (body.provider === 'custom' && body.apiUrl) {
    try { new URL(body.apiUrl); } catch {
      return c.json({ error: 'apiUrl must be a valid URL' }, 400);
    }
  }

  const existing = await prisma.exchangeRateConfig.findFirst();

  const encryptedKey = body.apiKey
    ? encryptApiKey(body.apiKey)
    : existing?.apiKey;

  if (!encryptedKey) {
    return c.json({ error: 'apiKey is required when creating a new config' }, 400);
  }

  if (existing) {
    const updated = await prisma.exchangeRateConfig.update({
      where: { id: existing.id },
      data: {
        provider: body.provider,
        apiKey: encryptedKey,
        apiUrl: body.apiUrl ?? null,
        baseCurrency: base,
        enabled: body.enabled ?? true,
      },
    });
    return c.json({ ...updated, apiKey: '••••••••' });
  }

  const created = await prisma.exchangeRateConfig.create({
    data: {
      provider: body.provider,
      apiKey: encryptedKey,
      apiUrl: body.apiUrl ?? null,
      baseCurrency: base,
      enabled: body.enabled ?? true,
    },
  });
  return c.json({ ...created, apiKey: '••••••••' }, 201);
});

exchangeRateRoutes.post('/sync', requireRole('system_admin'), async (c) => {
  try {
    const result = await syncExchangeRates();
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

exchangeRateRoutes.get('/current', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const latest = await prisma.exchangeRateDailySnapshot.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!latest) return c.json({ date: null, rates: [] });

  const rows = await prisma.exchangeRateDailySnapshot.findMany({
    where: { date: latest.date },
    orderBy: { targetCurrency: 'asc' },
    select: { baseCurrency: true, targetCurrency: true, rate: true, date: true, source: true },
  });
  return c.json({ date: latest.date, rates: rows });
});

exchangeRateRoutes.get('/daily', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const { from, to, base, target } = c.req.query();
  const where: Record<string, unknown> = {};

  if (from) {
    const d = parseDate(from);
    if (!d) return c.json({ error: `invalid 'from' date: ${from}` }, 400);
    where.date = { ...(where.date as object ?? {}), gte: d };
  }
  if (to) {
    const d = parseDate(to);
    if (!d) return c.json({ error: `invalid 'to' date: ${to}` }, 400);
    where.date = { ...(where.date as object ?? {}), lte: d };
  }
  if (base) where.baseCurrency = base;
  if (target) where.targetCurrency = target;

  const rows = await prisma.exchangeRateDailySnapshot.findMany({
    where,
    orderBy: [{ date: 'asc' }, { targetCurrency: 'asc' }],
    take: 1000,
    select: { date: true, baseCurrency: true, targetCurrency: true, rate: true, source: true, fetchedAt: true },
  });
  return c.json(rows);
});

exchangeRateRoutes.get('/monthly', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const { fromYear, fromMonth, toYear, toMonth, base, target } = c.req.query();
  const where: Record<string, unknown> = {};
  if (base) where.baseCurrency = base;
  if (target) where.targetCurrency = target;
  if (fromYear) where.year = { gte: Number(fromYear) };
  if (toYear) where.year = { ...(where.year as object ?? {}), lte: Number(toYear) };
  if (fromMonth && fromYear && fromYear === toYear) {
    where.month = { gte: Number(fromMonth) };
  }
  if (toMonth && toYear && fromYear === toYear) {
    where.month = { ...(where.month as object ?? {}), lte: Number(toMonth) };
  }

  const rows = await prisma.exchangeRateMonthlyAvg.findMany({
    where,
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { targetCurrency: 'asc' }],
    take: 500,
  });
  return c.json(rows);
});

exchangeRateRoutes.get('/daily/mcp', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const { base, target, date } = c.req.query();

  if (date) {
    const d = parseDate(date);
    if (!d) return c.json({ error: `invalid date: ${date}` }, 400);
    const row = await prisma.exchangeRateDailySnapshot.findFirst({
      where: {
        date: d,
        ...(base ? { baseCurrency: base } : {}),
        ...(target ? { targetCurrency: target } : {}),
      },
      select: { date: true, baseCurrency: true, targetCurrency: true, rate: true, source: true },
    });
    return c.json(row ?? null);
  }

  const latest = await prisma.exchangeRateDailySnapshot.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  if (!latest) return c.json(null);

  const row = await prisma.exchangeRateDailySnapshot.findFirst({
    where: {
      date: latest.date,
      ...(base ? { baseCurrency: base } : {}),
      ...(target ? { targetCurrency: target } : {}),
    },
    select: { date: true, baseCurrency: true, targetCurrency: true, rate: true, source: true },
  });
  return c.json(row ?? null);
});

exchangeRateRoutes.get('/monthly/mcp', requireRole('system_admin', 'tenant_admin', 'operator', 'viewer'), async (c) => {
  const { base, target, year, month } = c.req.query();
  if (!year || !month) return c.json({ error: 'year and month are required' }, 400);

  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return c.json({ error: 'year must be an integer and month must be 1–12' }, 400);
  }

  const row = await prisma.exchangeRateMonthlyAvg.findFirst({
    where: {
      year: y,
      month: m,
      ...(base ? { baseCurrency: base } : {}),
      ...(target ? { targetCurrency: target } : {}),
    },
    select: { year: true, month: true, baseCurrency: true, targetCurrency: true, avgRate: true, minRate: true, maxRate: true, sampleCount: true },
  });
  return c.json(row ?? null);
});
