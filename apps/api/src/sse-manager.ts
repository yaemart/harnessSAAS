import { BaseSSEManager, type SSEConnectionBase } from './sse-base.js';
import { eventBus, type BusEvent, type EventType } from './event-bus.js';

export interface TenantSSEConnection extends SSEConnectionBase {
  tenantId: string;
}

const MAX_CONNECTIONS_PER_TENANT = 10;

class SSEManager extends BaseSSEManager<TenantSSEConnection> {
  protected maxPerKey = MAX_CONNECTIONS_PER_TENANT;

  protected getKey(conn: TenantSSEConnection): string {
    return conn.tenantId;
  }

  protected onEvict(): void {
    // tenant SSE rejects when full instead of evicting
  }

  override register(conn: TenantSSEConnection): boolean {
    const key = this.getKey(conn);
    const existing = this.connections.get(key) ?? [];
    if (existing.length >= this.maxPerKey) {
      return false;
    }
    existing.push(conn);
    this.connections.set(key, existing);
    return true;
  }

  pushToTenant(tenantId: string, event: string, data: Record<string, unknown>): void {
    this.push(tenantId, event, data);
  }

  override getStats(): { totalConnections: number; keys: number; tenants: number; perTenant: Record<string, number> } {
    let total = 0;
    const perTenant: Record<string, number> = {};
    for (const [tenantId, conns] of this.connections) {
      perTenant[tenantId] = conns.length;
      total += conns.length;
    }
    return { totalConnections: total, keys: this.connections.size, tenants: this.connections.size, perTenant };
  }
}

export const sseManager = new SSEManager();

const FORWARDED_EVENTS: EventType[] = [
  'intent.completed',
  'intent.failed',
  'intent.retry',
  'intent.approval_required',
  'rate_limit.exceeded',
];

export function startSSEEventForwarding(): void {
  for (const eventType of FORWARDED_EVENTS) {
    eventBus.on(eventType, (event: BusEvent) => {
      sseManager.pushToTenant(event.tenantId, eventType, {
        intentId: event.intentId,
        ...event.payload,
        timestamp: event.timestamp,
      });
    });
  }
}
