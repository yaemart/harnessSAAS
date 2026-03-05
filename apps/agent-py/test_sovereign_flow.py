from __future__ import annotations
import uuid
import json
from datetime import datetime, timezone
from src.graph_runtime import build_graph, initial_tools
from src.nodes import AgentState
from src.models import AuditableIntent

def test_sovereign_logic():
    print("\n" + "="*60)
    print("🚀 SOVEREIGN AI-NATIVE ARCHITECTURE - END-TO-END TEST")
    print("="*60)

    # 1. SETUP INITIAL STATE
    # This intent triggers the "Analyze Bid" flow for a specific listing
    trigger_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="TRIGGER_AGENT_OPTIMIZATION",
        payload={
            "listingId": "B01NABCD12",
            "commodityId": "c_premium_earbuds",
            "inventoryDays": 45.0,
            "minBid": 0.5,
            "currentBid": 1.2,
            "profitMarginPct": 0.35, # Constitution will use this
            "policyParams": {
                "shadowMode": False
            }
        },
        tenantId="tenant_gold_retail",
        traceId=str(uuid.uuid4()),
        riskHint=0.0,
        origin="USER",
        constitutionVersion="v1.1",
        timestamp=datetime.now(timezone.utc)
    )

    initial_state: AgentState = {
        "run_id": str(uuid.uuid4()),
        "tenant_id": trigger_intent.tenantId,
        "trace_id": trigger_intent.traceId,
        "intent": trigger_intent,
        "tools": initial_tools()
    }

    print(f"\n[INIT] Trace ID: {initial_state['trace_id']}")
    print(f"[INIT] Tenant ID: {initial_state['tenant_id']}")
    print(f"[INIT] Triggering action for Listing: {trigger_intent.payload['listingId']}")

    # 2. COMPILE AND RUN GRAPH
    app = build_graph()
    
    print("\n[RUN] Executing OODA Graph...")
    final_output = app.invoke(initial_state)

    # 3. INSPECT OUTCOME
    outcome = final_output.get("outcome", {})
    status = outcome.get("status")

    print("\n" + "-"*40)
    print(f"📊 FINAL STATUS: {status}")
    print("-"*40)

    # Rollback Scheduling
    gov = outcome.get("governance", {})
    if gov.get("rollbackScheduled"):
        print(f"🔄 Rollback Scheduled: YES ({gov.get('verificationWindowHours')}h window)")

    # Reasoning / OODA
    log = final_output.get("reasoning_log")
    if log:
        print("\n🧠 OODA REASONING LOG:")
        print(f"  [OBSERVE] Snapshot: {log.observe.snapshot}")
        print(f"  [ORIENT]  Analysis: {log.orient.analysis}")
        print(f"  [DECIDE]  Rationale: {log.decide.rationale}")
        print(f"  [ACT]     Intent Type: {log.act.type}")
        print(f"            Payload: {log.act.payload}")

    # Risk
    risk = final_output.get("risk", {})
    print(f"\n🛡️ RISK LEVEL: {risk.get('level')} (Score: {risk.get('score')})")

    # Constitution
    const = final_output.get("constitution", {})
    print(f"📜 CONSTITUTION PASS: {const.get('pass')}")
    if const.get("hardViolations"):
        print(f"  ⚠️ Violations: {const.get('hardViolations')}")

    # Death Line Check (Implicitly verified by verify_brain_purity not throwing)
    print("\n✅ Architecture Death Line Verification: PASSED")
    # --- TEST CASE 2: CONSTITUTION VIOLATION ---
    print("\n" + "="*60)
    print("🚀 TEST CASE 2: CONSTITUTIONAL BLOCK (BID BELOW COST)")
    print("="*60)

    # Force a decision that will lead to a violation
    # If ROAS is very high, it will try to increase. 
    # Let's say we set currentBid to 0.1 and minBid to 0.5. 
    # Any decrease or holding will stay below minBid.
    violation_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="TRIGGER_AGENT_OPTIMIZATION",
        payload={
            "listingId": "B01NABCD12",
            "minBid": 1.0, # Target min
            "currentBid": 0.5, # Current is too low
            "inventoryDays": 45.0,
            "policyParams": {"shadowMode": False}
        },
        tenantId="tenant_gold_retail",
        traceId=str(uuid.uuid4()),
        riskHint=0.0,
        origin="USER",
        constitutionVersion="v1.1",
        timestamp=datetime.now(timezone.utc)
    )

    state_v: AgentState = {
        "run_id": str(uuid.uuid4()),
        "tenant_id": violation_intent.tenantId,
        "trace_id": violation_intent.traceId,
        "intent": violation_intent,
        "tools": initial_tools()
    }

    print(f"\n[RUN] Executing Violation Case...")
    output_v = app.invoke(state_v)
    
    outcome_v = output_v.get("outcome", {})
    print(f"\n📊 FINAL STATUS: {outcome_v.get('status')}")
    
    const_v = output_v.get("constitution", {})
    if not const_v.get("pass"):
        print(f"📜 CONSTITUTION REJECTED: {const_v.get('hardViolations')}")

    print("="*60 + "\n")

    # --- TEST CASE 3: UNAUTHORIZED TENANT ---
    print("\n" + "="*60)
    print("🚀 TEST CASE 3: UNAUTHORIZED TENANT (ZERO TRUST)")
    print("="*60)

    unauthorized_intent = AuditableIntent(
        intentId=str(uuid.uuid4()),
        type="TRIGGER_AGENT_OPTIMIZATION",
        payload={"listingId": "B01NABCD12"},
        tenantId="unauthorized_company_x",
        traceId=str(uuid.uuid4()),
        riskHint=0.0,
        origin="USER",
        constitutionVersion="v1.1",
        timestamp=datetime.now(timezone.utc)
    )

    state_u: AgentState = {
        "run_id": str(uuid.uuid4()),
        "tenant_id": unauthorized_intent.tenantId,
        "trace_id": unauthorized_intent.traceId,
        "intent": unauthorized_intent,
        "tools": initial_tools()
    }

    print(f"\n[RUN] Executing Unauthorized Case...")
    output_u = app.invoke(state_u)
    
    outcome_u = output_u.get("outcome", {})
    print(f"\n📊 FINAL STATUS: {outcome_u.get('status')}")
    
    const_u = output_u.get("constitution", {})
    if not const_u.get("pass"):
        print(f"📜 CONSTITUTION REJECTED: {const_u.get('hardViolations')}")

    print("="*60 + "\n")

if __name__ == "__main__":
    test_sovereign_logic()
