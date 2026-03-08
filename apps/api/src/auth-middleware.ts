import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { env } from './env.js';
import { verifyAccessToken, type HarnessJWTPayload } from './jwt-auth.js';

const VALID_ROLES = [
  'system_admin',
  'tenant_admin',
  'operator',
  'supplier',
  'viewer',
] as const;

type Role = (typeof VALID_ROLES)[number];

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  scopes: Array<{ scopeType: string; scopeValue: string }>;
  authMode: 'passthrough' | 'jwt';
}

export const extractUser = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  if (env.AUTH_MODE === 'disabled') {
    c.set('auth', {
      userId: 'anonymous',
      tenantId: c.req.header('x-tenant-id') ?? 'unknown',
      role: 'viewer',
      scopes: [],
      authMode: 'passthrough',
    });
    return next();
  }

  // JWT auth mode
  if (env.AUTH_MODE === 'full') {
    const authHeader = c.req.header('authorization');

    // Allow S2S requests to bypass JWT (they use HMAC)
    const s2sSignature = c.req.header('x-s2s-signature');
    if (s2sSignature) {
      // S2S path — fall through to passthrough logic for backward compat
    } else {
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'authorization header required' }, 401);
      }

      let payload: HarnessJWTPayload;
      try {
        payload = await verifyAccessToken(authHeader.slice(7));
      } catch {
        return c.json({ error: 'invalid or expired token' }, 401);
      }

      const userId = payload.sub!;
      const tenantId = payload.tid;
      const role = payload.role;

      if (!VALID_ROLES.includes(role)) {
        return c.json({ error: `invalid role in token: ${role}` }, 403);
      }

      const scopeStrings = payload.scopes ?? [];
      const scopes = scopeStrings.map((s: string) => {
        const [scopeType, ...rest] = s.split(':');
        return { scopeType, scopeValue: rest.join(':') };
      });

      c.set('auth', {
        userId,
        tenantId,
        role,
        scopes,
        authMode: 'jwt',
      });

      return next();
    }
  }

  // In passthrough mode, still honor Bearer tokens when present
  if (env.AUTH_MODE === 'passthrough') {
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyAccessToken(authHeader.slice(7));
        const userId = payload.sub!;
        const tenantId = payload.tid;
        const role = payload.role;

        if (VALID_ROLES.includes(role)) {
          const scopeStrings = payload.scopes ?? [];
          const scopes = scopeStrings.map((s: string) => {
            const [scopeType, ...rest] = s.split(':');
            return { scopeType, scopeValue: rest.join(':') };
          });

          c.set('auth', {
            userId,
            tenantId,
            role,
            scopes,
            authMode: 'jwt',
          });

          return next();
        }
      } catch {
        // JWT invalid — fall through to passthrough headers
      }
    }
  }

  if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'passthrough') {
    return c.json({ error: 'pass-through auth disabled in production' }, 503);
  }

  const userId = c.req.header('x-user-id');
  const role = c.req.header('x-user-role') as Role | undefined;
  const tenantId = c.req.header('x-tenant-id');

  if (!tenantId) {
    return c.json({ error: 'x-tenant-id header required' }, 401);
  }

  if (!userId || !role) {
    c.set('auth', {
      userId: 'default-operator',
      tenantId,
      role: 'operator',
      scopes: [],
      authMode: 'passthrough',
    });
    return next();
  }

  if (!VALID_ROLES.includes(role)) {
    return c.json({ error: `invalid role: ${role}` }, 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    include: { scopes: true },
  });

  if (user && user.role !== role) {
    return c.json({ error: 'role mismatch' }, 403);
  }

  c.set('auth', {
    userId: user?.id ?? userId,
    tenantId,
    role,
    scopes: user?.scopes.map((s) => ({
      scopeType: s.scopeType,
      scopeValue: s.scopeValue,
    })) ?? [],
    authMode: 'passthrough',
  });

  return next();
});

export function requireRole(...allowed: Role[]) {
  return createMiddleware<{ Variables: { auth: AuthContext } }>(
    async (c, next) => {
      const auth = c.get('auth');
      if (!auth || !allowed.includes(auth.role)) {
        return c.json({ error: 'insufficient permissions' }, 403);
      }
      return next();
    },
  );
}

export function buildScopeFilter(auth: AuthContext) {
  if (auth.scopes.length === 0) return { tenantId: auth.tenantId };

  const brandIds = auth.scopes
    .filter((s) => s.scopeType === 'brand')
    .map((s) => s.scopeValue);
  const categoryIds = auth.scopes
    .filter((s) => s.scopeType === 'category')
    .map((s) => s.scopeValue);

  const filters: Record<string, unknown>[] = [{ tenantId: auth.tenantId }];

  if (brandIds.length > 0) {
    filters.push({ brandId: { in: brandIds } });
  }
  if (categoryIds.length > 0) {
    filters.push({ categoryId: { in: categoryIds } });
  }

  return { AND: filters };
}

const SUPPLIER_HIDDEN_FIELDS = new Set([
  'costPrice',
  'msrp',
  'targetMargin',
  'profitMarginPct',
  'sales',
  'normalizedRoas',
  'acos',
  'spend',
  'localBaseCost',
  'localMsrp',
  'price',
  'margin',
  'profit',
  'revenue',
]);

export function stripSensitiveFields(
  data: unknown,
  role: string,
): unknown {
  if (role !== 'supplier') return data;

  if (Array.isArray(data)) {
    return data.map((item) => stripSensitiveFields(item, role));
  }

  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (SUPPLIER_HIDDEN_FIELDS.has(key)) continue;
      result[key] = stripSensitiveFields(value, role);
    }
    return result;
  }

  return data;
}

export function signS2SRequest(
  body: string,
  secret: string,
): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return { timestamp, signature };
}

export function verifyS2SRequest(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  maxSkewSeconds = 300,
): boolean {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > maxSkewSeconds) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
