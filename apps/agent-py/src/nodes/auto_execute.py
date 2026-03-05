from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def auto_execute_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    constitution = state["constitution"]
    freshness = state.get("freshness", {"isFresh": True})
    risk = state["risk"]
    intent = state["intent"]
    log = state.get("reasoning_log")

    resume_approved = bool(intent.payload.get("resumeApproved"))

    if not constitution["pass"]:
        status = "REJECTED_BY_CONSTITUTION"
    elif not freshness.get("isFresh", True):
        status = "REJECTED_STALE_CONTEXT"
    elif risk["score"] >= 0.7 and not resume_approved:
        status = "AWAITING_APPROVAL"
    elif resume_approved:
        status = "RESUMED_COMPLETED"
    else:
        status = "COMPLETED"

    outcome = {
        "status": status,
        "intent": intent.model_dump(),
        "reasoningLog": log.model_dump() if log else None,
        "risk": risk,
        "constitution": constitution,
        "freshness": freshness,
        "commodityPlan": state.get("commodity_plan", {}),
        "listingContext": state.get("listing_context", {}),
        "governance": {
            "rollbackScheduled": status == "COMPLETED",
            "verificationWindowHours": 4,
        },
    }

    return {"outcome": outcome}
