import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { prisma } from './db.js';
import { portalAuth, type PortalAuthContext, signSSEToken, verifySSEToken } from './portal-auth.js';
import { handleConsumerMessage, handleMediaAnalysis, escalateToHuman } from './portal-agent.js';
import { chatSSEManager } from './chat-sse-manager.js';
import { parsePageSize } from './pagination.js';
import { isValidUUID } from './validation.js';

type PortalEnv = { Variables: { portalAuth: PortalAuthContext } };

// Per-consumer rate limiting for AI-triggering endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

// P2-3: Periodic cleanup of expired rate-limit entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

// P2-4: IP-based rate limiting for public endpoints (e.g. /qr-scan)
const publicRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_RATE_LIMIT_MAX = 30;

function checkPublicRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = publicRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    publicRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= PUBLIC_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of publicRateLimitMap) {
    if (now > entry.resetAt) publicRateLimitMap.delete(key);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

const ALLOWED_CONTENT_TYPES = new Set(['text', 'image', 'video']);
const ALLOWED_PURCHASE_CHANNELS = new Set(['amazon', 'official', 'retail', 'other']);
const MAX_TEXT_LENGTH = 5000;
const MAX_SHORT_TEXT = 255;

function isValidDate(v: string): boolean {
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100;
}

const app = new Hono();

// ============================================
// Public routes (no auth required)
// ============================================

app.get('/resolve', async (c) => {
  const domain = c.req.query('domain');
  if (!domain || domain.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'domain query parameter is required' }, 400);
  }

  const config = await prisma.brandPortalConfig.findUnique({
    where: { customDomain: domain },
    include: {
      brand: { select: { id: true, code: true, name: true, description: true } },
    },
  });

  if (!config || !config.isActive) {
    return c.json({ error: 'Portal not found for this domain' }, 404);
  }

  return c.json({
    brandId: config.brand.id,
    brandCode: config.brand.code,
    brandName: config.brand.name,
    themeId: config.themeId,
    logoUrl: config.logoUrl,
    faviconUrl: config.faviconUrl,
    seoTitle: config.seoTitle,
    seoDescription: config.seoDescription,
    primaryColor: config.primaryColor,
    welcomeMessage: config.welcomeMessage,
    supportEmail: config.supportEmail,
  });
});

app.get('/brands/:brandId/products', async (c) => {
  const { brandId } = c.req.param();
  if (!isValidUUID(brandId)) return c.json({ error: 'Invalid brandId' }, 400);

  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, tenantId: true },
  });
  if (!brand) return c.json({ error: 'Brand not found' }, 404);

  const products = await prisma.product.findMany({
    where: { brandId, tenantId: brand.tenantId },
    select: {
      id: true,
      sku: true,
      name: true,
      imageUrls: true,
      category: { select: { id: true, name: true } },
      commodities: {
        select: {
          id: true,
          marketId: true,
          language: true,
          title: true,
          warrantyPeriodMonths: true,
        },
      },
    },
    orderBy: { name: 'asc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = products.length > limit;
  const items = hasMore ? products.slice(0, limit) : products;

  return c.json({
    products: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

app.get('/commodities/:id', async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid commodity id' }, 400);

  const commodity = await prisma.commodity.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          imageUrls: true,
          structuredFeatures: true,
          scenarios: true,
          targetIntents: true,
          competitiveEdges: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true, code: true } },
        },
      },
      market: { select: { id: true, code: true, name: true, currency: true } },
      media: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);

  return c.json({
    id: commodity.id,
    title: commodity.title,
    bulletPoints: commodity.bulletPoints,
    language: commodity.language,
    warrantyPeriodMonths: commodity.warrantyPeriodMonths,
    localSupportContact: commodity.localSupportContact,
    product: commodity.product,
    market: commodity.market,
    media: commodity.media,
  });
});

