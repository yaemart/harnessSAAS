from __future__ import annotations

from typing import Any, Dict, TypedDict

from ..models import AuditableIntent, ReasoningLog


class SecurityError(Exception):
    """Raised when an architectural boundary is breached."""
    pass


def verify_brain_purity():
    """Ensure no execution-capable modules are loaded in the brain's context."""
    import sys
    forbidden_keywords = ['prisma', 'sqlalchemy', 'boto3', 'google.cloud']
    loaded_modules = sys.modules.keys()

    for kw in forbidden_keywords:
        if any(kw in mod for mod in loaded_modules):
            raise SecurityError(f"DEATHLINE_BREACH: Brain context contaminated by {kw}")


class AgentState(TypedDict, total=False):
    run_id: str
    tenant_id: str
    trace_id: str
    intent: AuditableIntent
    reasoning_log: ReasoningLog
    tools: Dict[str, list[str]]
    performance: Dict[str, float]
    commodity_plan: Dict[str, Any]
    listing_context: Dict[str, Any]
    signal_context: Dict[str, Any]
    risk: Dict[str, Any]
    constitution: Dict[str, Any]
    kill_switch_status: Dict[str, bool]
    freshness: Dict[str, Any]
    confidence: Dict[str, Any]
    outcome: Dict[str, Any]
    tier2_signals: Dict[str, Any]
    tier3_signals: Dict[str, Any]
    memory_context: Dict[str, Any]
    pattern_context: Dict[str, Any]
    cold_start_context: Dict[str, Any]
    orchestration: Dict[str, Any]


def _hash_string(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h
