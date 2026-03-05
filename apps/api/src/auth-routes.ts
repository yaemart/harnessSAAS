import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { env } from './env.js';
import {
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  type Role,
} from './jwt-auth.js';

const auth = new Hono();

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const computed = hashPassword(password, salt);
  const computedBuf = Buffer.from(computed);
  const hashBuf = Buffer.from(hash);
  if (computedBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, hashBuf);
}

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  if (!body?.email || !body?.password) {
    return c.json({ error: 'email and password required' }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: { scopes: true },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    return c.json({ error: 'invalid credentials' }, 401);
  }

  // passwordHash format: "salt:hash"
  const [salt, hash] = user.passwordHash.split(':');
  if (!salt || !hash || !verifyPassword(body.password, salt, hash)) {
    return c.json({ error: 'invalid credentials' }, 401);
  }

  const scopes = user.scopes.map((s) => `${s.scopeType}:${s.scopeValue}`);

  const accessToken = await signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
    scopes,
  });

  const refresh = await createRefreshToken(user.id, user.tenantId);

  setCookie(c, 'refresh_token', refresh.token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      scopes,
    },
  });
});

auth.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token');
  if (!refreshToken) {
    return c.json({ error: 'no refresh token' }, 401);
  }

  const result = await rotateRefreshToken(refreshToken);
  if (!result) {
    setCookie(c, 'refresh_token', '', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/auth/refresh',
      maxAge: 0,
    });
    return c.json({ error: 'invalid or expired refresh token' }, 401);
  }

  setCookie(c, 'refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({ accessToken: result.accessToken });
});

auth.get('/me', async (c) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  try {
    const payload = await verifyAccessToken(authHeader.slice(7));
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
      include: { scopes: true },
    });
    if (!user) return c.json({ error: 'user not found' }, 404);

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      scopes: user.scopes.map((s) => `${s.scopeType}:${s.scopeValue}`),
    });
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }
});

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyAccessToken(authHeader.slice(7));
      if (payload.sub) {
        await revokeAllUserTokens(payload.sub);
      }
    } catch {
      // token may be expired, still clear cookie
    }
  }

  setCookie(c, 'refresh_token', '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/auth/refresh',
    maxAge: 0,
  });

  return c.json({ ok: true });
});

export { auth as authRoutes };
