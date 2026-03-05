# Agent-Native Architecture Review: Codex AI Ecom

**Audit Date:** 2026-03-02  
**Scope:** apps/api, apps/web, apps/portal, apps/agent-py, packages/database, MCP & harness routes

---

## Overall Score Summary

| Core Principle | Score | Percentage | Status |
|----------------|-------|------------|--------|
| Action Parity | 5/69 | 7% | ❌ |
| Tools as Primitives | 24/24 | 100% | ✅ |
| Context Injection | 7/10 | 70% | ⚠️ |
| Shared Workspace | All shared | 100% | ✅ |
| CRUD Completeness | 9–18/52 | 17–35% | ❌ |
| UI Integration | 6/10 | 60% | ⚠️ |
| Capability Discovery | 5/7 | 71% | ⚠️ |
| Prompt-Native Features | 3/10 | 30% | ❌ |

**Overall Agent-Native Score: ~53%** (average of principle scores, weighted by implementation surface)

### Status Legend
- ✅ **Excellent** (80%+)
- ⚠️ **Partial** (50–79%)
- ❌ **Needs Work** (<50%)

---

## 1. Action Parity — ❌ 5/69 (7%)

**Finding:** Only 5 user actions (support case list/get/reply/close, support stats) have matching agent tools in agent-py. Approvals, rules, portal config, harness, constitution, knowledge, evolution, portal consumer flows (OTP, warranty, cases, FAQ feedback, QR), and all SSE/stream endpoints have no agent-exposed tools.

**Missing:** 64 actions; MCP_SPEC tools (get_product_info, search_faq, register_warranty, create_support_case, etc.) are not implemented as callable agent tools.

---

## 2. Tools as Primitives — ✅ 24/24 (100%)

**Finding:** All identified tools (5 support tools in agent-py, 2 platform execute/read_facts, 3 platform-adapters, 14 user-pencil MCP) are primitives (read/write/list/execute). No workflow logic inside tools.

**Gap:** Support tools are implemented but not registered at runtime (main.py does not call bootstrap_tools); initial_tools() declares many names not in ToolRegistry.

---

## 3. Context Injection — ⚠️ 7/10 (70%)

**Finding:** Only portal-agent builds a dynamic system prompt (product, warranty, FAQ, knowledge, autonomy, capabilities). Session history is in user prompt, not system. Missing: explicit locale/preferences, case status line, conversation summary in system, dynamic capability list; agent-py preloaded context not consumed in prompts.

---

## 4. Shared Workspace — ✅ 100%

**Finding:** Single PostgreSQL + single Prisma; all user and agent flows (web, portal, portal-agent, queue, agent-py via API) read/write the same tables. No agent sandbox or separate DB.

---

## 5. CRUD Completeness — ❌ 9–18/52 (17–35%)

**Finding:** Only 9–10 entities have full C+R+U+D (Brand, Product, Platform, Category, Warehouse, Supplier, CommodityMedia, ConsumerFAQ; Market/BrandPortalConfig partial). Most entities lack Delete or partial Read/Update; many are internal (no public CRUD). Agent tools only cover support case operations.

---

## 6. UI Integration — ⚠️ 6/10 (60%)

**Finding:** Portal chat is strong (SSE: typing, streaming, done, escalation). Harness/approvals: intent.completed/failed/retry/rate_limit are pushed; intent.approval_required, intent.queued, intent.approved, intent.rejected are never emitted. Approvals list updates only on manual refresh after approve/reject. Support case list is mock; no real-time list updates.

---

## 7. Capability Discovery — ⚠️ 5/7 (71%)

**Finding:** Web dashboard has “What can the AI Agent do?” cards; portal has capability hint in chat sidebar, suggested quick issues, empty-state guidance, and agent self-describes in responses; /help exists (no /tools). Missing: portal onboarding for agent capabilities, dedicated help doc, slash-command visibility (e.g. “Try /help” in placeholder).

---

## 8. Prompt-Native Features — ❌ 3/10 (30%)

**Finding:** Portal agent behavior, autonomy constraints, media analysis output, and knowledge-graph/localization generation are prompt-defined. Escalation thresholds, AAL tiers, bid strategy, constitution guards, risk bands, decay formulas, /help text, and most agent-py logic are code-defined.

---

## Top 10 Recommendations by Impact

| Priority | Action | Principle | Effort |
|----------|--------|-----------|--------|
| 1 | Add agent tools for approvals, rules, portal config, harness, constitution, knowledge (or document agent boundary) | Action Parity | High |
| 2 | Register support tools at runtime (main.py → bootstrap_tools) and align initial_tools() with ToolRegistry | Tools as Primitives | Low |
| 3 | Emit intent.approval_required, intent.queued, intent.approved, intent.rejected and forward to SSE; add approval list real-time updates | UI Integration | Medium |
| 4 | Implement MCP_SPEC tools (get_product_info, search_faq, register_warranty, create_support_case, etc.) or equivalent API + agent tools | Action Parity | High |
| 5 | Add case status line and optional locale/preferences to portal system prompt; document preloaded usage for agent-py | Context Injection | Low |
| 6 | Add DELETE or documented “archive-only” for Listing, Commodity, RuleSet; GET :id for Market, ErpSystem, ThirdPartyLogistics where needed | CRUD Completeness | Medium |
| 7 | Portal: add “What I can do” / help entry and “Try /help” in input placeholder | Capability Discovery | Low |
| 8 | Externalize portal and knowledge-graph prompts to config/DB; unify /help content with buildSystemPrompt | Prompt-Native | Medium |
| 9 | Move AAL thresholds and TMS/decay parameters to config; keep constraint text in prompts | Prompt-Native | Medium |
| 10 | When moving to real GET /support/cases, add list refresh (polling or SSE) for support ops | UI Integration | Medium |

---

## What’s Working Well

1. **Shared workspace** — Single DB, single Prisma; no agent sandbox anti-pattern; tenant isolation only.
2. **Tools as primitives** — All audited tools are capability-only; no business orchestration inside tools.
3. **Portal chat UX** — SSE end-to-end (typing, streaming, done, escalation); immediate UI updates for consumer support.
4. **Portal system prompt** — Product, warranty, FAQ, knowledge, autonomy, and capabilities are injected; prompt drives tone and behavior.
5. **Capability discovery** — Quick issues, empty-state guidance, sidebar hint, and /help give users ways to discover agent capabilities on portal.

---

## References

- Action Parity: agent-py `support_tools.py`, `bootstrap.py`; apps/web `lib/api.ts`; MCP_SPEC.md
- Tools: apps/agent-py `tools/`, `interfaces.py`; platforms; mcps/user-pencil
- Context: apps/api `portal-agent.ts` `buildSystemPrompt`, `loadContext`, `loadTenantKnowledge`
- Shared workspace: packages/database prisma/schema.prisma; apps/api db.ts; portal-agent, queue, support-routes
- CRUD: packages/database/prisma/schema.prisma; apps/api routes (support, harness, portal-config, mdm, etc.)
- UI: apps/api sse-manager, event-bus, chat-sse-manager; apps/web use-agent-events, approvals-dashboard; apps/portal use-chat-sse, screen-chat
- Discovery: apps/web dashboard; apps/portal screen-chat (QUICK_ISSUES, /help, empty state)
- Prompt-native: portal-agent buildSystemPrompt; knowledge-graph-routes; harness-maturity-engine, harness-decay-engine; agent-py constitution_check, risk_check, analyze_and_decide
