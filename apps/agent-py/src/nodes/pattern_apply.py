from __future__ import annotations

from typing import Any, Dict, List

from ._shared import AgentState, verify_brain_purity

GRADE_PRIORITY = {"AUTO_FULL": 4, "AUTO_LOW": 3, "SUGGEST": 2, "SHADOW": 1}


def pattern_apply_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    memory_ctx = state.get("memory_context", {})
    matched_patterns: List[Dict[str, Any]] = memory_ctx.get("matched_patterns", [])

    if not matched_patterns:
        return {"pattern_context": {"applied": False, "reason": "no_patterns_matched"}}

    best = max(matched_patterns, key=lambda p: GRADE_PRIORITY.get(p.get("grade", "SHADOW"), 0))
    grade = best.get("grade", "SHADOW")
    rule_tree = best.get("ruleTree", {})
    pattern_id = best.get("id", "")

    risk = state.get("risk", {})
    risk_level = risk.get("level", "LOW")

    if risk_level in ("HIGH", "CRITICAL"):
        return {
            "pattern_context": {
                "applied": False,
                "reason": "high_risk_requires_human_approval",
                "patternId": pattern_id,
                "grade": grade,
            }
        }

    if grade == "SHADOW":
        return {
            "pattern_context": {
                "applied": False,
                "reason": "shadow_mode_log_only",
                "patternId": pattern_id,
                "suggestion": rule_tree,
            }
        }

    if grade == "SUGGEST":
        return {
            "pattern_context": {
                "applied": False,
                "reason": "suggest_mode_needs_confirmation",
                "patternId": pattern_id,
                "suggestion": rule_tree,
            }
        }

    if grade in ("AUTO_LOW", "AUTO_FULL"):
        return {
            "pattern_context": {
                "applied": True,
                "patternId": pattern_id,
                "grade": grade,
                "appliedRule": rule_tree,
            }
        }

    return {"pattern_context": {"applied": False, "reason": "unknown_grade"}}
