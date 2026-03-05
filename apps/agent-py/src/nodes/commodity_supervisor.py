from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def commodity_supervisor_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    intent = state["intent"]
    payload = intent.payload
    listing_ids = payload.get("listingIds")
    if not isinstance(listing_ids, list) or len(listing_ids) == 0:
        listing_ids = [payload.get("listingId", "unknown")]

    primary_listing_id = payload.get("primaryListingId")
    if primary_listing_id not in listing_ids:
        primary_listing_id = listing_ids[0]

    inventory_days = float(payload.get("inventoryDays", 30))
    price_gap_pct = float(payload.get("priceGapPct", 0))

    if inventory_days < 14:
        strategy = "inventory_protection"
        bid_cap = -0.05
    elif price_gap_pct > 0.1:
        strategy = "price_alignment"
        bid_cap = 0.0
    else:
        strategy = "growth"
        bid_cap = 0.12

    return {
        "commodity_plan": {
            "commodityId": payload.get("commodityId"),
            "listingIds": listing_ids,
            "primaryListingId": primary_listing_id,
            "strategy": strategy,
            "bidCapPct": bid_cap,
            "inventoryDays": inventory_days,
            "priceGapPct": price_gap_pct,
        }
    }
