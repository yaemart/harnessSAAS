import crypto from 'node:crypto';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload as JoseJWTPayload } from 'jose';
import { prisma } from './db.js';
import { env } from './env.js';

export type Role = 'system_admin' | 'tenant_admin' | 'operator' | 'supplier' | 'viewer';

export interface HarnessJWTPayload extends JoseJWTPayload {
  sub: string;
  tid: string;
  role: Role;
  scopes: string[];
}

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

const JWT_ALGORITHM = env.JWT_PRIVATE_KEY ? 'RS256' : 'HS256';

async function getSigningKey() {
  if (env.JWT_PRIVATE_KEY) {
    return importPKCS8(env.JWT_PRIVATE_KEY, 'RS256');
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

async function getVerifyKey() {
  if (env.JWT_PUBLIC_KEY) {
    return importSPKI(env.JWT_PUBLIC_KEY, 'RS256');
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(payload: {
  userId: string;
  tenantId: string;
  role: Role;
  scopes: string[];
}): Promise<string> {
  const key = await getSigningKey();
  return new SignJWT({
    tid: payload.tenantId,
    role: payload.role,
    scopes: payload.scopes,
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(payload.userId)
    .setIssuer('harness-auth')
    .setAudience('harness-api')
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setJti(crypto.randomUUID())
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<HarnessJWTPayload> {
  const key = await getVerifyKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: 'harness-auth',
    audience: 'harness-api',
  });
  return payload as HarnessJWTPayload;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(userId: string, tenantId: string, familyId?: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  const fid = familyId ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tenantId,
      tokenHash,
      familyId: fid,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function rotateRefreshToken(oldToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} | null> {
  const oldHash = hashToken(oldToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: oldHash },
    include: { user: { include: { scopes: true } } },
  });

  if (!existing) return null;

  // Token already revoked → family compromise detected, revoke entire family
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (existing.expiresAt < new Date()) return null;
  if (!existing.user.isActive) return null;

  const newRefresh = await createRefreshToken(
    existing.userId,
    existing.tenantId,
    existing.familyId,
  );

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: {
      revokedAt: new Date(),
      replacedById: hashToken(newRefresh.token).slice(0, 16),
    },
  });

  const scopes = existing.user.scopes.map(
    (s) => `${s.scopeType}:${s.scopeValue}`,
  );

  const accessToken = await signAccessToken({
    userId: existing.userId,
    tenantId: existing.tenantId,
    role: existing.user.role as Role,
    scopes,
  });

  return {
    accessToken,
    refreshToken: newRefresh.token,
    expiresAt: newRefresh.expiresAt,
  };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
