import crypto from 'node:crypto';

export interface AuditEntry {
  id: string;
  tenantId: string;
  action: string;
  payload: Record<string, unknown>;
  previousHash: string;
  hash: string;
  timestamp: string;
}

// Per-tenant hash chain heads. On restart, chains resume from genesis ('0'x64).
// Future: persist heads to DB for cross-restart continuity.
const tenantHeads = new Map<string, string>();
const GENESIS_HASH = '0'.repeat(64);

export function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getHead(tenantId: string): string {
  return tenantHeads.get(tenantId) ?? GENESIS_HASH;
}

export function createAuditEntry(
  tenantId: string,
  action: string,
  payload: Record<string, unknown>,
): AuditEntry {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const previousHash = getHead(tenantId);

  const hashInput = JSON.stringify({ id, tenantId, action, payload, previousHash, timestamp });
  const hash = computeHash(hashInput);

  tenantHeads.set(tenantId, hash);

  return { id, tenantId, action, payload, previousHash, hash, timestamp };
}

export function verifyChain(entries: AuditEntry[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const hashInput = JSON.stringify({
      id: entry.id,
      tenantId: entry.tenantId,
      action: entry.action,
      payload: entry.payload,
      previousHash: entry.previousHash,
      timestamp: entry.timestamp,
    });
    const expectedHash = computeHash(hashInput);
    if (expectedHash !== entry.hash) {
      return { valid: false, brokenAt: i };
    }
    if (i > 0 && entry.previousHash !== entries[i - 1].hash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
}