// TODO(perf): Add pg_trgm GIN indexes on ConsumerFAQ.question and ConsumerFAQ.answer for ILIKE search
app.get('/commodities/:id/faqs', async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid commodity id' }, 400);

  const commodity = await prisma.commodity.findUnique({
    where: { id },
    select: { id: true, tenantId: true, product: { select: { brandId: true } } },
  });
  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);

  const q = c.req.query('q')?.trim().slice(0, 200) ?? '';
  const category = c.req.query('category')?.trim() ?? '';

  const baseWhere = {
    tenantId: commodity.tenantId,
    brandId: commodity.product.brandId,
    isActive: true,
    OR: [
      { commodityId: id },
      { commodityId: null },
    ],
  };

  const searchFilter = q
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { question: { contains: q, mode: 'insensitive' as const } },
              { answer: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const categoryFilter = category
    ? { ...searchFilter, category }
    : searchFilter;

  const faqs = await prisma.consumerFAQ.findMany({
    where: categoryFilter,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      question: true,
      answer: true,
      category: true,
      commodityId: true,
    },
  });

  return c.json({ faqs });
});

app.get('/commodities/:id/media', async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid commodity id' }, 400);

  const media = await prisma.commodityMedia.findMany({
    where: { commodityId: id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      type: true,
      title: true,
      url: true,
      platform: true,
      language: true,
      aiSummary: true,
      duration: true,
    },
  });

  return c.json({ media });
});

app.get('/commodities/:id/listings', async (c) => {
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid commodity id' }, 400);

  const listings = await prisma.listing.findMany({
    where: { commodityId: id, isPrimary: true, status: 'ACTIVE' },
    select: {
      id: true,
      externalListingId: true,
      title: true,
      isPrimary: true,
      platform: { select: { id: true, code: true, name: true } },
    },
  });

  return c.json({ listings });
});

app.post('/qr-scan', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkPublicRateLimit(ip)) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  const body = await c.req.json<{
    commodityId: string;
    source: string;
    userAgent?: string;
    ipCountry?: string;
  }>();

  if (!body.commodityId || !body.source) {
    return c.json({ error: 'commodityId and source are required' }, 400);
  }
  if (!isValidUUID(body.commodityId)) {
    return c.json({ error: 'Invalid commodityId' }, 400);
  }
  if (body.source.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'source too long' }, 400);
  }

  const commodity = await prisma.commodity.findUnique({
    where: { id: body.commodityId },
    select: { id: true, tenantId: true },
  });
  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);

  await prisma.qRScanEvent.create({
    data: {
      tenantId: commodity.tenantId,
      commodityId: body.commodityId,
      source: body.source,
      userAgent: body.userAgent ?? c.req.header('User-Agent') ?? null,
      ipCountry: body.ipCountry ?? null,
    },
  });

  return c.json({ success: true });
});

// ============================================
// Authenticated routes (consumer JWT required)
// ============================================

const authed = new Hono<PortalEnv>();
authed.use('*', portalAuth);

