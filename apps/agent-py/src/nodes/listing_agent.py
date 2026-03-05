from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def listing_agent_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    plan = state["commodity_plan"]
    intent = state["intent"]
    payload = intent.payload
    raw_scope = getattr(intent, "scope", None)
    scope_data = raw_scope if isinstance(raw_scope, dict) else {}

    target_listing_id = plan.get("primaryListingId", payload.get("listingId", "unknown"))
    if isinstance(payload.get("targetListingId"), str):
        target_listing_id = str(payload["targetListingId"])

    signal_context = {
        "platform": _extract(scope_data, "platform", payload.get("platform", "unknown")),
        "market": _extract(scope_data, "market", payload.get("market", "unknown")),
        "categoryId": _extract(scope_data, "categoryId", payload.get("categoryId")),
    }

    return {
        "listing_context": {
            "activeListingId": target_listing_id,
            "supervisorStrategy": plan.get("strategy", "growth"),
            "bidCapPct": float(plan.get("bidCapPct", 0.12)),
            "minBid": payload.get("minBid"),
            "currentBid": payload.get("currentBid"),
            "inventoryDays": payload.get("inventoryDays"),
            "profitMarginPct": payload.get("profitMarginPct"),
        },
        "signal_context": signal_context,
    }


def _extract(scope: dict, key: str, fallback=None):
    val = scope.get(key) if isinstance(scope, dict) else None
    return str(val) if val is not None else fallback
