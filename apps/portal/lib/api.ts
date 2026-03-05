import type {
  ProductSummary,
  CommodityDetail,
  FAQ,
  CommodityMedia,
  ListingSummary,
} from './types';

const API_BASE = process.env.PORTAL_API_URL ?? 'http://localhost:3000/portal';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUUID(value: string, label: string): void {
  if (!UUID_RE.test(value)) throw new Error(`Invalid ${label}: not a valid UUID`);
}

class PortalAPIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PortalAPIError';
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
  if (init?.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new PortalAPIError(res.status, body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function fetchProducts(
  brandId: string,
  cursor?: string,
): Promise<{ products: ProductSummary[]; nextCursor: string | null }> {
  assertUUID(brandId, 'brandId');
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return fetchJSON(`/brands/${brandId}/products${qs ? `?${qs}` : ''}`, {
    next: { revalidate: 300 },
  });
}

export async function fetchCommodity(commodityId: string): Promise<CommodityDetail> {
  assertUUID(commodityId, 'commodityId');
  return fetchJSON(`/commodities/${commodityId}`, {
    next: { revalidate: 300 },
  });
}

export async function fetchFAQs(
  commodityId: string,
  query?: string,
  category?: string,
): Promise<{ faqs: FAQ[] }> {
  assertUUID(commodityId, 'commodityId');
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  const qs = params.toString();
  return fetchJSON(`/commodities/${commodityId}/faqs${qs ? `?${qs}` : ''}`, {
    next: query || category ? undefined : { revalidate: 600 },
    cache: query || category ? 'no-store' : undefined,
  });
}

export async function fetchMedia(commodityId: string): Promise<{ media: CommodityMedia[] }> {
  assertUUID(commodityId, 'commodityId');
  return fetchJSON(`/commodities/${commodityId}/media`, {
    next: { revalidate: 600 },
  });
}

export async function fetchListings(commodityId: string): Promise<{ listings: ListingSummary[] }> {
  assertUUID(commodityId, 'commodityId');
  return fetchJSON(`/commodities/${commodityId}/listings`, {
    next: { revalidate: 120 },
  });
}

const VALID_QR_SOURCES = new Set(['package', 'manual', 'warranty_card', 'colorbox', 'web', 'email', 'social']);

export async function recordQRScan(
  commodityId: string,
  source: string,
): Promise<void> {
  assertUUID(commodityId, 'commodityId');
  const safeSource = VALID_QR_SOURCES.has(source) ? source : 'unknown';
  await fetchJSON('/qr-scan', {
    method: 'POST',
    body: JSON.stringify({ commodityId, source: safeSource }),
    cache: 'no-store',
  });
}

export { UUID_RE };
