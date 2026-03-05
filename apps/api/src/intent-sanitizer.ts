import type { AgentIntent } from '@repo/shared-types';

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /^\s*system\s*:\s*/im,
  /\bdo\s+not\s+follow\b/i,
  /\bforget\s+(everything|all|your)\b/i,
  /\bact\s+as\s+(if|a|an)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\b/,
  /\bpretend\b.*\b(you|that)\b/i,
  /\boverride\b.*\b(rules?|constitution|policy)\b/i,
];

const DELTA_PCT_MIN = -30;
const DELTA_PCT_MAX = 30;

export interface SanitizeResult {
  ok: boolean;
  violations: string[];
}

const MAX_SCAN_DEPTH = 10;

function deepScanForInjection(obj: unknown, path: string, violations: string[], depth = 0): void {
  if (depth > MAX_SCAN_DEPTH) return;
  if (typeof obj === 'string') {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(obj)) {
        violations.push(`PROMPT_INJECTION_DETECTED:${path}:${pattern.source}`);
        return;
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      deepScanForInjection(obj[i], `${path}[${i}]`, violations, depth + 1);
    }
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      deepScanForInjection(value, `${path}.${key}`, violations, depth + 1);
    }
  }
}

function validateDeltaPctBounds(intent: AgentIntent, violations: string[]): void {
  const payload = intent.payload as Record<string, unknown>;
  const candidates = [payload.deltaPct, payload.bidDeltaPct, payload.percent];

  for (const val of candidates) {
    if (typeof val !== 'number') continue;
    if (val < DELTA_PCT_MIN || val > DELTA_PCT_MAX) {
      violations.push(
        `DELTA_PCT_OUT_OF_BOUNDS:${val} not in [${DELTA_PCT_MIN}, ${DELTA_PCT_MAX}]`,
      );
    }
  }
}

function validateRequiredFields(intent: AgentIntent, violations: string[]): void {
  if (!intent.intentId || typeof intent.intentId !== 'string') {
    violations.push('MISSING_REQUIRED:intentId');
  }
  if (!intent.domain) {
    violations.push('MISSING_REQUIRED:domain');
  }
  if (!intent.action || typeof intent.action !== 'string') {
    violations.push('MISSING_REQUIRED:action');
  }
  if (!intent.target?.id || !intent.target?.type) {
    violations.push('MISSING_REQUIRED:target(type+id)');
  }
  if (!intent.scope?.tenantId) {
    violations.push('MISSING_REQUIRED:scope.tenantId');
  }
}

export function sanitizeIntent(intent: AgentIntent): SanitizeResult {
  const violations: string[] = [];

  validateRequiredFields(intent, violations);
  validateDeltaPctBounds(intent, violations);
  deepScanForInjection(intent.payload, 'payload', violations);

  if (intent.reasoning) {
    deepScanForInjection(intent.reasoning.summary, 'reasoning.summary', violations);
    for (const ev of intent.reasoning.evidence ?? []) {
      deepScanForInjection(ev.note, 'reasoning.evidence.note', violations);
    }
  }

  return { ok: violations.length === 0, violations };
}
