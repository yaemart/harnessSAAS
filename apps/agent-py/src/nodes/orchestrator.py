from __future__ import annotations

from typing import Any, Dict, List, Optional

from ._shared import AgentState, verify_brain_purity

SUBGRAPH_REGISTRY: Dict[str, Dict[str, Any]] = {
    "ads_optimization": {
        "description": "Optimize advertising spend and bids",
        "required_signals": ["ads.roas", "ads.acos", "ads.ctr"],
        "domains": ["ads"],
        "risk_ceiling": "MEDIUM",
    },
    "pricing_strategy": {
        "description": "Adjust pricing based on competition and margins",
        "required_signals": ["competitor.price_delta", "financial.profit_margin_pct"],
        "domains": ["pricing"],
        "risk_ceiling": "HIGH",
    },
    "inventory_management": {
        "description": "Reorder and supply chain decisions",
        "required_signals": ["inventory.days_of_supply", "inventory.available_units"],
        "domains": ["inventory"],
        "risk_ceiling": "MEDIUM",
    },
    "listing_optimization": {
        "description": "Improve listing content and keywords",
        "required_signals": ["customer.review_score", "ads.ctr"],
        "domains": ["listing"],
        "risk_ceiling": "LOW",
    },
}


def select_subgraphs(
    intent_domain: str,
    available_signals: Dict[str, Any],
    risk_level: str = "LOW",
) -> List[Dict[str, Any]]:
    selected = []
    risk_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    current_risk = risk_order.get(risk_level, 0)

    for name, config in SUBGRAPH_REGISTRY.items():
        if intent_domain and intent_domain not in config["domains"]:
            continue

        ceiling_risk = risk_order.get(config["risk_ceiling"], 3)
        if current_risk > ceiling_risk:
            continue

        required = config["required_signals"]
        present = sum(1 for s in required if available_signals.get(s) is not None)
        completeness = present / len(required) if required else 0

        if completeness >= 0.5:
            selected.append({
                "name": name,
                "description": config["description"],
                "signalCompleteness": round(completeness, 2),
                "riskCeiling": config["risk_ceiling"],
            })

    selected.sort(key=lambda x: x["signalCompleteness"], reverse=True)
    return selected


def orchestrator_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    intent = state.get("intent")
    intent_domain = ""
    if intent:
        if hasattr(intent, "domain") and not isinstance(intent, dict):
            intent_domain = str(intent.domain)
        elif isinstance(intent, dict):
            intent_domain = str(intent.get("domain", ""))

    memory_ctx = state.get("memory_context", {})
    flat = memory_ctx.get("flat_snapshot", {})
    risk = state.get("risk", {})
    risk_level = risk.get("level", "LOW")

    subgraphs = select_subgraphs(intent_domain, flat, risk_level)

    cold_start = state.get("cold_start_context", {})
    exploration_rate = float(cold_start.get("explorationRate", 0.05))

    orchestration = {
        "selectedSubgraphs": subgraphs,
        "totalSubgraphs": len(subgraphs),
        "explorationRate": exploration_rate,
        "intentDomain": intent_domain,
    }

    return {"orchestration": orchestration}
