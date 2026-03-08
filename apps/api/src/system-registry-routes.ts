import { Hono } from 'hono';
import { prisma } from './db.js';
import { requireRole, type AuthContext } from './auth-middleware.js';

const registry = new Hono<{ Variables: { auth: AuthContext } }>();

registry.use('/*', requireRole('system_admin'));

function getActorId(c: any): string {
  const auth = c.get('auth') as AuthContext | undefined;
  return auth?.userId ?? 'system';
}

async function auditRegistryChange(entity: string, action: string, actorId: string, details: Record<string, unknown>) {
  const SYSTEM_TENANT = '00000000-0000-0000-0000-000000000000';
  try {
    await prisma.securityAuditEvent.create({
      data: {
        tenantId: SYSTEM_TENANT,
        eventType: `GLOBAL_REGISTRY_${action}`,
        severity: action === 'DISABLE' ? 'WARNING' : 'INFO',
        details: { entity, ...details, actorId } as never,
      },
    });
  } catch (_) {}
}

async function checkImpact(entity: string, code: string) {
  const fieldMap: Record<string, string> = {
    market: 'globalMarketCode',
    platform: 'globalPlatformCode',
    category: 'globalCategoryCode',
    warehouse: 'globalWarehouseCode',
    erp: 'globalErpCode',
  };
  const modelMap: Record<string, (code: string) => Promise<number>> = {
    market: (c) => prisma.market.count({ where: { globalMarketCode: c } }),
    platform: (c) => prisma.platform.count({ where: { globalPlatformCode: c } }),
    category: async (c) => {
      try {
        const legacyMappings = await prisma.legacyCategoryCodeMapping.findMany({ where: { newCode: c } });
        const allCodes = [c, ...legacyMappings.map(m => m.oldCode)];
        return prisma.category.count({ where: { globalCategoryCode: { in: allCodes } } });
      } catch {
        return prisma.category.count({ where: { globalCategoryCode: c } });
      }
    },
    warehouse: (c) => prisma.warehouse.count({ where: { globalWarehouseCode: c } }),
    erp: (c) => prisma.erpSystem.count({ where: { globalErpCode: c } }),
  };
  const countFn = modelMap[entity];
  if (!countFn) return { tenantCount: 0 };
  const tenantCount = await countFn(code);
  return { tenantCount };
}

const CODE_RE = /^[a-z0-9_]{1,200}$/;
function validateCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_RE.test(code);
}

// ══════════════════════════════════════════════════════════
//  GlobalMarket
// ══════════════════════════════════════════════════════════

registry.get('/markets', async (c) => {
  const items = await prisma.globalMarket.findMany({ orderBy: { code: 'asc' } });
  return c.json({ items });
});

