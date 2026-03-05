from __future__ import annotations

import asyncio
import os
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI

from .graph_runtime import build_graph, initial_tools
from .models import RunRequest, RunResponse, SyncRunResponse

app = FastAPI(title="LangGraph Ads Agent", version="0.1.0")
agent_graph = build_graph()


def _run_graph_sync(run_id: str, payload: RunRequest):
    state = {
        "run_id": run_id,
        "tenant_id": payload.tenantId,
        "intent": payload.intent.model_dump(mode="json"),
        "tools": initial_tools(),
    }
    return agent_graph.invoke(state)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "agent-py",
        "runtime": "langgraph",
        "databaseConfigured": bool(os.environ.get("DATABASE_URL")),
    }


@app.post("/run", response_model=RunResponse)
def run_agent(payload: RunRequest, background_tasks: BackgroundTasks):
    run_id = str(uuid4())
    background_tasks.add_task(_run_graph_sync, run_id, payload)
    return RunResponse(status="ACCEPTED", runId=run_id)


@app.post("/run/sync", response_model=SyncRunResponse)
def run_agent_sync(payload: RunRequest):
    run_id = str(uuid4())
    result = _run_graph_sync(run_id, payload)
    return SyncRunResponse(status="COMPLETED", runId=run_id, outcome=result.get("outcome", {}))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8001, reload=False)
