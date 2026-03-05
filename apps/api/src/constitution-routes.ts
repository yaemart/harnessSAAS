import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { requireRole, type AuthContext } from './auth-middleware.js';
import {
  loadActiveConstitution,
  loadConstitutionHistory,
  publishConstitution,
  generateConstitutionSuggestions,
  type ConstitutionRule,
} from './constitution-engine.js';

type Env = { Variables: { auth: AuthContext } };

const app = new Hono<Env>();
app.use('*', requireRole('system_admin', 'tenant_admin'));

const VALID_RULE_KINDS = ['ALLOWED_ACTIONS', 'MAX_BID_CHANGE_PCT', 'MIN_BID_GUARD'] as const;
const VALID_RULE_LEVELS = ['HARD', 'STRUCTURAL'] as const;
const MAX_RULES = 50;
const MAX_SUMMARY_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;
const RULE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const STRIP_HTML = /<[^>]*>/g;
const STRIP_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeText(text: string): string {
  return text.replace(STRIP_HTML, '').replace(STRIP_CONTROL, '').trim();
}

// ─── GET /constitution — current active constitution ──

app.get('/', async (c) => {
  const auth = c.get('auth');
  const manifest = await loadActiveConstitution(prisma, auth.tenantId);
  return c.json({ constitution: manifest });
});

// ─── GET /constitution/history — version history ──────

app.get('/history', async (c) => {
  const auth = c.get('auth');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const history = await loadConstitutionHistory(prisma, auth.tenantId, limit);
  return c.json({ history });
});

// ─── POST /constitution — publish new version ─────────

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    changeSummary: string;
    rules: ConstitutionRule[];
  }>();

  if (!body.changeSummary || typeof body.changeSummary !== 'string') {
    return c.json({ error: 'changeSummary is required' }, 400);
  }
  const cleanSummary = sanitizeText(body.changeSummary);
  if (!cleanSummary) {
    return c.json({ error: 'changeSummary must contain meaningful text' }, 400);
  }
  if (cleanSummary.length > MAX_SUMMARY_LENGTH) {
    return c.json({ error: `changeSummary must be ≤ ${MAX_SUMMARY_LENGTH} chars` }, 400);
  }
  if (!Array.isArray(body.rules) || body.rules.length === 0) {
    return c.json({ error: 'rules array is required and must not be empty' }, 400);
  }
  if (body.rules.length > MAX_RULES) {
    return c.json({ error: `Maximum ${MAX_RULES} rules allowed` }, 400);
  }

  const seenIds = new Set<string>();
  for (const rule of body.rules) {
    if (!rule.id || typeof rule.id !== 'string' || !RULE_ID_RE.test(rule.id)) {
      return c.json({ error: 'Rule id must be alphanumeric with hyphens/underscores, 1-64 chars' }, 400);
    }
    if (seenIds.has(rule.id)) {
      return c.json({ error: `Duplicate rule id: ${rule.id}` }, 400);
    }
    seenIds.add(rule.id);

    if (!rule.title || typeof rule.title !== 'string' || rule.title.length > MAX_TITLE_LENGTH) {
      return c.json({ error: `Rule title is required and must be ≤ ${MAX_TITLE_LENGTH} chars` }, 400);
    }
    if (!VALID_RULE_LEVELS.includes(rule.level as typeof VALID_RULE_LEVELS[number])) {
      return c.json({ error: `Rule level must be one of: ${VALID_RULE_LEVELS.join(', ')}` }, 400);
    }
    if (!VALID_RULE_KINDS.includes(rule.kind as typeof VALID_RULE_KINDS[number])) {
      return c.json({ error: `Rule kind must be one of: ${VALID_RULE_KINDS.join(', ')}` }, 400);
    }

    const paramErr = validateRuleParams(rule);
    if (paramErr) return c.json({ error: paramErr }, 400);
  }

  try {
    const manifest = await publishConstitution(prisma, {
      tenantId: auth.tenantId,
      updatedBy: auth.userId,
      changeSummary: cleanSummary,
      rules: body.rules,
    });
    return c.json({ constitution: manifest }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      return c.json({ error: 'Concurrent publish detected. Please reload and try again.' }, 409);
    }
    throw e;
  }
});

function validateRuleParams(rule: ConstitutionRule): string | null {
  if (rule.kind === 'ALLOWED_ACTIONS') {
    const params = rule.params as Record<string, unknown>;
    if (!Array.isArray(params.actions) || params.actions.length === 0) {
      return 'ALLOWED_ACTIONS must have a non-empty actions array';
    }
    for (const action of params.actions) {
      if (typeof action !== 'string' || action.length === 0 || action.length > 64) {
        return 'Each action must be a non-empty string ≤ 64 chars';
      }
    }
  }
  if (rule.kind === 'MAX_BID_CHANGE_PCT') {
    const params = rule.params as Record<string, unknown>;
    const maxPct = params.maxPct;
    if (typeof maxPct !== 'number' || !Number.isFinite(maxPct) || maxPct <= 0 || maxPct > 100) {
      return 'maxPct must be a finite number between 0 and 100';
    }
  }
  return null;
}

// ─── GET /constitution/suggestions — AI rule suggestions ──

app.get('/suggestions', async (c) => {
  const auth = c.get('auth');
  const { suggestions } = await generateConstitutionSuggestions(prisma, auth.tenantId);
  return c.json({ suggestions });
});

export { app as constitutionRoutes };
