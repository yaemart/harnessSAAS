import { Hono } from 'hono';
import { prisma } from './db.js';
import { requireRole, type AuthContext } from './auth-middleware.js';
import { parsePageSize } from './pagination.js';
import { isValidUUID, isValidUrl, clampInt } from './validation.js';

type Env = { Variables: { auth: AuthContext } };

const app = new Hono<Env>();

const MAX_TEXT_LENGTH = 2000;
const MAX_FAQ_TEXT_LENGTH = 10_000;

const ALLOWED_THEMES = new Set([
  'editorial', 'minimal', 'modern', 'classic', 'dark', 'terminal', 'cyberpunk', 'brutalism',
]);

function sanitizeConfigFields(body: Record<string, unknown>) {
  return {
    themeId: typeof body.themeId === 'string' && ALLOWED_THEMES.has(body.themeId) ? body.themeId : undefined,
    customDomain: typeof body.customDomain === 'string' ? body.customDomain.slice(0, 255) : (body.customDomain === null ? null : undefined),
    logoUrl: typeof body.logoUrl === 'string' && isValidUrl(body.logoUrl) ? body.logoUrl.slice(0, 500) : (body.logoUrl === null ? null : undefined),
    faviconUrl: typeof body.faviconUrl === 'string' && isValidUrl(body.faviconUrl) ? body.faviconUrl.slice(0, 500) : (body.faviconUrl === null ? null : undefined),
    seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.slice(0, 200) : (body.seoTitle === null ? null : undefined),
    seoDescription: typeof body.seoDescription === 'string' ? body.seoDescription.slice(0, 500) : (body.seoDescription === null ? null : undefined),
    primaryColor: typeof body.primaryColor === 'string' ? body.primaryColor.slice(0, 20) : (body.primaryColor === null ? null : undefined),
    welcomeMessage: typeof body.welcomeMessage === 'string' ? body.welcomeMessage.slice(0, MAX_TEXT_LENGTH) : (body.welcomeMessage === null ? null : undefined),
    supportEmail: typeof body.supportEmail === 'string' ? body.supportEmail.slice(0, 255) : (body.supportEmail === null ? null : undefined),
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };
}

app.use('*', requireRole('system_admin', 'tenant_admin'));

// ─── Portal Configs ───

app.get('/configs', async (c) => {
  const auth = c.get('auth');
  const configs = await prisma.brandPortalConfig.findMany({
    where: { tenantId: auth.tenantId },
    include: { brand: { select: { id: true, name: true, code: true } } },
    orderBy: { brand: { name: 'asc' } },
  });
  return c.json({ configs });
});

app.get('/configs/:brandId', async (c) => {
  const auth = c.get('auth');
  const { brandId } = c.req.param();
  if (!isValidUUID(brandId)) return c.json({ error: 'Invalid brand id' }, 400);

  const config = await prisma.brandPortalConfig.findFirst({
    where: { tenantId: auth.tenantId, brandId },
    include: { brand: { select: { id: true, name: true, code: true } } },
  });
  if (!config) return c.json({ error: 'Portal config not found' }, 404);
  return c.json({ config });
});

app.put('/configs/:brandId', async (c) => {
  const auth = c.get('auth');
  const { brandId } = c.req.param();
  if (!isValidUUID(brandId)) return c.json({ error: 'Invalid brand id' }, 400);

  // P1-1: Verify brand belongs to current tenant
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!brand) return c.json({ error: 'Brand not found in your tenant' }, 404);

  const body = await c.req.json();
  const fields = sanitizeConfigFields(body);

  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );

  const config = await prisma.brandPortalConfig.upsert({
    where: { brandId },
    create: {
      tenantId: auth.tenantId,
      brandId,
      themeId: fields.themeId ?? 'editorial',
      ...defined,
    },
    update: defined,
    include: { brand: { select: { id: true, name: true, code: true } } },
  });

  return c.json({ config });
});

// ─── FAQ Management ───

