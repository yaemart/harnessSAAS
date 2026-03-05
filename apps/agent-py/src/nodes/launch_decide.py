from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..models import AuditableIntent, ContextAwareAnalysis, ObservationSet, ReasoningLog, StrategicRationale
from ._shared import AgentState, verify_brain_purity


def launch_decide_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    perf = state.get("performance", {})
    signal = state.get("signal_context", {})
    listing_ctx = state.get("listing_context", {})
    roas = float(perf.get("normalizedRoas", 0))
    acos = float(perf.get("acos", 0))

    observation = ObservationSet(
        snapshot={
            **perf,
            "platform": signal.get("platform"),
            "market": signal.get("market"),
            "categoryId": signal.get("categoryId"),
            "lifecycleStage": "LAUNCH",
        },
        fossilized=True,
    )

    if acos > 0.8:
        delta = -0.05
        rationale = "LAUNCH: ACoS too high even for new product, slight reduction"
    elif roas >= 2.0:
        delta = 0.15
        rationale = "LAUNCH: strong early ROAS, increase bid aggressively for market share"
    else:
        delta = 0.05
        rationale = "LAUNCH: moderate performance, gentle bid increase for visibility"

    bid_cap = float(listing_ctx.get("bidCapPct", 0.15))
    delta = max(-0.3, min(delta, bid_cap))

    orientation = ContextAwareAnalysis(
        analysis=f"Launch phase strategy: prioritize visibility and review acquisition | platform={signal.get('platform')}, market={signal.get('market')}",
        matchedRules=[],
        ruleRiskScore=0.2,
    )
    decision = StrategicRationale(
        rationale=rationale,
        alternativesConsidered=["hold", "aggressive_push", "pause_and_evaluate"],
    )
    trace_id = state.get("trace_id", str(uuid.uuid4()))
    proposed_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="AdjustBid",
        payload={"deltaPct": delta, "listingId": listing_ctx.get("activeListingId"), "strategy": "launch"},
        tenantId=state["tenant_id"],
        traceId=trace_id,
        riskHint=0.3,
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
        decide=decision,
        act=proposed_intent,
    )
    return {"intent": proposed_intent, "reasoning_log": reasoning_log}
