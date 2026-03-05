# AI Governance Runtime — Code Simplicity Review

**Scope:** `harness-decay-engine.ts`, `harness-maturity-engine.ts`, `portal-agent.ts`, `support/page.tsx`  
**Date:** 2026-03-03

---

## Simplification Analysis

### Core Purpose

- **Decay Engine:** Recalculate `effectiveWeight` for knowledge entries; transition lifecycle (ACTIVE→DECAYING→DORMANT→ARCHIVED).
- **Maturity Engine:** Compute TMS from knowledge + feedback counts; derive AAL; apply autonomy override; upsert `TenantMaturity`.
- **Portal Agent:** Build system prompt with AAL-specific constraints (GUIDED/ASSISTED only).
- **Support Page:** Show AAL badge + TMS in AgentPanel; fetch maturity on mount.

---

## 1. DecayStats Interface — Over-Engineered (P2)

**Current:** Single `DecayStats` with `processed`, `weightUpdated`, `transitioned`, `archived` used by both `recalculateWeights()` and `transitionLifecycle()`.

**Problem:**
- `recalculateWeights()` only sets `processed` and `weightUpdated`; `transitioned` and `archived` stay 0.
- `transitionLifecycle()` only sets `transitioned` and `archived`; `processed` and `weightUpdated` stay 0.
- One interface forces both functions to carry dead fields.

**Evidence:**
```12:13:apps/api/src/harness-decay-engine.ts
export async function recalculateWeights(tenantId?: string): Promise<DecayStats> {
  const stats: DecayStats = { processed: 0, weightUpdated: 0, transitioned: 0, archived: 0 };
```
Lines 44–52 never touch `transitioned` or `archived`.

```61:62:apps/api/src/harness-decay-engine.ts
export async function transitionLifecycle(tenantId?: string): Promise<DecayStats> {
  const stats: DecayStats = { processed: 0, weightUpdated: 0, transitioned: 0, archived: 0 };
```
Lines 74–94 never touch `processed` or `weightUpdated`.

**Recommendation:** Split into two interfaces:

```ts
// harness-decay-engine.ts
interface WeightStats { processed: number; weightUpdated: number; }
interface LifecycleStats { transitioned: number; archived: number; }

export async function recalculateWeights(tenantId?: string): Promise<WeightStats> { ... }
export async function transitionLifecycle(tenantId?: string): Promise<LifecycleStats> { ... }
```

Update `harness-routes.ts` POST `/harness/knowledge/recalculate` to return `{ weights: WeightStats, lifecycle: LifecycleStats }` (no API shape change).

**Impact:** −4 dead fields, clearer separation of concerns. LOC: ~3 lines changed.

---

## 2. autonomyOverride Cap Logic — Keep for Phase 4 (P3)

**Question:** Is the autonomyOverride cap logic in `applyTMSUpdate` necessary for Phase 4?

**Answer:** Yes. Phase 4 spec (plan line 212) states: *"如果 autonomyOverride 存在且 < 计算值，使用 override"*.

**Current logic:**
```63:69:apps/api/src/harness-maturity-engine.ts
  if (existing?.autonomyOverride) {
    const overrideIndex = AAL_TIERS.findIndex((t) => t.config.level === existing.autonomyOverride);
    const computedIndex = AAL_TIERS.findIndex((t) => t.config.level === aal.level);
    if (overrideIndex >= 0 && overrideIndex < computedIndex) {
      effectiveLevel = existing.autonomyOverride as AAL;
    }
  }
```

- `overrideIndex < computedIndex` → override is *more restrictive* (e.g. GUIDED when computed is ASSISTED).
- Admin uses `PATCH /harness/maturity` with `autonomyOverride` to downgrade; engine must respect it.

**Recommendation:** Keep. Optional micro-simplification: extract `effectiveLevel` selection into a small helper to avoid repeated `findIndex`, but not required for Phase 4.

---

## 3. AAL Badge — Simplify via Badge Component (P2)

**Current:** Inline `AAL_LABELS` map + 6-line inline style block.

```395:400:apps/web/app/support/page.tsx
const AAL_LABELS: Record<string, { label: string; color: string }> = {
  GUIDED: { label: 'L1 Guided', color: 'var(--danger)' },
  ASSISTED: { label: 'L2 Assisted', color: 'var(--warning)' },
  SUPERVISED: { label: 'L3 Supervised', color: 'var(--accent)' },
  AUTONOMOUS: { label: 'L4 Autonomous', color: 'var(--success)' },
};
```

