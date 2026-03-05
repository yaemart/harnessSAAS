from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..models import (
    AuditableIntent,
    ContextAwareAnalysis,
    ObservationSet,
    ReasoningLog,
    StrategicRationale,
)
from ._shared import AgentState, verify_brain_purity


def analyze_and_decide_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    performance = state["performance"]
    roas = performance["normalizedRoas"]
    acos = performance["acos"]

    listing_ctx = state.get("listing_context", {})
    signal_ctx = state.get("signal_context", {})
    bid_cap = float(listing_ctx.get("bidCapPct", 0.12))
    supervisor_strategy = listing_ctx.get("supervisorStrategy", "growth")

    platform = signal_ctx.get("platform", "unknown")
    market = signal_ctx.get("market", "unknown")
    category_id = signal_ctx.get("categoryId")

    observation = ObservationSet(
        snapshot={
            "roas": roas,
            "acos": acos,
            "inventoryDays": state.get("commodity_plan", {}).get("inventoryDays"),
            "platform": platform,
            "market": market,
            "categoryId": category_id,
        },
        fossilized=True,
    )

    matched_rules = []
    rule_risk = 0.0
    if roas < 1.5:
        matched_rules.append("LOW_ROAS_BOUNDARY")
        rule_risk = 0.6

    orientation = ContextAwareAnalysis(
        analysis=(
            f"Orientation complete within {supervisor_strategy} strategy"
            f" | platform={platform}, market={market}, category={category_id or 'N/A'}."
        ),
        matchedRules=matched_rules,
        ruleRiskScore=rule_risk,
    )

    if roas >= 3.0:
        delta = 0.10
        rationale = "strong ROAS, increase bid"
    elif roas <= 1.5:
        delta = -0.10
        rationale = "weak ROAS, reduce bid"
    else:
        delta = 0.0
        rationale = "stable ROAS, hold bid"

    delta = max(-0.3, min(delta, bid_cap))

    decision_rationale = StrategicRationale(
        rationale=rationale,
        alternativesConsidered=(
            ["hold", "aggressive_increase"] if delta > 0 else ["hold", "deep_cut"]
        ),
    )

    trace_id = state.get("trace_id", str(uuid.uuid4()))

    proposed_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="AdjustBid",
        payload={
            "deltaPct": delta,
            "listingId": listing_ctx.get("activeListingId"),
            "strategy": supervisor_strategy,
        },
        tenantId=state["tenant_id"],
        traceId=trace_id,
        riskHint=0.3 if delta > 0 else 0.1,
        origin="AGENT",
        constitutionVersion="v1.0",
        timestamp=datetime.now(timezone.utc),
    )

    reasoning_log = ReasoningLog(
        traceId=trace_id,
        tenantId=state["tenant_id"],
        timestamp=datetime.now(timezone.utc),
        observe=observation,
        orient=orientation,
        decide=decision_rationale,
        act=proposed_intent,
    )

    return {"intent": proposed_intent, "reasoning_log": reasoning_log}
