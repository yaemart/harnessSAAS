from __future__ import annotations

from typing import Any, Dict

from ._shared import AgentState, verify_brain_purity

CONFIDENCE_WEIGHTS = {
    "sampleAdequacy": 0.25,
    "dataFreshness": 0.20,
    "signalCompleteness": 0.20,
    "signalConsistency": 0.15,
    "decisionMagnitudePenalty": 0.10,
    "ruleCompliance": 0.10,
}


def _compute_sample_adequacy(perf: Dict[str, Any]) -> float:
    clicks = float(perf.get("clicks", 0))
    if clicks >= 300:
        return 1.0
    if clicks >= 30:
        return 0.3 + 0.7 * (clicks - 30) / 270
    return clicks / 30 * 0.3


def _compute_data_freshness(state: AgentState) -> float:
    freshness = state.get("freshness", {})
    if freshness.get("isFresh", True):
        return 1.0
    return 0.5


def _compute_signal_completeness(signal: Dict[str, Any]) -> float:
    expected = {"platform", "market", "categoryId", "lifecycleStage", "profitMarginPct", "reviewScore"}
    present = sum(1 for k in expected if signal.get(k) is not None)
    return present / len(expected)


def _compute_signal_consistency(state: AgentState) -> float:
    perf = state.get("performance", {})
    roas = float(perf.get("normalizedRoas", 0))
    acos = float(perf.get("acos", 0))
    if (roas >= 2.0 and acos <= 0.5) or (roas <= 1.5 and acos >= 0.5):
        return 1.0
    if (roas >= 1.5 and acos <= 0.7) or (roas <= 2.0 and acos >= 0.3):
        return 0.7
    return 0.4


def _compute_magnitude_penalty(state: AgentState) -> float:
    intent = state.get("intent")
    if not intent:
        return 1.0
    if hasattr(intent, "payload") and not isinstance(intent, dict):
        payload = intent.payload
    elif isinstance(intent, dict):
        payload = intent.get("payload", {})
    else:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    delta = abs(float(payload.get("deltaPct", 0)))
    if delta <= 0.05:
        return 1.0
    if delta <= 0.15:
        return 0.8
    if delta <= 0.25:
        return 0.5
    return 0.2


def _compute_rule_compliance(state: AgentState) -> float:
    constitution = state.get("constitution", {})
    if not constitution.get("pass", True):
        return 0.0
    risk = state.get("risk", {})
    violations = risk.get("violations", [])
    if len(violations) > 2:
        return 0.3
    if len(violations) > 0:
        return 0.7
    return 1.0


def compute_confidence(state: AgentState) -> Dict[str, Any]:
    perf = state.get("performance", {})
    signal = state.get("signal_context", {})

    factors = {
        "sampleAdequacy": _compute_sample_adequacy(perf),
        "dataFreshness": _compute_data_freshness(state),
        "signalCompleteness": _compute_signal_completeness(signal),
        "signalConsistency": _compute_signal_consistency(state),
        "decisionMagnitudePenalty": _compute_magnitude_penalty(state),
        "ruleCompliance": _compute_rule_compliance(state),
    }

    score = sum(factors[k] * CONFIDENCE_WEIGHTS[k] for k in CONFIDENCE_WEIGHTS)
    score = round(min(1.0, max(0.0, score)), 4)

    if score >= 0.85:
        level = "HIGH"
    elif score >= 0.60:
        level = "MEDIUM"
    elif score >= 0.40:
        level = "LOW"
    else:
        level = "VERY_LOW"

    return {"score": score, "level": level, "factors": factors}


def confidence_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    confidence = compute_confidence(state)
    return {"confidence": confidence}
