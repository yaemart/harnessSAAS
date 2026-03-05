import { EventEmitter } from 'node:events';
import { Client, type Notification } from 'pg';
import { env } from './env.js';

export interface ApprovalEvent {
  id: string;
  tenantId: string;
  intentId: string;
  domain: string;
  action: string;
  status: string;
  createdAt: string;
}

export const approvalEvents = new EventEmitter();
approvalEvents.setMaxListeners(1000);

let listenerClient: Client | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function connect(): Promise<void> {
  const client = new Client({ connectionString: env.DATABASE_URL });

  client.on('error', (err) => {
    console.error('LISTEN client error, scheduling reconnect...', err.message);
    listenerClient = null;
    scheduleReconnect();
  });

  client.on('end', () => {
    console.warn('LISTEN client disconnected, scheduling reconnect...');
    listenerClient = null;
    scheduleReconnect();
  });

  client.on('notification', (message: Notification) => {
    if (!message.payload) return;
    try {
      const parsed = JSON.parse(message.payload) as ApprovalEvent;
      approvalEvents.emit('approval.created', parsed);
    } catch {
      // Ignore malformed messages
    }
  });

  await client.connect();
  await client.query(`LISTEN ${env.APPROVAL_SSE_CHANNEL}`);
  listenerClient = client;
  console.log('LISTEN client connected');
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await connect();
    } catch (err) {
      console.error('LISTEN reconnect failed, retrying...', (err as Error).message);
      scheduleReconnect();
    }
  }, 3000);
}

export async function startApprovalNotificationListener(): Promise<void> {
  if (listenerClient) return;
  try {
    await connect();
  } catch (err) {
    console.error('Initial LISTEN connect failed, scheduling reconnect...', (err as Error).message);
    scheduleReconnect();
  }
}

export async function stopApprovalNotificationListener(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!listenerClient) return;
  await listenerClient.end();
  listenerClient = null;
}
