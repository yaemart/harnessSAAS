from __future__ import annotations

from typing import Dict

from langgraph.graph import END, StateGraph

from .nodes import (
    AgentState,
    analyze_and_decide_node,
    attribution_node,
    auto_execute_node,
    cold_start_node,
    commodity_supervisor_node,
    confidence_node,
    constitution_check_node,
    decline_decide_node,
    evaluate_session_node,
    launch_decide_node,
    lifecycle_detect_node,
    listing_agent_node,
    load_performance_node,
    memory_recall_node,
    orchestrator_node,
    pattern_apply_node,
    risk_check_node,
    signal_enrich_node,
    strategy_router_node,
    tier2_enrich_node,
    tier3_enrich_node,
    validate_freshness_node,
)


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("commodity_supervisor_node", commodity_supervisor_node)
    graph.add_node("listing_agent_node", listing_agent_node)
    graph.add_node("load_performance_node", load_performance_node)
    graph.add_node("lifecycle_detect", lifecycle_detect_node)
    graph.add_node("signal_enrich", signal_enrich_node)
    graph.add_node("tier2_enrich", tier2_enrich_node)
    graph.add_node("launch_decide", launch_decide_node)
    graph.add_node("standard_decide", analyze_and_decide_node)
    graph.add_node("decline_decide", decline_decide_node)
    graph.add_node("confidence_check", confidence_node)
    graph.add_node("risk_check_node", risk_check_node)
    graph.add_node("constitution_check", constitution_check_node)
    graph.add_node("validate_freshness", validate_freshness_node)
    graph.add_node("auto_execute_node", auto_execute_node)
    graph.add_node("memory_recall", memory_recall_node)
    graph.add_node("tier3_enrich", tier3_enrich_node)
    graph.add_node("pattern_apply", pattern_apply_node)
    graph.add_node("cold_start", cold_start_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("evaluate_session", evaluate_session_node)
    graph.add_node("attribution", attribution_node)

    graph.set_entry_point("commodity_supervisor_node")
    graph.add_edge("commodity_supervisor_node", "listing_agent_node")
    graph.add_edge("listing_agent_node", "load_performance_node")
    graph.add_edge("load_performance_node", "lifecycle_detect")
    graph.add_edge("lifecycle_detect", "signal_enrich")
    graph.add_edge("signal_enrich", "tier2_enrich")
    graph.add_edge("tier2_enrich", "tier3_enrich")
    graph.add_edge("tier3_enrich", "memory_recall")
    graph.add_edge("memory_recall", "cold_start")
    graph.add_edge("cold_start", "orchestrator")
    graph.add_edge("orchestrator", "pattern_apply")
    graph.add_conditional_edges("pattern_apply", strategy_router_node)
    graph.add_edge("launch_decide", "confidence_check")
    graph.add_edge("standard_decide", "confidence_check")
    graph.add_edge("decline_decide", "confidence_check")
    graph.add_edge("confidence_check", "risk_check_node")
    graph.add_edge("risk_check_node", "constitution_check")
    graph.add_edge("constitution_check", "validate_freshness")
    graph.add_edge("validate_freshness", "auto_execute_node")
    graph.add_edge("auto_execute_node", "evaluate_session")
    graph.add_edge("evaluate_session", "attribution")
    graph.add_edge("attribution", END)

    return graph.compile()


def initial_tools() -> Dict[str, list[str]]:
    return {
        "read": [
            "get_listing_performance",
            "get_policy_params",
            "get_inventory_signal",
            "get_recent_reviews",
            "get_competitor_price_signal",
            "get_lifecycle_signals",
            "get_profit_breakdown",
            "get_tier2_signals",
            "get_tier3_signals",
            "recall_similar_experiences",
            "match_patterns",
            "get_public_knowledge",
            "get_industry_benchmarks",
            "get_cold_start_config",
            # Support tools
            "list_support_cases",
            "get_support_case",
            "get_support_stats",
        ],
        "write": [
            "create_intent_log",
            "enqueue_approval",
            "patch_listing_bid",
            "upsert_execution_snapshot",
            "write_experience",
            "record_pattern_application",
            "contribute_industry_benchmark",
            # Support tools
            "reply_support_case",
            "close_support_case",
        ],
    }
