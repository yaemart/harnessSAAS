import { EventEmitter } from 'node:events';

export type EventType =
  | 'intent.completed'
  | 'intent.failed'
  | 'intent.retry'
  | 'intent.approval_required'
  | 'intent.circuit_open'
  | 'rate_limit.exceeded'
  | 'metric.recorded';

export interface BusEvent {
  type: EventType;
  tenantId: string;
  intentId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

class AgentEventBus extends EventEmitter {
  emit(type: EventType, event: BusEvent): boolean {
    return super.emit(type, event);
  }

  on(type: EventType, listener: (event: BusEvent) => void): this {
    return super.on(type, listener);
  }
}

export const eventBus = new AgentEventBus();
eventBus.setMaxListeners(500);

export function emitEvent(
  type: EventType,
  tenantId: string,
  payload: Record<string, unknown>,
  intentId?: string,
): void {
  const event: BusEvent = {
    type,
    tenantId,
    intentId,
    timestamp: new Date().toISOString(),
    payload,
  };
  eventBus.emit(type, event);
}
