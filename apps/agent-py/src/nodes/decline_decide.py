from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..models import AuditableIntent, ContextAwareAnalysis, ObservationSet, ReasoningLog, StrategicRationale
from ._shared import AgentState, verify_brain_purity


def decline_decide_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    perf = state.get("performance", {})
    signal = state.get("signal_context", {})
    listing_ctx = state.get("listing_context", {})
    roas = float(perf.get("normalizedRoas", 0))
    profit_margin = float(signal.get("profitMarginPct", 0))

    observation = ObservationSet(
        snapshot={
            **perf,
            "platform": signal.get("platform"),
            "market": signal.get("market"),
            "categoryId": signal.get("categoryId"),
            "lifecycleStage": "DECLINE",
            "profitMarginPct": profit_margin,
        },
        fossilized=True,
    )

    if profit_margin < 0.05:
        delta = -0.20
        rationale = "DECLINE: near-zero margin, aggressive bid reduction to cut losses"
    elif roas < 1.0:
        delta = -0.15
        rationale = "DECLINE: negative ROAS, significant bid reduction"
    else:
        delta = -0.05
        rationale = "DECLINE: still profitable but declining, gradual bid reduction"

    delta = max(-0.3, min(delta, 0.0))

    orientation = ContextAwareAnalysis(
        analysis=f"Decline phase strategy: minimize losses, harvest remaining value | margin={profit_margin:.1%}",
        matchedRules=[],
        ruleRiskScore=0.5,
    )
    decision = StrategicRationale(
        rationale=rationale,
        alternativesConsidered=["pause_ads", "liquidation_push", "hold"],
    )
    trace_id = state.get("trace_id", str(uuid.uuid4()))
    proposed_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="AdjustBid",
        payload={"deltaPct": delta, "listingId": listing_ctx.get("activeListingId"), "strategy": "decline"},
        tenantId=state["tenant_id"],
        traceId=trace_id,
        riskHint=0.5,
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