app.get('/faqs', async (c) => {
  const auth = c.get('auth');
  const brandId = c.req.query('brandId');
  const commodityId = c.req.query('commodityId');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  const where = {
    tenantId: auth.tenantId,
    ...(brandId && isValidUUID(brandId) ? { brandId } : {}),
    ...(commodityId && isValidUUID(commodityId) ? { commodityId } : {}),
  };

  const faqs = await prisma.consumerFAQ.findMany({
    where,
    include: {
      brand: { select: { id: true, name: true } },
      commodity: { select: { id: true, title: true } },
    },
    orderBy: [{ brandId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = faqs.length > limit;
  const items = hasMore ? faqs.slice(0, limit) : faqs;

  return c.json({
    faqs: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

app.post('/faqs', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{
    brandId: string;
    commodityId?: string | null;
    question: string;
    answer: string;
    category?: string | null;
    sortOrder?: number;
  }>();

  if (!body.brandId || !isValidUUID(body.brandId)) return c.json({ error: 'Invalid brandId' }, 400);
  if (!body.question?.trim() || body.question.length > MAX_TEXT_LENGTH) return c.json({ error: 'Invalid question' }, 400);
  if (!body.answer?.trim() || body.answer.length > MAX_FAQ_TEXT_LENGTH) return c.json({ error: 'Invalid answer' }, 400);
  if (body.commodityId && !isValidUUID(body.commodityId)) return c.json({ error: 'Invalid commodityId' }, 400);

  // P1-2: Verify brandId belongs to current tenant
  const brand = await prisma.brand.findFirst({
    where: { id: body.brandId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!brand) return c.json({ error: 'Brand not found in your tenant' }, 403);

  // P1-2: Verify commodityId belongs to current tenant
  if (body.commodityId) {
    const commodity = await prisma.commodity.findFirst({
      where: { id: body.commodityId, product: { tenantId: auth.tenantId } },
      select: { id: true },
    });
    if (!commodity) return c.json({ error: 'Commodity not found in your tenant' }, 403);
  }

  const sortOrder = clampInt(body.sortOrder, 0, 9999, 0);

  const faq = await prisma.consumerFAQ.create({
    data: {
      tenantId: auth.tenantId,
      brandId: body.brandId,
      commodityId: body.commodityId ?? null,
      question: body.question.trim(),
      answer: body.answer.trim(),
      category: body.category?.trim().slice(0, 50) ?? null,
      sortOrder,
      isActive: true,
    },
    include: {
      brand: { select: { id: true, name: true } },
      commodity: { select: { id: true, title: true } },
    },
  });

  return c.json({ faq }, 201);
});

app.put('/faqs/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid FAQ id' }, 400);

  const existing = await prisma.consumerFAQ.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return c.json({ error: 'FAQ not found' }, 404);

  const body = await c.req.json<{
    question?: string;
    answer?: string;
    category?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    commodityId?: string | null;
  }>();

  if (body.question !== undefined && (!body.question.trim() || body.question.length > MAX_TEXT_LENGTH)) {
    return c.json({ error: 'Invalid question' }, 400);
  }
  if (body.answer !== undefined && (!body.answer.trim() || body.answer.length > MAX_FAQ_TEXT_LENGTH)) {
    return c.json({ error: 'Invalid answer' }, 400);
  }

  // P1-3: Verify commodityId belongs to current tenant
  if (body.commodityId !== undefined && body.commodityId !== null) {
    if (!isValidUUID(body.commodityId)) return c.json({ error: 'Invalid commodityId' }, 400);
    const commodity = await prisma.commodity.findFirst({
      where: { id: body.commodityId, product: { tenantId: auth.tenantId } },
      select: { id: true },
    });
    if (!commodity) return c.json({ error: 'Commodity not found in your tenant' }, 403);
  }

  const faq = await prisma.consumerFAQ.update({
    where: { id },
    data: {
      ...(body.question !== undefined && { question: body.question.trim() }),
      ...(body.answer !== undefined && { answer: body.answer.trim() }),
      ...(body.category !== undefined && { category: body.category?.trim().slice(0, 50) ?? null }),
      ...(body.sortOrder !== undefined && { sortOrder: clampInt(body.sortOrder, 0, 9999, existing.sortOrder) }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.commodityId !== undefined && { commodityId: body.commodityId }),
    },
    include: {
      brand: { select: { id: true, name: true } },
      commodity: { select: { id: true, title: true } },
    },
  });

  return c.json({ faq });
});

app.delete('/faqs/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid FAQ id' }, 400);

  const existing = await prisma.consumerFAQ.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return c.json({ error: 'FAQ not found' }, 404);

  await prisma.consumerFAQ.delete({ where: { id } });
  return c.json({ success: true });
});

// ─── QR Scan Stats ───
// TODO(perf): Add composite index (tenantId, scannedAt) for QR groupBy queries

app.get('/qr-stats', async (c) => {
  const auth = c.get('auth');
  const commodityId = c.req.query('commodityId');
  const days = clampInt(c.req.query('days'), 1, 365, 30);
  const since = new Date(Date.now() - days * 86_400_000);

  const where = {
    tenantId: auth.tenantId,
    scannedAt: { gte: since },
    ...(commodityId && isValidUUID(commodityId) ? { commodityId } : {}),
  };

  const [total, bySource, byCommodity] = await Promise.all([
    prisma.qRScanEvent.count({ where }),
    prisma.qRScanEvent.groupBy({
      by: ['source'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.qRScanEvent.groupBy({
      by: ['commodityId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
  ]);

  const commodityIds = byCommodity.map((r) => r.commodityId);
  const commodities = commodityIds.length > 0
    ? await prisma.commodity.findMany({
        where: { id: { in: commodityIds } },
        select: { id: true, title: true, product: { select: { name: true } } },
      })
    : [];
  const commodityMap = new Map(commodities.map((cm) => [cm.id, cm]));

  return c.json({
    total,
    days,
    bySource: bySource.map((r) => ({ source: r.source, count: r._count.id })),
    byCommodity: byCommodity.map((r) => ({
      commodityId: r.commodityId,
      count: r._count.id,
      title: commodityMap.get(r.commodityId)?.title ?? 'Unknown',
      productName: commodityMap.get(r.commodityId)?.product.name ?? 'Unknown',
    })),
  });
});

// ─── Brands list (for config dropdowns) ───

app.get('/brands', async (c) => {
  const auth = c.get('auth');
  const brands = await prisma.brand.findMany({
    where: { tenantId: auth.tenantId },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ brands });
});

// ─── Commodities list (for FAQ assignment) ───

app.get('/commodities', async (c) => {
  const auth = c.get('auth');
  const brandId = c.req.query('brandId');
  const cursor = c.req.query('cursor');
  const limit = parsePageSize(c.req.query('limit'), 200);

  const commodities = await prisma.commodity.findMany({
    where: {
      product: {
        tenantId: auth.tenantId,
        ...(brandId && isValidUUID(brandId) ? { brandId } : {}),
      },
    },
    select: {
      id: true,
      title: true,
      product: { select: { name: true, brand: { select: { id: true, name: true } } } },
    },
    orderBy: { title: 'asc' },
    take: limit + 1,
    ...(cursor && isValidUUID(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = commodities.length > limit;
  const items = hasMore ? commodities.slice(0, limit) : commodities;

  return c.json({
    commodities: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
});

export { app as portalConfigRoutes };
