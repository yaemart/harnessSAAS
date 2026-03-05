from __future__ import annotations

from datetime import datetime, timezone

from ._shared import AgentState, verify_brain_purity

DATA_QUALITY_THRESHOLD = 0.7


def validate_freshness_node(state: AgentState) -> AgentState:
    verify_brain_purity()
    intent = state["intent"]
    payload = intent.payload
    signal_ts = payload.get("signalTimestamp")
    policy_params = payload.get("policyParams", {})
    ttl_minutes = float(policy_params.get("freshnessTtlMinutes", 30))

    quality_meta = state.get("signal_context", {}).get("quality_meta", {})
    data_quality_score = float(quality_meta.get("data_quality_score", 1.0))
    feature_frozen = bool(quality_meta.get("feature_frozen", False))

    # Data quality and freeze checks write to freshness.skipReason to avoid
    # being overwritten by downstream nodes that always return their own outcome.
    if data_quality_score < DATA_QUALITY_THRESHOLD:
        return {
            "freshness": {
                "isFresh": False,
                "ageMinutes": 0.0,
                "ttlMinutes": ttl_minutes,
                "skipReason": "data_quality_below_threshold",
                "skipDetail": f"dataQualityScore={data_quality_score:.3f} < {DATA_QUALITY_THRESHOLD}",
            },
        }

    if feature_frozen:
        frozen_reason = quality_meta.get("frozen_reason", "entity_frozen_pending_rebuild")
        return {
            "freshness": {
                "isFresh": False,
                "ageMinutes": 0.0,
                "ttlMinutes": ttl_minutes,
                "skipReason": "entity_frozen",
                "skipDetail": frozen_reason,
            },
        }

    if not signal_ts:
        return {
            "freshness": {"isFresh": True, "ageMinutes": 0.0, "ttlMinutes": ttl_minutes}
        }

    try:
        observed_at = datetime.fromisoformat(str(signal_ts).replace("Z", "+00:00"))
        age_minutes = (datetime.now(timezone.utc) - observed_at).total_seconds() / 60.0
        is_fresh = age_minutes <= ttl_minutes
    except ValueError:
        age_minutes = 9999.0
        is_fresh = False

    return {
        "freshness": {
            "isFresh": is_fresh,
            "ageMinutes": round(age_minutes, 2),
            "ttlMinutes": ttl_minutes,
        }
    }
