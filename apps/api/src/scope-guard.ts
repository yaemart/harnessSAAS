import { createMiddleware } from 'hono/factory';
import type { AuthContext } from './auth-middleware.js';

const FULL_ACCESS_ROLES = ['system_admin', 'tenant_admin'] as const;

export const validateScope = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth) return next();

  if ((FULL_ACCESS_ROLES as readonly string[]).includes(auth.role)) {
    return next();
  }

  const queryBrandId = c.req.query('brandId');
  const queryCategoryId = c.req.query('categoryId');

  if (auth.scopes.length === 0) {
    return next();
  }

  if (queryBrandId) {
    const allowedBrands = auth.scopes
      .filter((s) => s.scopeType === 'brand')
      .map((s) => s.scopeValue);
    if (allowedBrands.length > 0 && !allowedBrands.includes(queryBrandId)) {
      return c.json({ error: 'brand scope violation' }, 403);
    }
  }

  if (queryCategoryId) {
    const allowedCategories = auth.scopes
      .filter((s) => s.scopeType === 'category')
      .map((s) => s.scopeValue);
    if (allowedCategories.length > 0 && !allowedCategories.includes(queryCategoryId)) {
      return c.json({ error: 'category scope violation' }, 403);
    }
  }

  const method = c.req.method;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const body = await c.req.json();
      if (body && typeof body === 'object') {
        const bodyBrandId = (body as Record<string, unknown>).brandId;
        const bodyCategoryId = (body as Record<string, unknown>).categoryId;

        if (typeof bodyBrandId === 'string' && bodyBrandId) {
          const allowedBrands = auth.scopes
            .filter((s) => s.scopeType === 'brand')
            .map((s) => s.scopeValue);
          if (allowedBrands.length > 0 && !allowedBrands.includes(bodyBrandId)) {
            return c.json({ error: 'brand scope violation in request body' }, 403);
          }
        }

        if (typeof bodyCategoryId === 'string' && bodyCategoryId) {
          const allowedCategories = auth.scopes
            .filter((s) => s.scopeType === 'category')
            .map((s) => s.scopeValue);
          if (allowedCategories.length > 0 && !allowedCategories.includes(bodyCategoryId)) {
            return c.json({ error: 'category scope violation in request body' }, 403);
          }
        }
      }
    } catch {
      // Body parsing failed — not JSON, skip body check
    }
  }

  return next();
});
