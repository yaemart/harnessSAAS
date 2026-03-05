# agent-py (Week 4)

LangGraph-based Ads Agent runtime.

## Endpoints
- `GET /health`
- `POST /run` (async, returns ACCEPTED)
- `POST /run/sync` (sync, for local verification)

## Pipeline Nodes
1. `load_performance_node`
2. `analyze_and_decide_node`
3. `risk_check_node`
4. `constitution_check`
5. `validate_freshness`
6. `auto_execute_node`

## Run locally
```bash
python3 -m venv /tmp/agentpy-venv
source /tmp/agentpy-venv/bin/activate
pip install -r apps/agent-py/requirements.txt
DATABASE_URL=postgresql://<user>@localhost:<port>/ai_ecom \
  uvicorn src.main:app --app-dir apps/agent-py --host 127.0.0.1 --port 8001
```

## Notes
- Agent runtime is Intent-only and does not write business tables directly.
- `AgentExecutionLog` and `ApprovalQueue` are persisted by API governance/queue layer.