authed.get('/me', async (c) => {
  const auth = c.get('portalAuth');
  const consumer = await prisma.portalConsumer.findUnique({
    where: { id: auth.consumerId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      locale: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!consumer) return c.json({ error: 'Consumer not found' }, 404);
  return c.json({ consumer });
});

// --- Warranties ---

authed.post('/warranties', async (c) => {
  const auth = c.get('portalAuth');
  const body = await c.req.json<{
    commodityId: string;
    serialNumber: string;
    purchaseDate: string;
    purchaseChannel: string;
  }>();

  if (!body.commodityId || !body.serialNumber || !body.purchaseDate || !body.purchaseChannel) {
    return c.json({ error: 'commodityId, serialNumber, purchaseDate, and purchaseChannel are required' }, 400);
  }
  if (!isValidUUID(body.commodityId)) {
    return c.json({ error: 'Invalid commodityId' }, 400);
  }
  if (body.serialNumber.length > MAX_SHORT_TEXT || body.serialNumber.length < 1) {
    return c.json({ error: 'Invalid serialNumber length' }, 400);
  }
  if (!isValidDate(body.purchaseDate)) {
    return c.json({ error: 'Invalid purchaseDate format' }, 400);
  }
  if (!ALLOWED_PURCHASE_CHANNELS.has(body.purchaseChannel)) {
    return c.json({ error: `purchaseChannel must be one of: ${[...ALLOWED_PURCHASE_CHANNELS].join(', ')}` }, 400);
  }

  const commodity = await prisma.commodity.findUnique({
    where: { id: body.commodityId },
    select: { id: true, tenantId: true, warrantyPeriodMonths: true },
  });
  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);
  if (commodity.tenantId !== auth.tenantId) return c.json({ error: 'Access denied' }, 403);

  const existing = await prisma.warrantyRegistration.findUnique({
    where: { tenantId_serialNumber: { tenantId: auth.tenantId, serialNumber: body.serialNumber } },
  });
  if (existing) return c.json({ error: 'Serial number already registered' }, 409);

  const purchaseDate = new Date(body.purchaseDate);
  const warrantyMonths = commodity.warrantyPeriodMonths ?? 12;
  const expiryDate = new Date(purchaseDate);
  expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);

  const warranty = await prisma.warrantyRegistration.create({
    data: {
      tenantId: auth.tenantId,
      consumerId: auth.consumerId,
      commodityId: body.commodityId,
      serialNumber: body.serialNumber,
      purchaseDate,
      purchaseChannel: body.purchaseChannel,
      expiryDate,
    },
  });

  return c.json({ warranty }, 201);
});

