from __future__ import annotations

from typing import Dict

from ._shared import AgentState, _hash_string


def _mock_performance_for_listing(listing_id: str) -> Dict[str, float]:
    seed = _hash_string(listing_id)
    impressions = 1000 + (seed % 18000)
    ctr = 0.02 + ((seed % 20) / 1000)
    clicks = max(1, int(impressions * ctr))
    cpc = 0.4 + ((seed % 80) / 100)
    spend = round(clicks * cpc, 2)
    cvr = 0.03 + ((seed % 20) / 1000)
    orders = max(1, int(clicks * cvr))
    aov = 25 + (seed % 45)
    sales = round(orders * aov, 2)
    roas = round(sales / spend, 4) if spend > 0 else 0.0
    acos = round(spend / sales, 4) if sales > 0 else 1.0
    return {
        "impressions": float(impressions),
        "clicks": float(clicks),
        "spend": float(spend),
        "sales": float(sales),
        "orders": float(orders),
        "normalizedRoas": float(roas),
        "acos": float(acos),
    }


def load_performance_node(state: AgentState) -> AgentState:
    intent = state["intent"]
    listing_id = state.get("listing_context", {}).get(
        "activeListingId", intent.payload.get("listingId", "unknown")
    )
    performance = _mock_performance_for_listing(listing_id)
    return {"performance": performance}
