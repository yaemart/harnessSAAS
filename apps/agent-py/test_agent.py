import json
import uuid
from datetime import datetime, timezone
from src.graph_runtime import build_graph, initial_tools
from src.nodes.load_performance import _mock_performance_for_listing

graph = build_graph()

def test_run(listing_id, min_bid, current_bid, inventory_days=None, profit_margin_pct=None):
    intent_payload = {
        "minBid": min_bid,
        "currentBid": current_bid,
    }
    if inventory_days is not None:
        intent_payload["inventoryDays"] = inventory_days
    if profit_margin_pct is not None:
        intent_payload["profitMarginPct"] = profit_margin_pct
    
    intent = {
        "intentId": str(uuid.uuid4()),
        "domain": "ads",
        "action": "AdjustBid",
        "target": { "type": "listing", "id": listing_id },
        "scope": { "tenantId": "tnt-demo", "platform": "amazon", "market": "US" },
        "payload": intent_payload,
        "risk": {
            "score": 0.0,
            "level": "LOW",
            "violations": []
        },
        "reasoning": {
            "summary": "Auto testing",
            "evidence": []
        },
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    state = {
        "run_id": str(uuid.uuid4()),
        "tenant_id": "tnt-demo",
        "intent": intent,
        "tools": initial_tools(),
    }
    
    # Check what ROAS this listing_id gets
    perf = _mock_performance_for_listing(listing_id)
    print(f"--- Triggering agent for {listing_id} ---")
    print(f"Performance: ROAS = {perf['normalizedRoas']}, ACoS = {perf['acos']}")
    
    result = graph.invoke(state)
    outcome = result.get('outcome', {})
    
    print("Agent Decision:", outcome.get('decision'))
    print("Risk Assessment:", outcome.get('risk'))
    print("Constitution Checks:", outcome.get('constitution'))
    print("Final Status:", outcome.get('status'))
    print()

def find_listing_by_roas(target):
    for i in range(10000):
        name = f"LST_TEST_{i}"
        perf = _mock_performance_for_listing(name)
        r = perf['normalizedRoas']
        if target == 'poor' and r <= 1.5:
            return name
        elif target == 'strong' and r >= 3.0:
            return name
    return "UNKNOWN"

if __name__ == "__main__":
    poor_lst = find_listing_by_roas('poor')
    strong_lst = find_listing_by_roas('strong')

    # Test 1: Low ROAS, bid decrease -> Trigger Constitution Violation (Bid Below Cost)
    print("\n========== TEST 1: CONSTITUTION VIOLATION ==========")
    print("Agent should decide to reduce bid because ROAS is poor.")
    print("However, constitution should block it because the new bid falls below minBid cost.\n")
    test_run(poor_lst, min_bid=0.8, current_bid=0.8)

    # Test 2: Strong ROAS, bid increase -> Success
    print("\n========== TEST 2: SUCCESSFUL GROWTH ==========")
    print("Agent should decide to increase bid because ROAS is strong.")
    print("The new bid is safely above minBid so constitution allows it.\n")
    test_run(strong_lst, min_bid=0.2, current_bid=0.6)

    # Test 3: Strong ROAS, bid increase -> Trigger Inventory Violation
    print("\n========== TEST 3: CONSTITUTION VIOLATION (INVENTORY TOO LOW) ==========")
    print("Agent wants to increase bid because ROAS is strong.")
    print("However, constitution blocks it because inventory is under 14 days.\n")
    test_run(strong_lst, min_bid=0.2, current_bid=0.6, inventory_days=8)

    # Test 4: Strong ROAS, bid increase -> Trigger Profit Margin Violation
    # We need a case where ACoS is > Profit Margin
    print("\n========== TEST 4: CONSTITUTION VIOLATION (ACOS > PROFIT MARGIN) ==========")
    print("Agent wants to increase bid because ROAS is strong (> 3.0), but ACoS might be around 0.3.")
    print("If we set our Profit Margin Ceiling to 0.2 (20%), constitution should block scaling.\n")
    test_run(strong_lst, min_bid=0.2, current_bid=0.6, profit_margin_pct=0.2)
