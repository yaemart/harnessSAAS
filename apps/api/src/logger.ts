import crypto from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  tenantId?: string;
  traceId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
}

class StructuredLogger {
  private context: LogContext = {};

  child(ctx: LogContext): StructuredLogger {
    const logger = new StructuredLogger();
    logger.context = { ...this.context, ...ctx };
    return logger;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...meta },
    };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = new StructuredLogger();

export function createRequestLogger(tenantId?: string, userId?: string): StructuredLogger {
  return logger.child({
    requestId: crypto.randomUUID(),
    tenantId,
    userId,
  });
}
