'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchSSEToken, buildSSEUrl } from './portal-api-client';

export type SSEEventType = 'message' | 'typing' | 'escalation' | 'done' | 'connected' | 'ping';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

interface UseChatSSEOptions {
  caseId: string | null;
  onEvent: (event: SSEEvent) => void;
}

export function useChatSSE({ caseId, onEvent }: UseChatSSEOptions) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    async function connect() {
      try {
        const token = await fetchSSEToken(caseId!);
        if (cancelled) return;

        const url = buildSSEUrl(caseId!, token);
        const es = new EventSource(url);
        eventSourceRef.current = es;

        const eventTypes: SSEEventType[] = ['message', 'typing', 'escalation', 'done', 'connected'];

        for (const type of eventTypes) {
          es.addEventListener(type, (e: MessageEvent) => {
            try {
              const data = e.data ? JSON.parse(e.data) : {};
              if (type === 'connected') {
                setConnected(true);
              }
              onEventRef.current({ type, data });
            } catch {
              // ignore parse errors
            }
          });
        }

        es.onerror = () => {
          setConnected(false);
        };
      } catch {
        setConnected(false);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
    };
  }, [caseId]);

  return { connected };
}
