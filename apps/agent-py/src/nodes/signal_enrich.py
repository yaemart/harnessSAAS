from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def signal_enrich_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    signal = state.get("signal_context", {})
    raw_intent = state.get("intent", {})
    if hasattr(raw_intent, "payload") and not isinstance(raw_intent, dict):
        payload = raw_intent.payload if isinstance(raw_intent.payload, dict) else {}
    elif isinstance(raw_intent, dict):
        payload = raw_intent.get("payload", {})
    else:
        payload = {}
    perf = state.get("performance", {})

    selling_price = float(payload.get("sellingPrice", 0))
    if selling_price > 0:
        referral_fee_rate = float(payload.get("referralFeeRate", 0.15))
        fba_fee = float(payload.get("fbaFeePerUnit", 5.0))
        storage_cost = float(payload.get("storageCostPerUnit", 0.5))
        inbound_cost = float(payload.get("inboundCostPerUnit", 2.0))
        return_rate = float(payload.get("returnRate", 0.03))
        return_cost = float(payload.get("returnCostPerUnit", 3.0))
        fx_loss_rate = float(payload.get("fxLossRate", 0.02))
        vat_rate = float(payload.get("vatRate", 0))
        cost_price = float(payload.get("costPrice", 0))
        tacos = float(perf.get("acos", 0))

        total_cost = (
            cost_price
            + selling_price * referral_fee_rate
            + fba_fee
            + storage_cost
            + inbound_cost
            + return_rate * return_cost
            + selling_price * fx_loss_rate
            + selling_price * vat_rate
            + selling_price * tacos
        )
        profit = selling_price - total_cost
        profit_margin_pct = profit / selling_price
    else:
        profit_margin_pct = float(payload.get("profitMarginPct", 0))

    review_score = float(payload.get("reviewScore", 0))
    review_count = int(payload.get("reviewCount", 0))

    updated_signal = {
        **signal,
        "profitMarginPct": round(profit_margin_pct, 4),
        "reviewScore": review_score,
        "reviewCount": review_count,
    }
    return {"signal_context": updated_signal}
