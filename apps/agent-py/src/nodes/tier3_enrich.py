from __future__ import annotations

from typing import Any, Dict

from ._shared import AgentState, verify_brain_purity


def tier3_enrich_node(state: AgentState) -> AgentState:
    verify_brain_purity()

    raw_intent = state.get("intent", {})
    if hasattr(raw_intent, "payload") and not isinstance(raw_intent, dict):
        payload = raw_intent.payload if isinstance(raw_intent.payload, dict) else {}
    elif isinstance(raw_intent, dict):
        payload = raw_intent.get("payload", {})
    else:
        payload = {}

    tier3: Dict[str, Any] = {}

    keywords_data = payload.get("keywordsData", {})
    if isinstance(keywords_data, dict):
        tier3["topKeywords"] = keywords_data.get("topKeywords", [])
        tier3["keywordCtr"] = float(keywords_data.get("avgKeywordCtr", 0))
        tier3["keywordCvr"] = float(keywords_data.get("avgKeywordCvr", 0))
        tier3["keywordSpend"] = float(keywords_data.get("totalKeywordSpend", 0))
        tier3["keywordCount"] = int(keywords_data.get("activeKeywordCount", 0))

    negative_reviews = payload.get("negativeReviews", {})
    if isinstance(negative_reviews, dict):
        tier3["negativeKeywords"] = negative_reviews.get("topKeywords", [])
        tier3["negativeReviewRate"] = float(negative_reviews.get("negativeRate", 0))
        tier3["commonComplaints"] = negative_reviews.get("commonComplaints", [])

    competitor_intel = payload.get("competitorIntel", {})
    if isinstance(competitor_intel, dict):
        tier3["competitorRank"] = int(competitor_intel.get("avgRank", 0))
        tier3["competitorReviewCount"] = int(competitor_intel.get("avgReviewCount", 0))
        tier3["competitorNewProducts"] = int(competitor_intel.get("newProductsLast30d", 0))
        tier3["competitorPriceRange"] = competitor_intel.get("priceRange", {})
        tier3["buyboxWinRate"] = float(competitor_intel.get("buyboxWinRate", 0))

    supplier_data = payload.get("supplierReliability", {})
    if isinstance(supplier_data, dict):
        tier3["supplierOnTimeRate"] = float(supplier_data.get("onTimeDeliveryRate", 0))
        tier3["supplierDefectRate"] = float(supplier_data.get("defectRate", 0))
        tier3["supplierLeadTimeDays"] = int(supplier_data.get("avgLeadTimeDays", 0))
        tier3["supplierLeadTimeVariance"] = float(supplier_data.get("leadTimeVarianceDays", 0))

    signal = state.get("signal_context", {})
    updated_signal = {
        **signal,
        "keywordCtr": tier3.get("keywordCtr", 0),
        "keywordCvr": tier3.get("keywordCvr", 0),
        "buyboxWinRate": tier3.get("buyboxWinRate", 0),
        "supplierOnTimeRate": tier3.get("supplierOnTimeRate", 0),
    }

    return {"tier3_signals": tier3, "signal_context": updated_signal}