```502:508:apps/web/app/support/page.tsx
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
          background: `color-mix(in srgb, ${AAL_LABELS[aalLevel]?.color ?? 'var(--text-tertiary)'} 15%, transparent)`,
          color: AAL_LABELS[aalLevel]?.color ?? 'var(--text-tertiary)',
          border: `1px solid ${AAL_LABELS[aalLevel]?.color ?? 'var(--text-tertiary)'}`,
        }}>
          {AAL_LABELS[aalLevel]?.label ?? aalLevel} · TMS {tmsScore.toFixed(2)}
        </span>
```

**Problem:** Duplicates `Badge` styling; `StatusBadge` in the same file follows the same pattern.

**Recommendation:** Use `<Badge>` with semantic variants:

```ts
const AAL_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  GUIDED: { label: 'L1 Guided', variant: 'danger' },
  ASSISTED: { label: 'L2 Assisted', variant: 'warning' },
  SUPERVISED: { label: 'L3 Supervised', variant: 'info' },
  AUTONOMOUS: { label: 'L4 Autonomous', variant: 'success' },
};

// In JSX:
const cfg = AAL_BADGE[aalLevel] ?? { label: aalLevel, variant: 'default' };
<Badge variant={cfg.variant} style={{ borderRadius: '999px' }}>
  {cfg.label} · TMS {tmsScore.toFixed(2)}
</Badge>
```

**Impact:** −3 lines of inline style; reuse design system. LOC: ~−5.

---

## 4. Dead Code / Unused Exports (P3)

| Item | Location | Status |
|------|----------|--------|
| `recalculateTMS` | `harness-maturity-engine.ts` | Exported but only used by `applyTMSUpdate`. Not imported elsewhere. |

**Recommendation:** Remove `export` from `recalculateTMS` — make it an internal function.

```ts
// Change:
export async function recalculateTMS(tenantId: string): Promise<{...}> {
// To:
async function recalculateTMS(tenantId: string): Promise<{...}> {
```

**Impact:** −1 export surface; no behavioral change.

---

## 5. Other Simplification Opportunities

### 5.1 `buildSystemPrompt` — SUPERVISED/AUTONOMOUS Empty Strings (P3)

**Current:** Two conditional blocks for SUPERVISED and AUTONOMOUS yield `''` — they add no text.

```225:226:apps/api/src/portal-agent.ts
${autonomyLevel === 'GUIDED' ? `\nAUTONOMY CONSTRAINT (GUIDED mode):...` : ''}${autonomyLevel === 'ASSISTED' ? `\nAUTONOMY CONSTRAINT (ASSISTED mode):...` : ''}
```

SUPERVISED and AUTONOMOUS are never mentioned; they naturally fall through and add nothing.

**Recommendation:** Document intent with a short comment; no code change needed. Or collapse to a switch/map if preferred:

```ts
const AUTONOMY_HINTS: Record<string, string> = {
  GUIDED: '\nAUTONOMY CONSTRAINT (GUIDED mode):...',
  ASSISTED: '\nAUTONOMY CONSTRAINT (ASSISTED mode):...',
  SUPERVISED: '',
  AUTONOMOUS: '',
};
// Then: ${AUTONOMY_HINTS[autonomyLevel] ?? ''}
```

**Impact:** Slightly more structured; optional.

### 5.2 `runDailyMaturityJob` — Tenant Discovery Complexity (P3)

**Current:** Fetches existing `TenantMaturity` rows, then `groupBy` on `KnowledgeEntry` for tenants not in that set, then merges with `Set` for uniqueness.

**Assessment:** Needed to support:
- Tenants with prior maturity rows (e.g. from PATCH).
- New tenants with knowledge/feedback but no `TenantMaturity` yet.

**Recommendation:** Keep logic. Optional: add a one-line comment explaining why both sources are needed.

---

## Summary Table

| Finding | Severity | LOC Δ | Action |
|---------|----------|-------|--------|
| DecayStats split | P2 | ~3 | Split into WeightStats + LifecycleStats |
| autonomyOverride | P3 | 0 | Keep |
| AAL badge → Badge | P2 | ~−5 | Use Badge component |
| recalculateTMS export | P3 | −1 | Remove export |
| buildSystemPrompt map | P3 | optional | Optional refactor |

---

## Final Assessment

- **Total potential LOC reduction:** ~3–5%
- **Complexity score:** Low–Medium
- **Recommended action:** Apply P2 items (DecayStats split, AAL Badge); P3 items are optional refinements.
