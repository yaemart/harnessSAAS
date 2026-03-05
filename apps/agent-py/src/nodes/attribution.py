from __future__ import annotations

from typing import Any, Dict, List

from ._shared import AgentState, verify_brain_purity

ATTRIBUTION_DIMENSIONS = {
    "ads_efficiency": {
        "signals": ["ads.roas", "ads.acos", "ads.ctr", "ads.cvr"],
        "weight": 0.25,
    },
    "pricing_competitiveness": {
        "signals": ["competitor.price_delta", "financial.profit_margin_pct"],
        "weight": 0.20,
    },
    "inventory_health": {
        "signals": ["inventory.days_of_supply", "inventory.in_transit_units"],
        "weight": 0.15,
    },
    "customer_sentiment": {
        "signals": ["customer.review_score", "customer.return_rate"],
        "weight": 0.15,
    },
    "market_timing": {
        "signals": ["market.seasonality_factor", "market.is_promo_period"],
        "weight": 0.10,
    },
    "product_lifecycle": {
        "signals": ["lifecycle.stage"],
        "weight": 0.10,
    },
    "fx_impact": {
        "signals": ["financial.fx_impact_pct"],
        "weight": 0.05,
    },
}


def _score_dimension(
    flat_snapshot: Dict[str, Any],
    signals: List[str],
) -> float:
    values = []
    for sig in signals:
        val = flat_snapshot.get(sig)
        if val is not None:
            if isinstance(val, bool):
                values.append(1.0 if val else 0.0)
            elif isinstance(val, str):
                stage_scores = {"LAUNCH": 0.8, "GROWTH": 1.0, "MATURE": 0.6, "DECLINE": 0.3}
                values.append(stage_scores.get(val, 0.5))
            else:
                values.append(min(1.0, max(0.0, float(val))))
    if not values:
        return 0.0
    return sum(values) / len(values)


def compute_attribution(state: AgentState) -> Dict[str, Any]:
    memory_ctx = state.get("memory_context", {})
    flat = memory_ctx.get("flat_snapshot", {})

    outcome = state.get("outcome", {})
    profit_delta = float(outcome.get("profitDeltaPct", 0))

    contributions: Dict[str, Dict[str, Any]] = {}
    total_weighted = 0.0

    for dim_name, dim_config in ATTRIBUTION_DIMENSIONS.items():
        score = _score_dimension(flat, dim_config["signals"])
        weight = dim_config["weight"]
        weighted = score * weight
        total_weighted += weighted

        contributions[dim_name] = {
            "score": round(score, 4),
            "weight": weight,
            "weightedScore": round(weighted, 4),
            "signals": dim_config["signals"],
        }

    if total_weighted > 0 and profit_delta != 0:
        for dim_name, contrib in contributions.items():
            share = contrib["weightedScore"] / total_weighted
            contrib["attributedProfitDeltaPct"] = round(profit_delta * share, 4)
            contrib["contributionPct"] = round(share * 100, 2)
    else:
        for contrib in contributions.values():
            contrib["attributedProfitDeltaPct"] = 0.0
            contrib["contributionPct"] = 0.0

    return {
        "totalProfitDeltaPct": profit_delta,
        "dimensions": contributions,
    }


def attribution_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    attribution = compute_attribution(state)
    outcome = {**state.get("outcome", {})}
    outcome["attribution"] = attribution
    return {"outcome": outcome}
