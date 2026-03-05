from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def risk_check_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    intent = state["intent"]
    performance = state["performance"]
    const_data = state.get("constitution", {})

    delta = abs(float(intent.payload.get("deltaPct", 0)))
    acos = float(performance["acos"])
    score = min(1.0, round((delta * 2.5) + (acos * 0.8), 4))

    rule_risk = const_data.get("ruleRiskScore", 0.0)
    final_score = max(intent.riskHint, score, rule_risk)

    if final_score >= 0.9:
        level = "CRITICAL"
    elif final_score >= 0.7:
        level = "HIGH"
    elif final_score >= 0.4:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "risk": {
            "score": final_score,
            "level": level,
            "violations": [],
        }
    }
