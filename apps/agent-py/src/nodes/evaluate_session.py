from __future__ import annotations

from typing import Any, Dict

from ._shared import AgentState, verify_brain_purity

SESSION_WEIGHTS = {
    "goal_achievement": 0.30,
    "execution_efficiency": 0.15,
    "tool_usage": 0.15,
    "self_correction": 0.10,
    "risk_compliance": 0.15,
    "business_impact": 0.15,
}


def _score_goal_achievement(state: AgentState) -> float:
    outcome = state.get("outcome", {})
    status = outcome.get("status", "unknown")
    if status == "SUCCESS":
        improvement = float(outcome.get("improvementPct", 0))
        base = 0.7
        bonus = min(0.3, improvement / 20.0 * 0.3) if improvement > 0 else 0.0
        return base + bonus
    if status == "PARTIAL":
        return 0.4
    return 0.1


def _score_execution_efficiency(state: AgentState) -> float:
    outcome = state.get("outcome", {})
    steps = int(outcome.get("stepCount", 5))
    latency_ms = float(outcome.get("latencyMs", 1000))
    step_score = 1.0 if steps <= 6 else max(0.3, 1.0 - (steps - 6) * 0.1)
    latency_score = 1.0 if latency_ms <= 500 else max(0.2, 1.0 - (latency_ms - 500) / 2000)
    return (step_score + latency_score) / 2


def _score_tool_usage(state: AgentState) -> float:
    memory_ctx = state.get("memory_context", {})
    obs = memory_ctx.get("observation_set", {})
    completeness = float(obs.get("overall_completeness", 0))
    stale = obs.get("stale_signals", {})
    stale_count = sum(len(v) for v in stale.values()) if isinstance(stale, dict) else 0
    stale_penalty = min(0.3, stale_count * 0.05)
    return max(0.0, completeness - stale_penalty)


def _score_self_correction(state: AgentState) -> float:
    outcome = state.get("outcome", {})
    retries = int(outcome.get("retryCount", 0))
    final_success = outcome.get("status") == "SUCCESS"
    if retries == 0:
        return 0.6
    if final_success:
        return min(1.0, 0.7 + retries * 0.1)
    return max(0.1, 0.5 - retries * 0.1)


def _score_risk_compliance(state: AgentState) -> float:
    constitution = state.get("constitution", {})
    risk = state.get("risk", {})
    if not constitution.get("pass", True):
        return 0.0
    violations = risk.get("violations", [])
    if len(violations) == 0:
        return 1.0
    return max(0.2, 1.0 - len(violations) * 0.2)


def _score_business_impact(state: AgentState) -> float:
    outcome = state.get("outcome", {})
    sales_delta = float(outcome.get("salesDeltaPct", 0))
    profit_delta = float(outcome.get("profitDeltaPct", 0))
    combined = sales_delta * 0.4 + profit_delta * 0.6
    if combined > 5:
        return 1.0
    if combined > 0:
        return 0.6 + combined / 5 * 0.4
    if combined > -5:
        return 0.3 + (combined + 5) / 5 * 0.3
    return 0.1


def evaluate_session(state: AgentState) -> Dict[str, Any]:
    factors = {
        "goal_achievement": _score_goal_achievement(state),
        "execution_efficiency": _score_execution_efficiency(state),
        "tool_usage": _score_tool_usage(state),
        "self_correction": _score_self_correction(state),
        "risk_compliance": _score_risk_compliance(state),
        "business_impact": _score_business_impact(state),
    }

    score = sum(factors[k] * SESSION_WEIGHTS[k] for k in SESSION_WEIGHTS)
    score = round(min(1.0, max(0.0, score)), 4)

    return {"score": score, "factors": factors, "weights": SESSION_WEIGHTS}


def evaluate_session_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    evaluation = evaluate_session(state)
    outcome = {**state.get("outcome", {})}
    outcome["qualityScore"] = evaluation["score"]
    outcome["scoreBreakdown"] = evaluation
    return {"outcome": outcome}
