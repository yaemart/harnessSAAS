export enum ErrorCode {
  PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  BUDGET_LIMIT_EXCEEDED = 'BUDGET_LIMIT_EXCEEDED',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export class HarnessError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HarnessError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      meta: this.meta,
      timestamp: new Date().toISOString(),
    };
  }
}

export function isRetryable(code: ErrorCode): boolean {
  return [
    ErrorCode.PLATFORM_UNAVAILABLE,
    ErrorCode.AGENT_TIMEOUT,
    ErrorCode.UNKNOWN,
  ].includes(code);
}
