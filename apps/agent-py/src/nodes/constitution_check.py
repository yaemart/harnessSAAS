from __future__ import annotations

from typing import Dict

from ._shared import AgentState, verify_brain_purity

TENANT_WHITELIST = {
    "tenant_gold_retail": {
        "platforms": ["amazon", "walmart"],
        "allowedIntents": ["AdjustBid", "PauseCampaign", "TRIGGER_AGENT_OPTIMIZATION"],
        "isBetaNode": True,
    },
    "tenant_silver_retail": {
        "platforms": ["amazon"],
        "allowedIntents": ["AdjustBid"],
        "isBetaNode": False,
    },
}


def _check_kill_switches(state: AgentState) -> Dict[str, bool]:
    globall_freeze = False
    tenant_freeze = False
    intent_freeze = False

    return {
        "global": globall_freeze,
        "tenant": tenant_freeze,
        "intent": intent_freeze,
        "active": globall_freeze or tenant_freeze or intent_freeze,
    }


def constitution_check_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    ks = _check_kill_switches(state)
    if ks["active"]:
        return {
            "kill_switch_status": ks,
            "constitution": {
                "pass": False,
                "hardViolations": ["KILL_SWITCH_ACTIVE"],
                "freezeLevel": (
                    "GLOBAL"
                    if ks["global"]
                    else ("TENANT" if ks["tenant"] else "INTENT")
                ),
            },
        }

    tenant_id = state.get("tenant_id")
    intent = state["intent"]

    if tenant_id not in TENANT_WHITELIST:
        return {
            "kill_switch_status": ks,
            "constitution": {
                "pass": False,
                "hardViolations": ["UNAUTHORIZED_TENANT_ACCESS"],
                "version": "v1.1-Sovereign",
            },
        }

    config = TENANT_WHITELIST[tenant_id]
    if intent.type not in config["allowedIntents"]:
        return {
            "kill_switch_status": ks,
            "constitution": {
                "pass": False,
                "hardViolations": ["UNAUTHORIZED_INTENT_TYPE"],
                "version": "v1.1-Sovereign",
            },
        }

    payload = intent.payload
    listing_ctx = state.get("listing_context", {})
    performance = state.get("performance", {})
    delta_pct = float(payload.get("deltaPct", 0.0))

    hard_violations = []

    min_bid = listing_ctx.get("minBid")
    current_bid = listing_ctx.get("currentBid")
    if min_bid is not None and current_bid is not None:
        proposed_bid = float(current_bid) * (1 + delta_pct)
        if proposed_bid < float(min_bid):
            hard_violations.append("BID_BELOW_MIN_COST_GUARD")

    inventory_days = listing_ctx.get("inventoryDays")
    if inventory_days is not None and delta_pct > 0:
        if float(inventory_days) < 14.0:
            hard_violations.append("INVENTORY_TOO_LOW_FOR_SCALE_GUARD")

    profit_margin = listing_ctx.get("profitMarginPct")
    acos = float(performance.get("acos", 0.0))
    if profit_margin is not None and acos > 0:
        if acos > float(profit_margin) and delta_pct > 0:
            hard_violations.append("ACOS_EXCEEDS_PROFIT_MARGIN_GUARD")

    rule_risk_score = 0.0
    if abs(delta_pct) > 0.2:
        rule_risk_score = 0.8
    elif len(hard_violations) > 0:
        rule_risk_score = 1.0

    shadow_mode = payload.get("policyParams", {}).get("shadowMode", False)
    is_passing = len(hard_violations) == 0

    if shadow_mode and not is_passing:
        is_passing = True
        hard_violations = [f"SHADOW_VIOLATION:{v}" for v in hard_violations]

    return {
        "kill_switch_status": ks,
        "constitution": {
            "pass": is_passing,
            "hardViolations": hard_violations,
            "ruleRiskScore": rule_risk_score,
            "version": "v1.1-Sovereign",
            "shadowModeActive": shadow_mode,
        },
    }
