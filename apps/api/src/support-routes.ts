import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { prisma } from './db.js';
import { requireRole, type AuthContext } from './auth-middleware.js';
import { chatSSEManager } from './chat-sse-manager.js';
import { parsePageSize } from './pagination.js';
import { isValidUUID } from './validation.js';
import { writeConfidenceLedger, loadTenantMaturityConfig } from './harness-ledger-service.js';

type Env = { Variables: { auth: AuthContext } };

const app = new Hono<Env>();

const MAX_REPLY_LENGTH = 10_000;
const MAX_WRITEBACK_LENGTH = 5_000;

app.use('*', requireRole('system_admin', 'tenant_admin', 'operator'));

app.get('/cases', async (c) => {
  const auth = c.get('auth');
  const status = c.req.query('status');
  const limit = parsePageSize(c.req.query('limit'));
  const cursor = c.req.query('cursor');

  const cases = await prisma.supportCase.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(status ? { status } : {}),
    },
    include: {
      consumer: { select: { id: true, email: true, name: true } },
      commodity: {
        select: {
          id: true,
          title: true,
          product: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      _count: { select: { messages: true, mediaAnalyses: true } },
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

app.get('/cases/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      consumer: { select: { id: true, email: true, name: true, phone: true } },
      commodity: {
        select: {
          id: true,
          title: true,
          product: { select: { name: true, sku: true, brand: { select: { name: true } } } },
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
      mediaAnalyses: true,
    },
  });

  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  return c.json({ case: supportCase });
});

app.post('/cases/:id/reply', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const body = await c.req.json<{ content: string; knowledgeWriteback?: string }>();

  if (!body.content || body.content.length < 1) {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_REPLY_LENGTH) {
    return c.json({ error: 'content too long' }, 400);
  }
  if (body.knowledgeWriteback && body.knowledgeWriteback.length > MAX_WRITEBACK_LENGTH) {
    return c.json({ error: 'knowledgeWriteback too long' }, 400);
  }

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, status: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);

  const message = await prisma.caseMessage.create({
    data: {
      tenantId: auth.tenantId,
      caseId: id,
      role: 'agent',
      contentType: 'text',
      content: body.content,
      metadata: { humanAgent: true, agentUserId: auth.userId },
    },
  });

  if (body.knowledgeWriteback) {
    await prisma.supportCase.update({
      where: { id },
      data: { knowledgeWriteback: body.knowledgeWriteback },
    });
  }

  chatSSEManager.pushToCase(id, 'message', {
    role: 'agent',
    content: body.content,
    humanAgent: true,
    messageId: message.id,
  });

  return c.json({ message }, 201);
});

app.post('/cases/:id/close', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const body = await c.req.json<{
    knowledgeWriteback?: string;
    writebackCategory?: string;
  }>();

  if (body.knowledgeWriteback && body.knowledgeWriteback.length > MAX_WRITEBACK_LENGTH) {
    return c.json({ error: 'knowledgeWriteback too long' }, 400);
  }
  if (body.writebackCategory !== undefined) {
    if (typeof body.writebackCategory !== 'string' || body.writebackCategory.length > 100 || !/^[a-zA-Z0-9_\- ]+$/.test(body.writebackCategory)) {
      return c.json({ error: 'writebackCategory must be alphanumeric (max 100 chars)' }, 400);
    }
  }

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, status: true, issueType: true, agentConfidence: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);
  if (supportCase.status === 'closed') return c.json({ error: 'Case is already closed' }, 409);

  if (supportCase.status === 'human_escalated' && !body.knowledgeWriteback) {
    return c.json({ error: 'knowledgeWriteback is required when closing escalated cases' }, 400);
  }

  let result: { knowledgeEntryId: string | null };
  try {
    result = await prisma.$transaction(async (tx) => {
      const updatedCase = await tx.supportCase.updateMany({
        where: { id, tenantId: auth.tenantId, status: { not: 'closed' } },
        data: {
          status: 'closed',
          closedAt: new Date(),
          resolvedAt: new Date(),
          ...(body.knowledgeWriteback ? { knowledgeWriteback: body.knowledgeWriteback } : {}),
        },
      });
      if (updatedCase.count === 0) {
        throw new Error('CASE_ALREADY_CLOSED');
      }

      let knowledgeEntryId: string | null = null;
      if (body.knowledgeWriteback) {
        const entry = await tx.knowledgeEntry.create({
          data: {
            tenantId: auth.tenantId,
            source: 'writeback',
            category: body.writebackCategory || supportCase.issueType || 'general',
            content: body.knowledgeWriteback,
            sourceRef: id,
          },
        });
        knowledgeEntryId = entry.id;
      }

      return { knowledgeEntryId };
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'CASE_ALREADY_CLOSED') {
      return c.json({ error: 'Case is already closed' }, 409);
    }
    throw e;
  }

  const maturityConfig = await loadTenantMaturityConfig(auth.tenantId);
  void writeConfidenceLedger({
    tenantId: auth.tenantId,
    caseId: id,
    agentAction: 'case_close',
    confidenceBefore: supportCase.agentConfidence ?? 0.5,
    confidenceAfter: supportCase.agentConfidence ?? 0.5,
    knowledgeUsed: result.knowledgeEntryId ? [result.knowledgeEntryId] : [],
    knowledgeWeights: result.knowledgeEntryId ? [1.0] : [],
    ruleTriggered: [],
    ruleResult: 'pass',
    authorityLevel: 'auto',
    executionResult: 'success',
    executionLatencyMs: 0,
    pipelineVersion: '1.0.0',
    tenantMaturityScore: maturityConfig.maturityScore,
    agentAutonomyLevel: maturityConfig.autonomyLevel,
  });

  return c.json({
    message: 'Case closed',
    knowledgeEntryId: result.knowledgeEntryId,
  });
});

app.get('/stats', async (c) => {
  const auth = c.get('auth');

  const groups = await prisma.supportCase.groupBy({
    by: ['status'],
    where: { tenantId: auth.tenantId },
    _count: true,
  });

  let total = 0;
  let open = 0;
  let escalated = 0;
  let closed = 0;

  for (const g of groups) {
    total += g._count;
    if (g.status === 'open') open = g._count;
    else if (g.status === 'human_escalated') escalated = g._count;
    else if (g.status === 'closed') closed = g._count;
  }

  return c.json({ total, open, escalated, closed });
});

app.get('/cases/:id/stream', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  if (!isValidUUID(id)) return c.json({ error: 'Invalid case id' }, 400);

  const supportCase = await prisma.supportCase.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!supportCase) return c.json({ error: 'Case not found' }, 404);

  const connId = crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    chatSSEManager.register({
      id: connId,
      caseId: id,
      consumerId: auth.userId,
      send: (event, data) => {
        void stream.writeSSE({ event, data, id: crypto.randomUUID() });
      },
      close: () => stream.close(),
    });

    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ caseId: id, connId }),
    });

    stream.onAbort(() => {
      chatSSEManager.unregister(connId, id);
    });

    await new Promise(() => {});
  });
});

export { app as supportRoutes };
