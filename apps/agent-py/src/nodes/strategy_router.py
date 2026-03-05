from __future__ import annotations

from ._shared import AgentState, verify_brain_purity


def strategy_router_node(state: AgentState) -> str:
    """Returns the name of the next node based on lifecycle stage."""
    verify_brain_purity()
    signal = state.get("signal_context", {})
    stage = signal.get("lifecycleStage", "MATURE")

    route_map = {
        "LAUNCH": "launch_decide",
        "GROWTH": "standard_decide",
        "MATURE": "standard_decide",
        "DECLINE": "decline_decide",
    }
    return route_map.get(stage, "standard_decide")
