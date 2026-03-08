import { Hono } from 'hono';
import { prisma } from './db.js';
import { env } from './env.js';
import { requireRole, type AuthContext } from './auth-middleware.js';
import {
  SYSTEM_TENANT_ID,
  MODEL_CATALOG,
  DEFAULT_MODELS,
  WORK_TYPE_META,
  WorkType,
  ModelRouter,
  type AIConfig,
  type ModelCatalogItem,
} from './model-router.js';

const platformAi = new Hono<{ Variables: { auth: AuthContext } }>();

platformAi.use('*', requireRole('system_admin'));

interface CatalogOverrides {
  overrides: Record<string, { enabled?: boolean; isLegacy?: boolean }>;
}

platformAi.get('/config', async (c) => {
  const policy = await prisma.policyConfig.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
  });
  const config = (policy?.policyValue as AIConfig) ?? {};

  return c.json({
    geminiKeySet: !!config.geminiKey,
    envKeySet: !!env.GEMINI_API_KEY,
    modelId: config.modelId ?? null,
    models: config.models ?? {},
    defaultModels: DEFAULT_MODELS,
    workTypes: WORK_TYPE_META,
  });
});

platformAi.post('/config', async (c) => {
  const body = await c.req.json<{
    geminiKey?: string;
    modelId?: string;
    models?: Partial<Record<WorkType, string>>;
  }>();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.policyConfig.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
    });

    const currentConfig = (existing?.policyValue as AIConfig) ?? {};
    const updated: AIConfig = {
      ...currentConfig,
      ...(body.geminiKey !== undefined ? { geminiKey: body.geminiKey } : {}),
      ...(body.modelId !== undefined ? { modelId: body.modelId } : {}),
      ...(body.models !== undefined ? { models: body.models } : {}),
    };

    if (existing) {
      await tx.policyConfig.update({
        where: { id: existing.id },
        data: { policyValue: updated as any },
      });
    } else {
      await tx.policyConfig.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          policyKey: 'platform_ai_config',
          policyValue: updated as any,
          effectiveFrom: new Date(),
        },
      });
    }
  });

  return c.json({ ok: true });
});

platformAi.post('/test', async (c) => {
  const body = await c.req.json<{ geminiKey?: string; modelId?: string }>();

  const policy = await prisma.policyConfig.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_ai_config' },
  });
  const config = (policy?.policyValue as AIConfig) ?? {};

  const key = body.geminiKey || config.geminiKey || env.GEMINI_API_KEY;
  if (!key) {
    return c.json({ ok: false, error: 'No API key available' }, 400);
  }

  const model = body.modelId || config.modelId || 'gemini-2.5-flash';

  try {
    const result = await ModelRouter.probe(key, model);
    return c.json({ ok: true, model, response: result.slice(0, 100) });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message ?? 'Connection failed' }, 400);
  }
});

platformAi.get('/catalog', async (c) => {
  const policy = await prisma.policyConfig.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_model_catalog' },
  });
  const overridesData = (policy?.policyValue as unknown as CatalogOverrides) ?? { overrides: {} };

  const items = MODEL_CATALOG.map((m: ModelCatalogItem) => {
    const ov = overridesData.overrides[m.id];
    return {
      ...m,
      enabled: ov?.enabled ?? true,
      isLegacy: ov?.isLegacy ?? m.isLegacy ?? false,
    };
  });

  return c.json({ items });
});

platformAi.patch('/catalog/:modelId', async (c) => {
  const modelId = c.req.param('modelId');

  if (!MODEL_CATALOG.find((m: ModelCatalogItem) => m.id === modelId)) {
    return c.json({ error: `Unknown model: ${modelId}` }, 404);
  }

  const body = await c.req.json<{ enabled?: boolean; isLegacy?: boolean }>();

  const policy = await prisma.policyConfig.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, policyKey: 'platform_model_catalog' },
  });
  const current = (policy?.policyValue as unknown as CatalogOverrides) ?? { overrides: {} };

  current.overrides[modelId] = {
    ...current.overrides[modelId],
    ...body,
  };

  if (policy) {
    await prisma.policyConfig.update({
      where: { id: policy.id },
      data: { policyValue: current as any },
    });
  } else {
    await prisma.policyConfig.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        policyKey: 'platform_model_catalog',
        policyValue: current as any,
        effectiveFrom: new Date(),
      },
    });
  }

  return c.json({ ok: true });
});

export { platformAi as platformAiRoutes };