registry.post('/markets', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; currency?: string; timezone?: string;
    flag?: string; region?: string; enabled?: boolean;
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  const item = await prisma.globalMarket.create({
    data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('market', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/markets/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string; currency?: string; timezone?: string;
    flag?: string; region?: string;
  }>();
  const item = await prisma.globalMarket.update({
    where: { id }, data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('market', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.patch('/markets/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalMarket.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;

  if (!newEnabled && !parsed.confirmed) {
    const impact = await checkImpact('market', current.code);
    if (impact.tenantCount > 0) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) affected`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }

  const item = await prisma.globalMarket.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('market', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  GlobalPlatform
// ══════════════════════════════════════════════════════════

registry.get('/platforms', async (c) => {
  const items = await prisma.globalPlatform.findMany({ orderBy: { code: 'asc' } });
  return c.json({ items });
});

registry.post('/platforms', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; icon?: string; color?: string;
    description?: string; badge?: string; supportedMarketCodes?: string[];
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  const item = await prisma.globalPlatform.create({
    data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('platform', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/platforms/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string; icon?: string; color?: string;
    description?: string; badge?: string; enabledMarketCodes?: string[];
  }>();
  if (body.enabledMarketCodes) {
    const current = await prisma.globalPlatform.findUniqueOrThrow({ where: { id }, select: { supportedMarketCodes: true } });
    const invalid = body.enabledMarketCodes.filter(mc => !current.supportedMarketCodes.includes(mc));
    if (invalid.length > 0) {
      return c.json({ error: `Invalid market codes not in supportedMarketCodes: ${invalid.join(', ')}` }, 400);
    }
  }
  const item = await prisma.globalPlatform.update({
    where: { id }, data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('platform', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.patch('/platforms/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalPlatform.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;

  if (!newEnabled && !parsed.confirmed) {
    const impact = await checkImpact('platform', current.code);
    if (impact.tenantCount > 0) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) affected`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }

  const item = await prisma.globalPlatform.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('platform', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

const PLATFORM_CODES = ['AMAZON','WALMART','EBAY','SHOPIFY','WAYFAIR','TEMU','TIKTOK_SHOP','GOOGLE'] as const;
const MAPPING_TYPES = ['EXACT','CLOSE','FORCED','AI_SUGGESTED'] as const;
const MAPPING_STATUSES = ['active','expired','pending_review'] as const;
const CATEGORY_STATUSES = ['DRAFT','ACTIVE','DEPRECATED'] as const;

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function computeCategoryFields(parentId: string | null | undefined) {
  if (!parentId) return { level: 1, parentPath: '', parentSlug: '' };
  const parent = await prisma.globalCategory.findUniqueOrThrow({
    where: { id: parentId },
    select: { level: true, path: true, slugPath: true },
  });
  return { level: parent.level + 1, parentPath: parent.path, parentSlug: parent.slugPath };
}

// ══════════════════════════════════════════════════════════
//  GlobalCategory (enhanced with lazy loading, search, L3/L4)
// ══════════════════════════════════════════════════════════

registry.get('/categories', async (c) => {
  const parentId = c.req.query('parentId');
  const include = c.req.query('include')?.split(',') || [];

  const where: any = {};
  if (parentId === '' || parentId === 'null' || parentId === undefined) {
    where.parentId = null;
  } else {
    where.parentId = parentId;
  }

  const items = await prisma.globalCategory.findMany({
    where,
    include: {
      platformMappings: include.includes('mappings'),
      aliases: include.includes('aliases'),
      children: { select: { id: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });

  return c.json({
    items: items.map((item: any) => ({
      ...item,
      hasChildren: item.children?.length > 0,
      children: undefined,
    })),
  });
});

registry.get('/categories/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.length < 2) return c.json({ items: [] });

  const aliasMatches = await prisma.categoryAlias.findMany({
    where: { alias: { contains: q, mode: 'insensitive' } },
    select: { globalCategoryId: true },
    take: 200,
  });
  const aliasIds = aliasMatches.map((a: any) => a.globalCategoryId);

  const orConditions: any[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { nameZh: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { id: { in: aliasIds } },
      ];
  if (!isNaN(Number(q))) {
    orConditions.push({ googleTaxonomyId: Number(q) });
  }

  const items = await prisma.globalCategory.findMany({
    where: {
      OR: orConditions,
    },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    take: 50,
  });

  return c.json({ items });
});

registry.get('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const include = c.req.query('include')?.split(',') || [];
  const item = await prisma.globalCategory.findUniqueOrThrow({
    where: { id },
    include: {
      platformMappings: include.includes('mappings') ? { include: { platformCategory: true } } : false,
      aliases: include.includes('aliases'),
    },
  });
  return c.json({ item });
});

registry.post('/categories', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; nameZh?: string; icon?: string;
    marketScope?: string[]; parentId?: string; status?: string;
    source?: string; sortOrder?: number;
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  if ((body as any).tags) return c.json({ error: 'tags field is deprecated and read-only' }, 400);
  if (body.status && !CATEGORY_STATUSES.includes(body.status as any)) {
    return c.json({ error: `Invalid status. Must be one of: ${CATEGORY_STATUSES.join(', ')}` }, 400);
  }

  const { level, parentPath, parentSlug } = await computeCategoryFields(body.parentId);
  if (level > 4) return c.json({ error: 'Maximum category depth is 4 levels' }, 400);

  const path = parentPath ? `${parentPath} > ${body.name}` : body.name;
  const slugPath = parentSlug ? `${parentSlug}/${toSlug(body.name)}` : toSlug(body.name);

  const item = await prisma.globalCategory.create({
    data: {
      code: body.code,
      name: body.name,
      nameZh: body.nameZh,
      level,
      icon: body.icon || '',
      marketScope: body.marketScope || [],
      parentId: body.parentId || null,
      path,
      slugPath,
      status: body.status || 'DRAFT',
      source: body.source || 'manual',
      sortOrder: body.sortOrder ?? 0,
      updatedBy: actor,
    },
  });
  await auditRegistryChange('category', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/categories/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string; nameZh?: string; icon?: string; marketScope?: string[];
    status?: string; sortOrder?: number; replacedBy?: string | null;
    attributeSchema?: any;
  }>();
  if ((body as any).tags) return c.json({ error: 'tags field is deprecated and read-only' }, 400);
  if ((body as any).level) return c.json({ error: 'level is auto-computed and cannot be set manually' }, 400);
  if (body.status && !CATEGORY_STATUSES.includes(body.status as any)) {
    return c.json({ error: `Invalid status. Must be one of: ${CATEGORY_STATUSES.join(', ')}` }, 400);
  }

  const current = await prisma.globalCategory.findUniqueOrThrow({ where: { id } });
  const data: any = { ...body, updatedBy: actor };

  if (body.name && body.name !== current.name) {
    const { parentPath, parentSlug } = current.parentId
      ? { parentPath: current.path.split(' > ').slice(0, -1).join(' > '), parentSlug: current.slugPath.split('/').slice(0, -1).join('/') }
      : { parentPath: '', parentSlug: '' };
    data.path = parentPath ? `${parentPath} > ${body.name}` : body.name;
    data.slugPath = parentSlug ? `${parentSlug}/${toSlug(body.name)}` : toSlug(body.name);

    const descendants = await prisma.globalCategory.findMany({
      where: { path: { startsWith: current.path + ' > ' } },
    });
    for (const desc of descendants) {
      const newPath = desc.path.replace(current.path, data.path);
      const newSlug = desc.slugPath.replace(current.slugPath, data.slugPath);
      await prisma.globalCategory.update({
        where: { id: desc.id },
        data: { path: newPath, slugPath: newSlug },
      });
    }
  }

  const item = await prisma.globalCategory.update({ where: { id }, data });
  await auditRegistryChange('category', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.delete('/categories/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const children = await prisma.globalCategory.count({ where: { parentId: id } });
  if (children > 0) {
    return c.json({ error: 'Cannot delete category with child nodes. Remove children first.' }, 400);
  }
  const item = await prisma.globalCategory.findUniqueOrThrow({ where: { id } });
  const impact = await checkImpact('category', item.code);
  if (impact.tenantCount > 0) {
    const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
    if (!parsed.confirmed) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) reference this category`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }
  await prisma.globalCategory.delete({ where: { id } });
  await auditRegistryChange('category', 'DELETE', actor, { code: item.code });
  return c.json({ success: true });
});

registry.patch('/categories/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalCategory.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;

  if (!newEnabled && !parsed.confirmed) {
    const impact = await checkImpact('category', current.code);
    if (impact.tenantCount > 0) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) affected`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }

  const item = await prisma.globalCategory.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('category', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  CategoryPlatformMapping
// ══════════════════════════════════════════════════════════

registry.get('/categories/:id/mappings', async (c) => {
  const globalCategoryId = c.req.param('id');
  const items = await prisma.categoryPlatformMapping.findMany({
    where: { globalCategoryId },
    include: { platformCategory: true },
    orderBy: [{ platform: 'asc' }, { marketCode: 'asc' }],
  });
  return c.json({ items });
});

registry.post('/categories/:id/mappings', async (c) => {
  const actor = getActorId(c);
  const globalCategoryId = c.req.param('id');
  const body = await c.req.json<{
    platform: string; marketCode?: string; platformCategoryId?: string;
    externalCategoryId?: string; externalPath?: string;
    mappingType?: string; confidenceScore?: number; direction?: string;
    source?: string; notes?: string;
  }>();

  if (!PLATFORM_CODES.includes(body.platform as any)) {
    return c.json({ error: `Invalid platform. Must be one of: ${PLATFORM_CODES.join(', ')}` }, 400);
  }
  if (body.mappingType && !MAPPING_TYPES.includes(body.mappingType as any)) {
    return c.json({ error: `Invalid mappingType. Must be one of: ${MAPPING_TYPES.join(', ')}` }, 400);
  }

  if (body.platformCategoryId) {
    const exists = await prisma.platformCategory.findUnique({ where: { id: body.platformCategoryId } });
    if (!exists) return c.json({ error: 'platformCategoryId does not exist' }, 400);
  }

  const item = await prisma.categoryPlatformMapping.create({
    data: {
      globalCategoryId,
      platform: body.platform,
      marketCode: body.marketCode || 'GLOBAL',
      platformCategoryId: body.platformCategoryId || null,
      externalCategoryId: body.externalCategoryId || null,
      externalPath: body.externalPath || null,
      mappingType: body.mappingType || 'EXACT',
      confidenceScore: body.confidenceScore ?? 1.0,
      direction: body.direction || 'BIDIRECTIONAL',
      source: body.source || 'manual',
      notes: body.notes || null,
      createdBy: actor,
      updatedBy: actor,
    },
  });

  await prisma.globalCategory.update({
    where: { id: globalCategoryId },
    data: { mappingCount: { increment: 1 } },
  });

  return c.json({ item }, 201);
});

registry.put('/categories/:id/mappings/:mapId', async (c) => {
  const actor = getActorId(c);
  const mapId = c.req.param('mapId');
  const body = await c.req.json<{
    externalCategoryId?: string; externalPath?: string;
    mappingType?: string; confidenceScore?: number; direction?: string;
    status?: string; notes?: string; platformCategoryId?: string;
  }>();

  if (body.mappingType && !MAPPING_TYPES.includes(body.mappingType as any)) {
    return c.json({ error: `Invalid mappingType` }, 400);
  }
  if (body.status && !MAPPING_STATUSES.includes(body.status as any)) {
    return c.json({ error: `Invalid status` }, 400);
  }

  const item = await prisma.categoryPlatformMapping.update({
    where: { id: mapId },
    data: { ...body, updatedBy: actor },
  });
  return c.json({ item });
});

registry.delete('/categories/:id/mappings/:mapId', async (c) => {
  const actor = getActorId(c);
  const globalCategoryId = c.req.param('id');
  const mapId = c.req.param('mapId');
  await prisma.categoryPlatformMapping.delete({ where: { id: mapId } });
  await prisma.globalCategory.update({
    where: { id: globalCategoryId },
    data: { mappingCount: { decrement: 1 } },
  });
  return c.json({ success: true });
});

registry.get('/mappings', async (c) => {
  const platform = c.req.query('platform');
  const market = c.req.query('market');
  const where: any = {};
  if (platform) where.platform = platform;
  if (market) where.marketCode = market;
  const items = await prisma.categoryPlatformMapping.findMany({
    where,
    include: { globalCategory: true, platformCategory: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return c.json({ items });
});

// ══════════════════════════════════════════════════════════
//  CategoryAlias
// ══════════════════════════════════════════════════════════

registry.get('/categories/:id/aliases', async (c) => {
  const globalCategoryId = c.req.param('id');
  const items = await prisma.categoryAlias.findMany({
    where: { globalCategoryId },
    orderBy: [{ language: 'asc' }, { weight: 'desc' }],
  });
  return c.json({ items });
});

registry.post('/categories/:id/aliases', async (c) => {
  const globalCategoryId = c.req.param('id');
  const body = await c.req.json<{
    alias: string; language?: string; source?: string; weight?: number;
  }>();
  if (!body.alias?.trim()) return c.json({ error: 'alias is required' }, 400);

  const item = await prisma.categoryAlias.create({
    data: {
      globalCategoryId,
      alias: body.alias.trim(),
      language: body.language || 'en',
      source: body.source || 'manual',
      weight: body.weight ?? 1.0,
    },
  });
  return c.json({ item }, 201);
});

registry.delete('/categories/:id/aliases/:aliasId', async (c) => {
  const aliasId = c.req.param('aliasId');
  await prisma.categoryAlias.delete({ where: { id: aliasId } });
  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  PlatformCategory (read-only)
// ══════════════════════════════════════════════════════════

registry.get('/platform-categories', async (c) => {
  const platform = c.req.query('platform');
  const parentId = c.req.query('parentId');
  const q = c.req.query('q');

  if (q && q.length >= 2) {
    const items = await prisma.platformCategory.findMany({
      where: {
        ...(platform ? { platform } : {}),
        name: { contains: q, mode: 'insensitive' },
      },
      take: 30,
      orderBy: { level: 'asc' },
    });
    return c.json({ items });
  }

  const where: any = {};
  if (platform) where.platform = platform;
  if (parentId === '' || parentId === 'null' || parentId === undefined) {
    where.parentId = null;
  } else {
    where.parentId = parentId;
  }
  const items = await prisma.platformCategory.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 200,
  });
  return c.json({ items });
});

registry.get('/platform-categories/:id', async (c) => {
  const id = c.req.param('id');
  const item = await prisma.platformCategory.findUniqueOrThrow({
    where: { id },
    include: { children: true },
  });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  AI Endpoints
// ══════════════════════════════════════════════════════════

registry.post('/ai/suggest-mappings', async (c) => {
  const body = await c.req.json<{
    globalCategoryId: string;
    platforms?: string[];
  }>();

  const category = await prisma.globalCategory.findUniqueOrThrow({
    where: { id: body.globalCategoryId },
    include: { aliases: true },
  });

  const platforms = body.platforms || PLATFORM_CODES.filter(p => p !== 'GOOGLE');
  const aliasNames = category.aliases.map((a: any) => a.alias);
  const searchTerms = [category.name, category.nameZh, ...aliasNames].filter(Boolean);

  const suggestions: any[] = [];
  for (const platform of platforms) {
    const candidates = await prisma.platformCategory.findMany({
      where: {
        platform,
        OR: searchTerms.map(t => ({ name: { contains: t as string, mode: 'insensitive' as const } })),
      },
      take: 3,
      orderBy: { level: 'desc' },
    });

    for (const candidate of candidates) {
      const nameMatch = candidate.name.toLowerCase() === category.name.toLowerCase();
      suggestions.push({
        platform,
        platformCategoryId: candidate.id,
        platformCategoryName: candidate.name,
        platformCategoryPath: candidate.path,
        externalCategoryId: candidate.platformCategoryId,
        confidence: nameMatch ? 0.95 : 0.7,
        mappingType: nameMatch ? 'EXACT' : 'CLOSE',
        reason: nameMatch
          ? `Exact name match: "${candidate.name}"`
          : `Partial match via alias/name similarity with "${category.name}"`,
      });
    }
  }

  return c.json({ suggestions });
});

registry.post('/ai/generate-attributes', async (c) => {
  const body = await c.req.json<{ globalCategoryId: string }>();

  const category = await prisma.globalCategory.findUniqueOrThrow({
    where: { id: body.globalCategoryId },
  });

  const attributeTemplates: Record<string, { required: any[]; recommended: any[] }> = {
    electronics: {
      required: [
        { key: 'brand', label: 'Brand', type: 'text', confidence: 0.98 },
        { key: 'model', label: 'Model Number', type: 'text', confidence: 0.95 },
        { key: 'color', label: 'Color', type: 'text', confidence: 0.92 },
      ],
      recommended: [
        { key: 'weight_kg', label: 'Weight (kg)', type: 'number', confidence: 0.85 },
        { key: 'warranty', label: 'Warranty', type: 'text', confidence: 0.80 },
        { key: 'material', label: 'Material', type: 'text', confidence: 0.75 },
      ],
    },
    default: {
      required: [
        { key: 'brand', label: 'Brand', type: 'text', confidence: 0.95 },
        { key: 'material', label: 'Material', type: 'text', confidence: 0.85 },
        { key: 'color', label: 'Color', type: 'text', confidence: 0.90 },
      ],
      recommended: [
        { key: 'weight_kg', label: 'Weight (kg)', type: 'number', confidence: 0.80 },
        { key: 'dimensions', label: 'Dimensions', type: 'text', confidence: 0.75 },
        { key: 'country_of_origin', label: 'Country of Origin', type: 'text', confidence: 0.70 },
      ],
    },
  };

  const l1Code = category.path.split(' > ')[0]?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const template = attributeTemplates[l1Code] || attributeTemplates.default;

  return c.json({
    categoryCode: category.code,
    categoryName: category.name,
    attributes: {
      required: template.required,
      recommended: template.recommended,
      platformSpecific: {
        AMAZON: [
          { key: 'bullet_points', label: 'Bullet Points', type: 'text[]', confidence: 0.95 },
          { key: 'search_terms', label: 'Search Terms', type: 'text', confidence: 0.90 },
        ],
        WALMART: [
          { key: 'short_description', label: 'Short Description', type: 'text', confidence: 0.90 },
          { key: 'shelf_description', label: 'Shelf Description', type: 'text', confidence: 0.85 },
        ],
      },
    },
  });
});

// ══════════════════════════════════════════════════════════
//  GlobalWarehouse
// ══════════════════════════════════════════════════════════

registry.get('/warehouses', async (c) => {
  const region = c.req.query('region');
  const items = await prisma.globalWarehouse.findMany({
    where: region ? { region } : {},
    orderBy: { code: 'asc' },
  });
  return c.json({ items });
});

registry.post('/warehouses', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; type?: string; region?: string;
    country?: string; nodes?: string[]; description?: string;
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  const item = await prisma.globalWarehouse.create({
    data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('warehouse', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/warehouses/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string; type?: string; region?: string;
    country?: string; nodes?: string[]; description?: string;
  }>();
  const item = await prisma.globalWarehouse.update({
    where: { id }, data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('warehouse', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.patch('/warehouses/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalWarehouse.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;

  if (!newEnabled && !parsed.confirmed) {
    const impact = await checkImpact('warehouse', current.code);
    if (impact.tenantCount > 0) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) affected`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }

  const item = await prisma.globalWarehouse.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('warehouse', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  GlobalErpSystem
// ══════════════════════════════════════════════════════════

registry.get('/erp-systems', async (c) => {
  const items = await prisma.globalErpSystem.findMany({ orderBy: { code: 'asc' } });
  return c.json({ items });
});

registry.post('/erp-systems', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; vendor?: string; icon?: string; description?: string;
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  const item = await prisma.globalErpSystem.create({
    data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('erp', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/erp-systems/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; vendor?: string; icon?: string; description?: string }>();
  const item = await prisma.globalErpSystem.update({
    where: { id }, data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('erp', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.patch('/erp-systems/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalErpSystem.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;

  if (!newEnabled && !parsed.confirmed) {
    const impact = await checkImpact('erp', current.code);
    if (impact.tenantCount > 0) {
      return c.json({ warning: true, message: `${impact.tenantCount} tenant(s) affected`, requireConfirm: true, affectedTenants: impact.tenantCount });
    }
  }

  const item = await prisma.globalErpSystem.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('erp', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  GlobalTool
// ══════════════════════════════════════════════════════════

registry.get('/tools', async (c) => {
  const items = await prisma.globalTool.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
  return c.json({ items });
});

registry.post('/tools', async (c) => {
  const actor = getActorId(c);
  const body = await c.req.json<{
    code: string; name: string; category?: string; icon?: string; description?: string;
  }>();
  if (!validateCode(body.code)) return c.json({ error: 'Invalid code format (a-z0-9_, 1-200 chars)' }, 400);
  const item = await prisma.globalTool.create({
    data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('tool', 'CREATE', actor, { code: body.code });
  return c.json({ item }, 201);
});

registry.put('/tools/:id', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; category?: string; icon?: string; description?: string }>();
  const item = await prisma.globalTool.update({
    where: { id }, data: { ...body, updatedBy: actor },
  });
  await auditRegistryChange('tool', 'UPDATE', actor, { code: item.code });
  return c.json({ item });
});

registry.patch('/tools/:id/toggle', async (c) => {
  const actor = getActorId(c);
  const id = c.req.param('id');
  const current = await prisma.globalTool.findUniqueOrThrow({ where: { id } });
  const parsed: { confirmed?: boolean } = await c.req.json().catch(() => ({}));
  const newEnabled = !current.enabled;
  const item = await prisma.globalTool.update({
    where: { id }, data: { enabled: newEnabled, updatedBy: actor },
  });
  await auditRegistryChange('tool', newEnabled ? 'ENABLE' : 'DISABLE', actor, { code: item.code });
  return c.json({ item });
});

// ══════════════════════════════════════════════════════════
//  Public Available Endpoints (for tenant + agent consumption)
// ══════════════════════════════════════════════════════════

const available = new Hono();

available.get('/markets', async (c) => {
  const items = await prisma.globalMarket.findMany({ where: { enabled: true }, orderBy: { code: 'asc' } });
  return c.json({ items });
});

available.get('/platforms', async (c) => {
  const items = await prisma.globalPlatform.findMany({ where: { enabled: true }, orderBy: { code: 'asc' } });
  return c.json({ items });
});

available.get('/categories/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.length < 2) return c.json({ items: [] });

  const aliasMatches = await prisma.categoryAlias.findMany({
    where: { alias: { contains: q, mode: 'insensitive' } },
    select: { globalCategoryId: true },
    take: 200,
  });
  const aliasIds = aliasMatches.map((a: any) => a.globalCategoryId);

  const availOrConditions: any[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { nameZh: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { id: { in: aliasIds } },
      ];
  if (!isNaN(Number(q))) {
    availOrConditions.push({ googleTaxonomyId: Number(q) });
  }

  const items = await prisma.globalCategory.findMany({
    where: {
      enabled: true,
      OR: availOrConditions,
    },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    take: 50,
  });
  return c.json({ items });
});

available.get('/categories', async (c) => {
  const parentId = c.req.query('parentId');
  const market = c.req.query('market');
  const platform = c.req.query('platform');
  const where: any = { enabled: true };
  if (parentId) {
    where.parentId = parentId;
  } else {
    where.parentId = null;
  }
  if (platform) {
    where.platformMappings = { some: { platform: platform.toUpperCase() } };
  }
  const items = await prisma.globalCategory.findMany({
    where,
    include: {
      children: { where: { enabled: true }, select: { id: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  let result = items.map((i: any) => ({
    ...i,
    hasChildren: i.children?.length > 0,
    children: undefined,
  }));
  if (market) {
    result = result.filter((i: any) => i.marketScope.length === 0 || i.marketScope.includes(market));
  }
  return c.json({ items: result });
});

available.get('/warehouses', async (c) => {
  const region = c.req.query('region');
  const items = await prisma.globalWarehouse.findMany({
    where: { enabled: true, ...(region ? { region } : {}) },
    orderBy: { code: 'asc' },
  });
  return c.json({ items });
});

available.get('/erp-systems', async (c) => {
  const items = await prisma.globalErpSystem.findMany({ where: { enabled: true }, orderBy: { code: 'asc' } });
  return c.json({ items });
});

available.get('/categories/:id/mappings', async (c) => {
  const globalCategoryId = c.req.param('id');
  const items = await prisma.categoryPlatformMapping.findMany({
    where: { globalCategoryId },
    include: { platformCategory: true },
    orderBy: [{ platform: 'asc' }, { marketCode: 'asc' }],
  });
  return c.json({ items });
});

available.get('/categories/:id/aliases', async (c) => {
  const globalCategoryId = c.req.param('id');
  const items = await prisma.categoryAlias.findMany({
    where: { globalCategoryId },
    orderBy: [{ language: 'asc' }, { weight: 'desc' }],
  });
  return c.json({ items });
});

available.get('/tools', async (c) => {
  const items = await prisma.globalTool.findMany({ where: { enabled: true }, orderBy: [{ category: 'asc' }, { code: 'asc' }] });
  return c.json({ items });
});

export { registry as systemRegistryRoutes, available as systemAvailableRoutes };
