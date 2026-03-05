import { NextRequest, NextResponse } from 'next/server';
import type { BrandPortalConfig } from '@/lib/types';

const API_BASE = process.env.PORTAL_API_URL ?? 'http://localhost:3000/portal';
const DEFAULT_BRAND_ID = process.env.DEFAULT_BRAND_ID ?? '';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const MAX_DOMAIN_LENGTH = 253;
const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const NEG_CACHE_TTL_MS = 30 * 1000;

interface CacheEntry {
  data: BrandPortalConfig | null;
  expiresAt: number;
}

const configCache = new Map<string, CacheEntry>();

function evictIfNeeded() {
  if (configCache.size < MAX_CACHE_SIZE) return;
  const firstKey = configCache.keys().next().value;
  if (firstKey) configCache.delete(firstKey);
}

async function resolveByDomain(domain: string): Promise<BrandPortalConfig | null> {
  const cached = configCache.get(domain);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const res = await fetch(`${API_BASE}/resolve?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) {
      evictIfNeeded();
      configCache.set(domain, { data: null, expiresAt: Date.now() + NEG_CACHE_TTL_MS });
      return null;
    }
    const data = (await res.json()) as BrandPortalConfig;
    evictIfNeeded();
    configCache.set(domain, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return null;
  }
}

function isValidDomain(domain: string): boolean {
  return domain.length > 0 && domain.length <= MAX_DOMAIN_LENGTH && DOMAIN_RE.test(domain);
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const host = request.headers.get('host') ?? '';
  const isLocalhost = LOCALHOST_RE.test(host);

  let brandConfig: BrandPortalConfig | null = null;

  if (!isLocalhost) {
    const domain = host.split(':')[0];
    if (isValidDomain(domain)) {
      brandConfig = await resolveByDomain(domain);
    }
  }

  if (!brandConfig && isLocalhost) {
    const brandParam = searchParams.get('brand');
    if (brandParam && isValidDomain(brandParam)) {
      brandConfig = await resolveByDomain(`__dev_brand_${brandParam}`);
    }
  }

  const response = NextResponse.next();

  if (brandConfig) {
    response.headers.set('x-portal-brand-id', brandConfig.brandId);
    response.headers.set('x-portal-brand-code', brandConfig.brandCode);
    response.headers.set('x-portal-brand-name', brandConfig.brandName);
    response.headers.set('x-portal-theme-id', brandConfig.themeId);
    if (brandConfig.logoUrl) response.headers.set('x-portal-logo-url', brandConfig.logoUrl);
    if (brandConfig.seoTitle) response.headers.set('x-portal-seo-title', brandConfig.seoTitle);
    if (brandConfig.seoDescription) response.headers.set('x-portal-seo-description', brandConfig.seoDescription);
    if (brandConfig.welcomeMessage) response.headers.set('x-portal-welcome-message', brandConfig.welcomeMessage);
    if (brandConfig.supportEmail) response.headers.set('x-portal-support-email', brandConfig.supportEmail);
    if (brandConfig.primaryColor) response.headers.set('x-portal-primary-color', brandConfig.primaryColor);
    if (brandConfig.faviconUrl) response.headers.set('x-portal-favicon-url', brandConfig.faviconUrl);
  } else if (DEFAULT_BRAND_ID) {
    response.headers.set('x-portal-brand-id', DEFAULT_BRAND_ID);
    response.headers.set('x-portal-theme-id', 'editorial');
    response.headers.set('x-portal-brand-name', 'NOVA');
    response.headers.set('x-portal-brand-code', 'nova');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|api|favicon\\.ico|.*\\.).*)'],
};
