'use client';

import { useEffect, useRef, useCallback } from 'react';
import { eventsStreamUrl } from './api';

export type AgentEventType =
  | 'intent.completed'
  | 'intent.failed'
  | 'intent.queued'
  | 'intent.approved'
  | 'intent.rejected';

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
}

type EventHandler = (event: AgentEvent) => void;

/**
 * Subscribe to the tenant-level /events/stream SSE endpoint.
 * Fires `onEvent` for each agent lifecycle event (intent.completed, intent.failed, etc.).
 * Automatically reconnects on error with exponential backoff.
 */
export function useAgentEvents(
  tenantId: string | null | undefined,
  onEvent: EventHandler,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const dispatch = useCallback((type: AgentEventType, raw: string) => {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      handlerRef.current({ type, data });
    } catch {
      // malformed payload — skip
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    let es: EventSource | null = null;
    let retryMs = 2000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      es = new EventSource(eventsStreamUrl(tenantId!));

      const EVENTS: AgentEventType[] = [
        'intent.completed',
        'intent.failed',
        'intent.queued',
        'intent.approved',
        'intent.rejected',
      ];
      for (const evt of EVENTS) {
        es.addEventListener(evt, (e) => dispatch(evt, (e as MessageEvent).data));
      }

      es.addEventListener('ready', () => {
        retryMs = 2000;
      });

      es.onerror = () => {
        es?.close();
        if (disposed) return;
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [tenantId, dispatch]);
}