authed.get('/warranties', async (c) => {
  const auth = c.get('portalAuth');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  const warranties = await prisma.warrantyRegistration.findMany({
    where: { tenantId: auth.tenantId, consumerId: auth.consumerId },
    include: {
      commodity: {
        select: { id: true, title: true, product: { select: { name: true, imageUrls: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = warranties.length > limit;
  const items = hasMore ? warranties.slice(0, limit) : warranties;

  return c.json({
    warranties: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

authed.get('/warranties/:id', async (c) => {
  const auth = c.get('portalAuth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid warranty id' }, 400);

  const warranty = await prisma.warrantyRegistration.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    include: {
      commodity: {
        select: { id: true, title: true, product: { select: { name: true, imageUrls: true } } },
      },
    },
  });
  if (!warranty) return c.json({ error: 'Warranty not found' }, 404);
  return c.json({ warranty });
});

// --- Support Cases ---

authed.post('/cases', async (c) => {
  const auth = c.get('portalAuth');

  if (!checkRateLimit(auth.consumerId)) {
    return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
  }

  const body = await c.req.json<{
    commodityId: string;
    issueType?: string;
    description: string;
  }>();

  if (!body.commodityId || !body.description) {
    return c.json({ error: 'commodityId and description are required' }, 400);
  }
  if (!isValidUUID(body.commodityId)) {
    return c.json({ error: 'Invalid commodityId' }, 400);
  }
  if (body.description.length > MAX_TEXT_LENGTH) {
    return c.json({ error: 'description too long' }, 400);
  }
  if (body.issueType && body.issueType.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'issueType too long' }, 400);
  }

  const commodity = await prisma.commodity.findUnique({
    where: { id: body.commodityId },
    select: { id: true, tenantId: true },
  });
  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);
  if (commodity.tenantId !== auth.tenantId) return c.json({ error: 'Access denied' }, 403);

  const supportCase = await prisma.supportCase.create({
    data: {
      tenantId: auth.tenantId,
      consumerId: auth.consumerId,
      commodityId: body.commodityId,
      issueType: body.issueType,
      channel: 'portal',
      messages: {
        create: {
          tenantId: auth.tenantId,
          role: 'consumer',
          contentType: 'text',
          content: body.description,
        },
      },
    },
    include: { messages: true },
  });

  handleConsumerMessage(supportCase.id, auth.tenantId).catch((err) => {
    console.error(`[Portal] Agent processing failed for new case ${supportCase.id}:`, err instanceof Error ? err.message : 'unknown');
  });

  return c.json({ case: supportCase }, 201);
});

authed.get('/cases', async (c) => {
  const auth = c.get('portalAuth');
  const status = c.req.query('status');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  const cases = await prisma.supportCase.findMany({
    where: {
      tenantId: auth.tenantId,
      consumerId: auth.consumerId,
      ...(status ? { status } : {}),
    },
    include: {
      commodity: { select: { id: true, title: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = cases.length > limit;
  const items = hasMore ? cases.slice(0, limit) : cases;

  return c.json({
    cases: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

authed.get('/cases/:id', async (c) => {
  const auth = c.get('portalAuth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    include: {
      commodity: {
        select: { id: true, title: true, product: { select: { name: true, imageUrls: true } } },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  return c.json({ case: supportCase });
});

authed.post('/cases/:id/messages', async (c) => {
  const auth = c.get('portalAuth');

  if (!checkRateLimit(auth.consumerId)) {
    return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
  }

  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const body = await c.req.json<{
    content: string;
    contentType?: string;
  }>();

  if (!body.content) return c.json({ error: 'content is required' }, 400);
  if (body.content.length > MAX_TEXT_LENGTH) {
    return c.json({ error: 'content too long' }, 400);
  }

  const contentType = body.contentType ?? 'text';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return c.json({ error: `contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(', ')}` }, 400);
  }

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    select: { id: true, status: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  if (supportCase.status === 'closed') return c.json({ error: 'Case is closed' }, 400);

  const message = await prisma.caseMessage.create({
    data: {
      tenantId: auth.tenantId,
      caseId: id,
      role: 'consumer',
      contentType,
      content: body.content,
    },
  });

  if (supportCase.status !== 'human_escalated') {
    handleConsumerMessage(id, auth.tenantId).catch((err) => {
      console.error(`[Portal] Agent processing failed for case ${id}:`, err instanceof Error ? err.message : 'unknown');
    });
  }

  return c.json({ message }, 201);
});

// --- SSE Token (short-lived, one-time) ---

authed.post('/cases/:id/sse-token', async (c) => {
  const auth = c.get('portalAuth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    select: { id: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);

  const token = await signSSEToken({
    consumerId: auth.consumerId,
    tenantId: auth.tenantId,
    caseId: id,
  });

  return c.json({ token });
});

// --- SSE Stream ---

// SSE uses short-lived token via query param since EventSource doesn't support custom headers
app.get('/cases/:id/stream', async (c) => {
  const token = c.req.query('token');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);
  if (!token) return c.json({ error: 'token query parameter is required' }, 401);

  let consumerId: string;
  let tenantId: string;

  try {
    const payload = await verifySSEToken(token);
    if (payload.caseId !== id) {
      return c.json({ error: 'Token does not match this case' }, 403);
    }
    consumerId = payload.cid;
    tenantId = payload.tid;
  } catch {
    return c.json({ error: 'Invalid or expired SSE token' }, 401);
  }

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId, consumerId },
    select: { id: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);

  const connId = crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    chatSSEManager.register({
      id: connId,
      caseId: id,
      consumerId,
      send: (event, data) => {
        void stream.writeSSE({ event, data, id: crypto.randomUUID() });
      },
      close: () => stream.close(),
    });

    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ connId, caseId: id }),
      id: crypto.randomUUID(),
    });

    stream.onAbort(() => {
      chatSSEManager.unregister(connId, id);
    });

    let aborted = false;
    stream.onAbort(() => { aborted = true; });

    while (!aborted) {
      try {
        await stream.writeSSE({ event: 'ping', data: '', id: crypto.randomUUID() });
      } catch {
        break;
      }
      await stream.sleep(15000);
    }
  });
});

// --- Media Upload ---

const MAX_MEDIA_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

authed.post('/cases/:id/media', async (c) => {
  const auth = c.get('portalAuth');

  if (!checkRateLimit(auth.consumerId)) {
    return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
  }

  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    select: { id: true, status: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  if (supportCase.status === 'closed') return c.json({ error: 'Case is closed' }, 400);

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'file is required (multipart/form-data)' }, 400);
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    return c.json({ error: `Unsupported file type. Allowed: ${[...ALLOWED_MEDIA_TYPES].join(', ')}` }, 400);
  }

  if (file.size > MAX_MEDIA_SIZE) {
    return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const MAGIC_BYTES: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
    'image/gif': [0x47, 0x49, 0x46],
    'video/mp4': [], // ftyp at offset 4
    'video/webm': [0x1A, 0x45, 0xDF, 0xA3],
    'video/quicktime': [], // ftyp at offset 4
  };

  const expected = MAGIC_BYTES[file.type];
  if (expected && expected.length > 0) {
    const match = expected.every((b, i) => bytes[i] === b);
    if (!match) {
      return c.json({ error: 'File content does not match declared type' }, 400);
    }
  }
  if ((file.type === 'video/mp4' || file.type === 'video/quicktime') && bytes.length >= 8) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp !== 'ftyp') {
      return c.json({ error: 'File content does not match declared type' }, 400);
    }
  }

  const base64 = Buffer.from(buffer).toString('base64');
  const sourceType = file.type.startsWith('video/') ? 'video' : 'image';

  try {
    const { analysisId } = await handleMediaAnalysis(
      id,
      auth.tenantId,
      base64,
      file.type,
      sourceType,
    );
    return c.json({ analysisId, sourceType }, 201);
  } catch (err) {
    console.error(`[Portal] Media analysis failed for case ${id}:`, err instanceof Error ? err.message : 'unknown');
    return c.json({ error: 'Media analysis failed. Please try again.' }, 500);
  }
});

// --- Human Escalation ---

authed.post('/cases/:id/escalate', async (c) => {
  const auth = c.get('portalAuth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    select: { id: true, status: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  if (supportCase.status === 'human_escalated') {
    return c.json({ message: 'Already escalated to human support' });
  }
  if (supportCase.status === 'closed') return c.json({ error: 'Case is closed' }, 400);

  await escalateToHuman(id, auth.tenantId, 0);

  return c.json({ message: 'Escalated to human support' });
});

// --- Case Resolution Feedback (Consumer 👍/👎) ---

authed.post('/cases/:id/feedback', async (c) => {
  const auth = c.get('portalAuth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  if (!checkRateLimit(`feedback:${auth.consumerId}`)) {
    return c.json({ error: 'Too many requests. Try again later.' }, 429);
  }

  const body = await c.req.json<{ resolved: boolean }>();
  if (typeof body.resolved !== 'boolean') {
    return c.json({ error: 'resolved (boolean) is required' }, 400);
  }

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId, consumerId: auth.consumerId },
    select: { id: true, status: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);

  const existing = await prisma.feedbackSignal.findFirst({
    where: { tenantId: auth.tenantId, caseId: id, sourceRole: 'consumer', type: 'resolved' },
    select: { id: true },
  });
  if (existing) {
    return c.json({ error: 'Feedback already submitted for this case' }, 409);
  }

  const signal = await prisma.feedbackSignal.create({
    data: {
      tenantId: auth.tenantId,
      type: 'resolved',
      sourceRole: 'consumer',
      priorityClass: 'EXPERIENCE',
      caseId: id,
      agentAction: 'chat_reply',
      rating: body.resolved ? 5 : 1,
      reason: body.resolved ? 'Consumer confirmed resolved' : 'Consumer reported unresolved',
    },
  });

  if (!body.resolved && supportCase.status !== 'human_escalated' && supportCase.status !== 'closed') {
    void escalateToHuman(id, auth.tenantId, 0);
  }

  return c.json({ signal }, 201);
});

// --- Product Feedback ---

authed.post('/feedbacks', async (c) => {
  const auth = c.get('portalAuth');
  const body = await c.req.json<{
    commodityId: string;
    feedbackType: string;
    title: string;
    detail: string;
  }>();

  if (!body.commodityId || !body.feedbackType || !body.title || !body.detail) {
    return c.json({ error: 'commodityId, feedbackType, title, and detail are required' }, 400);
  }
  if (!isValidUUID(body.commodityId)) {
    return c.json({ error: 'Invalid commodityId' }, 400);
  }
  if (body.title.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'title too long' }, 400);
  }
  if (body.detail.length > MAX_TEXT_LENGTH) {
    return c.json({ error: 'detail too long' }, 400);
  }
  if (body.feedbackType.length > MAX_SHORT_TEXT) {
    return c.json({ error: 'feedbackType too long' }, 400);
  }

  const commodity = await prisma.commodity.findUnique({
    where: { id: body.commodityId },
    select: { id: true, tenantId: true },
  });
  if (!commodity) return c.json({ error: 'Commodity not found' }, 404);
  if (commodity.tenantId !== auth.tenantId) return c.json({ error: 'Access denied' }, 403);

  const feedback = await prisma.productFeedback.create({
    data: {
      tenantId: auth.tenantId,
      consumerId: auth.consumerId,
      commodityId: body.commodityId,
      feedbackType: body.feedbackType,
      title: body.title,
      detail: body.detail,
    },
  });

  return c.json({ feedback }, 201);
});

// --- FAQ Feedback (helpful / not helpful) ---

authed.post('/faqs/:faqId/feedback', async (c) => {
  const auth = c.get('portalAuth');
  const { faqId } = c.req.param();
  if (!isValidUUID(faqId)) return c.json({ error: 'Invalid faqId' }, 400);

  if (!checkRateLimit(`faq-feedback:${auth.consumerId}`)) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  const body = await c.req.json<{ helpful: boolean }>();
  if (typeof body.helpful !== 'boolean') {
    return c.json({ error: 'helpful (boolean) is required' }, 400);
  }

  const faq = await prisma.consumerFAQ.findUnique({
    where: { id: faqId },
    select: { id: true, tenantId: true, question: true },
  });
  if (!faq) return c.json({ error: 'FAQ not found' }, 404);
  if (faq.tenantId !== auth.tenantId) return c.json({ error: 'Access denied' }, 403);

  const intentKey = `consumer:${auth.consumerId}`;
  const agentAction = `faq:${faqId}`;
  const existing = await prisma.feedbackSignal.findFirst({
    where: {
      tenantId: auth.tenantId,
      sourceRole: 'consumer',
      agentAction,
      intentId: intentKey,
    },
  });
  if (existing) {
    return c.json({ error: 'Already submitted feedback for this FAQ' }, 409);
  }

  let signal;
  try {
    signal = await prisma.feedbackSignal.create({
      data: {
        tenantId: auth.tenantId,
        type: body.helpful ? 'accept' : 'reject',
        sourceRole: 'consumer',
        agentAction,
        intentId: intentKey,
        reason: body.helpful ? 'FAQ marked helpful' : 'FAQ marked not helpful',
        metadata: {
          faqId,
          faqQuestion: faq.question,
        },
      },
    });
  } catch (e: unknown) {
    const isUniqueViolation = e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002';
    if (isUniqueViolation) {
      return c.json({ error: 'Already submitted feedback for this FAQ' }, 409);
    }
    throw e;
  }

  if (!body.helpful) {
    void accelerateFaqDecay(faq.tenantId, faqId);
  }

  return c.json({ signal: { id: signal.id } }, 201);
});

app.route('/', authed);

export { app as portalRoutes };

async function accelerateFaqDecay(tenantId: string, faqId: string): Promise<void> {
  try {
    const linked = await prisma.knowledgeEntry.findMany({
      where: {
        tenantId,
        source: 'faq',
        sourceRef: faqId,
        status: { in: ['ACTIVE', 'DECAYING'] },
      },
      select: { id: true, decayRate: true, impactScore: true },
    });

    if (linked.length === 0) return;

    await prisma.$transaction(
      linked.map(({ id, decayRate, impactScore }) =>
        prisma.knowledgeEntry.update({
          where: { id },
          data: {
            decayRate: Math.min(decayRate * 1.5, 0.1),
            impactScore: Math.max(0, impactScore - 0.1),
          },
        }),
      ),
    );
  } catch (e) {
    console.error('[FAQ:Decay] Failed to accelerate decay:', e instanceof Error ? e.message : 'unknown');
  }
}
