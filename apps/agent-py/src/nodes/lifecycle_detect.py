from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def lifecycle_detect_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    signal = state.get("signal_context", {})
    raw_intent = state.get("intent", {})
    if hasattr(raw_intent, "payload") and not isinstance(raw_intent, dict):
        payload = raw_intent.payload if isinstance(raw_intent.payload, dict) else {}
    elif isinstance(raw_intent, dict):
        payload = raw_intent.get("payload", {})
    else:
        payload = {}

    days_since_launch = float(payload.get("daysSinceLaunch", 999))
    review_count = int(payload.get("reviewCount", 0))
    sales_slope_30d = float(payload.get("salesSlope30d", 0))
    acos_trend = float(payload.get("acosTrend", 0))
    return_rate = float(payload.get("returnRate", 0))

    scores = {
        "LAUNCH": 0.0,
        "GROWTH": 0.0,
        "MATURE": 0.0,
        "DECLINE": 0.0,
    }

    # LAUNCH signals
    if days_since_launch < 90:
        scores["LAUNCH"] += 0.4 * (1 - days_since_launch / 90)
    if review_count < 50:
        scores["LAUNCH"] += 0.3 * (1 - review_count / 50)
    if sales_slope_30d > 0:
        scores["LAUNCH"] += 0.3 * min(sales_slope_30d / 0.1, 1.0)

    # GROWTH signals
    if sales_slope_30d > 0.03:
        scores["GROWTH"] += 0.4 * min(sales_slope_30d / 0.1, 1.0)
    if review_count >= 50 and days_since_launch >= 30:
        scores["GROWTH"] += 0.3
    if acos_trend < 0:
        scores["GROWTH"] += 0.3 * min(abs(acos_trend) / 0.05, 1.0)

    # MATURE signals
    if abs(sales_slope_30d) < 0.02:
        scores["MATURE"] += 0.4 * (1 - abs(sales_slope_30d) / 0.02)
    if review_count >= 200:
        scores["MATURE"] += 0.3
    if days_since_launch >= 180:
        scores["MATURE"] += 0.3

    # DECLINE signals
    if sales_slope_30d < -0.03:
        scores["DECLINE"] += 0.35 * min(abs(sales_slope_30d) / 0.1, 1.0)
    if acos_trend > 0.03:
        scores["DECLINE"] += 0.35 * min(acos_trend / 0.1, 1.0)
    if return_rate > 0.08:
        scores["DECLINE"] += 0.3 * min(return_rate / 0.15, 1.0)

    max_score = max(scores.values())
    stage = max(scores, key=scores.get) if max_score > 0 else "MATURE"

    updated_signal = {**signal, "lifecycleStage": stage}
    return {"signal_context": updated_signal}
