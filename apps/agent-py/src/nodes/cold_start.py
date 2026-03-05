from __future__ import annotations

from typing import Any, Dict

from ._shared import AgentState, verify_brain_purity

PHASE_THRESHOLDS = {
    "COLD": (0, 49),
    "WARMING": (50, 500),
    "MATURE": (501, float("inf")),
}

PHASE_CONFIG = {
    "COLD": {
        "weights": {"layerA": 0.50, "layerB": 0.40, "layerC": 0.10},
        "explorationRate": 0.30,
        "maxPriceAdjustPct": 0.05,
    },
    "WARMING": {
        "weights": {"layerA": 0.30, "layerB": 0.30, "layerC": 0.40},
        "explorationRate": 0.15,
        "maxPriceAdjustPct": 0.08,
    },
    "MATURE": {
        "weights": {"layerA": 0.10, "layerB": 0.20, "layerC": 0.70},
        "explorationRate": 0.05,
        "maxPriceAdjustPct": 0.12,
    },
}


def determine_phase(experience_count: int) -> str:
    if experience_count < 50:
        return "COLD"
    if experience_count <= 500:
        return "WARMING"
    return "MATURE"


def apply_cold_start_constraints(
    state: AgentState,
    phase: str,
) -> Dict[str, Any]:
    config = PHASE_CONFIG.get(phase, PHASE_CONFIG["MATURE"])
    weights = config["weights"]
    max_adjust = config["maxPriceAdjustPct"]

    intent = state.get("intent")
    if intent:
        if hasattr(intent, "payload") and not isinstance(intent, dict):
            payload = intent.payload if isinstance(intent.payload, dict) else {}
        elif isinstance(intent, dict):
            payload = intent.get("payload", {})
        else:
            payload = {}

        delta = abs(float(payload.get("deltaPct", 0)))
        if delta > max_adjust:
            return {
                "constrained": True,
                "originalDeltaPct": delta,
                "cappedDeltaPct": max_adjust,
                "reason": f"Cold start phase {phase} caps adjustment to {max_adjust*100}%",
            }

    return {"constrained": False}


def cold_start_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    memory_ctx = state.get("memory_context", {})
    experience_count = int(memory_ctx.get("experience_count", 0))

    phase = determine_phase(experience_count)
    config = PHASE_CONFIG[phase]
    constraints = apply_cold_start_constraints(state, phase)

    cold_start_context = {
        "phase": phase,
        "experienceCount": experience_count,
        "knowledgeWeights": config["weights"],
        "explorationRate": config["explorationRate"],
        "maxPriceAdjustPct": config["maxPriceAdjustPct"],
        "constraints": constraints,
    }

    return {"cold_start_context": cold_start_context}
