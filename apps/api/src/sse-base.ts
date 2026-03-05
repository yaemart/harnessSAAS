export interface SSEConnectionBase {
  id: string;
  send: (event: string, data: string) => void;
  close: () => void;
}

export abstract class BaseSSEManager<TConn extends SSEConnectionBase> {
  protected connections = new Map<string, TConn[]>();

  protected abstract getKey(conn: TConn): string;
  protected abstract maxPerKey: number;
  protected abstract onEvict(conn: TConn): void;

  register(conn: TConn): boolean {
    const key = this.getKey(conn);
    const existing = this.connections.get(key) ?? [];
    if (existing.length >= this.maxPerKey) {
      const oldest = existing.shift();
      if (oldest) this.onEvict(oldest);
    }
    existing.push(conn);
    this.connections.set(key, existing);
    return true;
  }

  unregister(connId: string, key: string): void {
    const existing = this.connections.get(key);
    if (!existing) return;
    const filtered = existing.filter((c) => c.id !== connId);
    if (filtered.length === 0) {
      this.connections.delete(key);
    } else {
      this.connections.set(key, filtered);
    }
  }

  push(key: string, event: string, data: Record<string, unknown>): void {
    const conns = this.connections.get(key);
    if (!conns || conns.length === 0) return;
    const payload = JSON.stringify(data);
    for (const conn of conns) {
      try {
        conn.send(event, payload);
      } catch {
        this.unregister(conn.id, key);
      }
    }
  }

  hasConnections(key: string): boolean {
    const conns = this.connections.get(key);
    return !!conns && conns.length > 0;
  }

  getStats(): { totalConnections: number; keys: number } {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.length;
    }
    return { totalConnections: total, keys: this.connections.size };
  }
}
