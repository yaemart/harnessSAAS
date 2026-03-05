from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def tier2_enrich_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    raw_intent = state.get("intent", {})
    if hasattr(raw_intent, "payload") and not isinstance(raw_intent, dict):
        payload = raw_intent.payload if isinstance(raw_intent.payload, dict) else {}
    elif isinstance(raw_intent, dict):
        payload = raw_intent.get("payload", {})
    else:
        payload = {}

    perf = state.get("performance", {})
    signal = state.get("signal_context", {})

    impressions = float(perf.get("impressions", 0))
    clicks = float(perf.get("clicks", 0))
    orders = float(perf.get("orders", perf.get("conversions", 0)))

    ctr = clicks / impressions if impressions > 0 else 0.0
    cvr = orders / clicks if clicks > 0 else 0.0

    competitor_avg_price = float(payload.get("competitorAvgPrice", 0))
    selling_price = float(payload.get("sellingPrice", 0))
    competitor_price_delta = 0.0
    if competitor_avg_price > 0 and selling_price > 0:
        competitor_price_delta = (selling_price - competitor_avg_price) / competitor_avg_price

    return_rate = float(payload.get("returnRate", perf.get("returnRate", 0)))

    in_transit_units = int(payload.get("inTransitUnits", 0))
    available_units = int(payload.get("availableUnits", 0))
    days_of_supply = float(payload.get("daysOfSupply", 0))

    is_promo_period = bool(payload.get("isPromoPeriod", False))
    seasonality_factor = float(payload.get("seasonalityFactor", 1.0))

    fx_rate = float(payload.get("fxRate", 1.0))
    fx_baseline = float(payload.get("fxBaseline", 1.0))
    fx_impact_pct = (fx_rate - fx_baseline) / fx_baseline if fx_baseline > 0 else 0.0

    tier2 = {
        "ctr": round(ctr, 6),
        "cvr": round(cvr, 6),
        "competitorPriceDelta": round(competitor_price_delta, 4),
        "returnRate": round(return_rate, 4),
        "inTransitUnits": in_transit_units,
        "availableUnits": available_units,
        "daysOfSupply": round(days_of_supply, 1),
        "isPromoPeriod": is_promo_period,
        "seasonalityFactor": round(seasonality_factor, 2),
        "fxImpactPct": round(fx_impact_pct, 4),
    }

    updated_signal = {
        **signal,
        "ctr": tier2["ctr"],
        "cvr": tier2["cvr"],
        "competitorPriceDelta": tier2["competitorPriceDelta"],
        "isPromoPeriod": tier2["isPromoPeriod"],
        "seasonalityFactor": tier2["seasonalityFactor"],
    }

    return {"tier2_signals": tier2, "signal_context": updated_signal}
