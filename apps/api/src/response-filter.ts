import { createMiddleware } from 'hono/factory';
import type { AuthContext } from './auth-middleware.js';
import { stripSensitiveFields } from './auth-middleware.js';

export const filterResponse = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  await next();

  const auth = c.get('auth');
  if (!auth || auth.role !== 'supplier') return;

  const contentType = c.res.headers.get('content-type');
  if (!contentType?.includes('application/json')) return;

  const body = await c.res.json();
  const filtered = stripSensitiveFields(body, auth.role);
  const headers = new Headers(c.res.headers);
  headers.set('content-type', 'application/json; charset=UTF-8');
  c.res = new Response(JSON.stringify(filtered), {
    status: c.res.status,
    headers,
  });
});
