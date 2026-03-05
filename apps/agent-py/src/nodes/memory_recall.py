from __future__ import annotations

from ._shared import AgentState, verify_brain_purity
from .observation_set import StructuredObservationSet


def memory_recall_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    obs = StructuredObservationSet.from_state(state)

    completeness = obs.signal_completeness()
    stale = obs.stale_signals()
    flat = obs.to_flat_snapshot()

    memory_context = {
        "observation_set": {
            "completeness": completeness,
            "overall_completeness": obs.overall_completeness(),
            "stale_signals": stale,
        },
        "flat_snapshot": flat,
        "recalled_experiences": [],
    }

    return {"memory_context": memory_context}
