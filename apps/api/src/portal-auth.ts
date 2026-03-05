import crypto from 'node:crypto';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from 'jose';
import { prisma } from './db.js';
import { env } from './env.js';

export interface PortalJWTPayload extends JoseJWTPayload {
  sub: string;
  cid: string;
  bid: string;
  tid: string;
  email: string;
}

export interface PortalAuthContext {
  consumerId: string;
  brandId: string;
  tenantId: string;
  email: string;
}

const PORTAL_TOKEN_TTL = '7d';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_MS = 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OTPEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  tenantId: string;
}

const otpStore = new Map<string, OTPEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(key);
  }
}, 60_000);

let _portalSigningKey: Uint8Array | null = null;
function getPortalSigningKey() {
  if (!_portalSigningKey) {
    _portalSigningKey = new TextEncoder().encode(env.PORTAL_JWT_SECRET);
  }
  return _portalSigningKey;
}

export async function signPortalToken(payload: {
  consumerId: string;
  brandId: string;
  tenantId: string;
  email: string;
}): Promise<string> {
  const key = getPortalSigningKey();
  return new SignJWT({
    cid: payload.consumerId,
    bid: payload.brandId,
    tid: payload.tenantId,
    email: payload.email,
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.consumerId)
    .setIssuer('portal-auth')
    .setAudience('portal-api')
    .setIssuedAt()
    .setExpirationTime(PORTAL_TOKEN_TTL)
    .sign(key);
}

export async function verifyPortalToken(token: string): Promise<PortalJWTPayload> {
  const key = getPortalSigningKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: 'portal-auth',
    audience: 'portal-api',
  });
  return payload as PortalJWTPayload;
}

export const portalAuth = createMiddleware<{
  Variables: { portalAuth: PortalAuthContext };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyPortalToken(token);
    c.set('portalAuth', {
      consumerId: payload.cid,
      brandId: payload.bid,
      tenantId: payload.tid,
      email: payload.email,
    });
    return next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

const SSE_TOKEN_TTL = '30s';

export async function signSSEToken(payload: {
  consumerId: string;
  tenantId: string;
  caseId: string;
}): Promise<string> {
  const key = getPortalSigningKey();
  return new SignJWT({
    cid: payload.consumerId,
    tid: payload.tenantId,
    caseId: payload.caseId,
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.consumerId)
    .setIssuer('portal-auth')
    .setAudience('portal-sse')
    .setIssuedAt()
    .setExpirationTime(SSE_TOKEN_TTL)
    .sign(key);
}

export interface SSETokenPayload extends JoseJWTPayload {
  cid: string;
  tid: string;
  caseId: string;
}

export async function verifySSEToken(token: string): Promise<SSETokenPayload> {
  const key = getPortalSigningKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: 'portal-auth',
    audience: 'portal-sse',
  });
  return payload as SSETokenPayload;
}

export { UUID_RE, EMAIL_RE };

export const portalAuthRoutes = new Hono();

portalAuthRoutes.post('/send-code', async (c) => {
  const body = await c.req.json<{ email: string; brandId: string }>();
  const { email, brandId } = body;

  if (!email || !brandId) {
    return c.json({ error: 'email and brandId are required' }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return c.json({ error: 'Invalid email format' }, 400);
  }
  if (!UUID_RE.test(brandId)) {
    return c.json({ error: 'Invalid brandId format' }, 400);
  }

  const storeKey = `${brandId}:${email}`;
  const existing = otpStore.get(storeKey);
  if (existing && Date.now() < existing.expiresAt) {
    const elapsed = Date.now() - (existing.expiresAt - OTP_TTL_MS);
    if (elapsed < OTP_COOLDOWN_MS) {
      return c.json({ error: 'Please wait before requesting a new code.' }, 429);
    }
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, tenantId: true },
  });
  if (!brand) {
    return c.json({ error: 'Verification code sent' }, 200);
  }

  const code = String(crypto.randomInt(100000, 999999));

  otpStore.set(storeKey, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    tenantId: brand.tenantId,
  });

  if (env.NODE_ENV !== 'production') {
    console.log(`[Portal OTP] ${email} → ${code} (brand: ${brandId})`);
  }

  return c.json({ success: true, message: 'Verification code sent' });
});

portalAuthRoutes.post('/verify-code', async (c) => {
  const body = await c.req.json<{ email: string; brandId: string; code: string }>();
  const { email, brandId, code } = body;

  if (!email || !brandId || !code) {
    return c.json({ error: 'email, brandId, and code are required' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }
  if (!UUID_RE.test(brandId)) {
    return c.json({ error: 'Invalid brandId format' }, 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return c.json({ error: 'Invalid code format' }, 400);
  }

  const storeKey = `${brandId}:${email}`;
  const entry = otpStore.get(storeKey);

  const GENERIC_OTP_ERROR = 'Invalid or expired verification code';

  if (!entry) {
    return c.json({ error: GENERIC_OTP_ERROR }, 400);
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(storeKey);
    return c.json({ error: GENERIC_OTP_ERROR }, 400);
  }

  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(storeKey);
    return c.json({ error: 'Too many attempts. Please request a new code.' }, 429);
  }

  entry.attempts += 1;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(entry.code),
    Buffer.from(code),
  );
  if (!isValid) {
    return c.json({ error: GENERIC_OTP_ERROR }, 400);
  }

  otpStore.delete(storeKey);

  const consumer = await prisma.portalConsumer.upsert({
    where: {
      tenantId_brandId_email: {
        tenantId: entry.tenantId,
        brandId,
        email,
      },
    },
    update: {
      emailVerified: true,
      lastLoginAt: new Date(),
    },
    create: {
      tenantId: entry.tenantId,
      brandId,
      email,
      emailVerified: true,
      lastLoginAt: new Date(),
    },
  });

  const token = await signPortalToken({
    consumerId: consumer.id,
    brandId,
    tenantId: entry.tenantId,
    email,
  });

  return c.json({
    token,
    consumer: {
      id: consumer.id,
      email: consumer.email,
      name: consumer.name,
      locale: consumer.locale,
    },
  });
});
