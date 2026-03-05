import { BaseSSEManager, type SSEConnectionBase } from './sse-base.js';

export type ChatSSEEventType = 'message' | 'typing' | 'escalation' | 'done';

export interface ChatSSEConnection extends SSEConnectionBase {
  caseId: string;
  consumerId: string;
}

const MAX_CONNECTIONS_PER_CASE = 3;

class ChatSSEManager extends BaseSSEManager<ChatSSEConnection> {
  protected maxPerKey = MAX_CONNECTIONS_PER_CASE;

  protected getKey(conn: ChatSSEConnection): string {
    return conn.caseId;
  }

  protected onEvict(conn: ChatSSEConnection): void {
    try { conn.close(); } catch { /* ignore */ }
  }

  pushToCase(caseId: string, event: ChatSSEEventType, data: Record<string, unknown>): void {
    this.push(caseId, event, data);
  }
}

export const chatSSEManager = new ChatSSEManager();
