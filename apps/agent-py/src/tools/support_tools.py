"""
Support tools — Agent-callable primitives for customer support operations.

These tools call the Hono API over HTTP, keeping the Brain pure (no DB imports).
They are registered into ToolRegistry by bootstrap_tools().
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000")


def _headers(tenant_id: str) -> Dict[str, str]:
    return {
        "content-type": "application/json",
        "x-tenant-id": tenant_id,
    }


async def list_support_cases(
    tenant_id: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """Read: list support cases for a tenant, optionally filtered by status."""
    params: Dict[str, Any] = {"page": page, "pageSize": page_size}
    if status:
        params["status"] = status
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/support/cases",
            headers=_headers(tenant_id),
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def get_support_case(
    tenant_id: str,
    case_id: str,
) -> Dict[str, Any]:
    """Read: get a single support case with messages and media analyses."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/support/cases/{case_id}",
            headers=_headers(tenant_id),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def get_support_stats(
    tenant_id: str,
) -> Dict[str, Any]:
    """Read: get support statistics (total, open, escalated, closed)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/support/stats",
            headers=_headers(tenant_id),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def reply_support_case(
    tenant_id: str,
    case_id: str,
    content: str,
    knowledge_writeback: Optional[str] = None,
) -> Dict[str, Any]:
    """Write: reply to a support case as an operator/agent."""
    body: Dict[str, Any] = {"content": content}
    if knowledge_writeback:
        body["knowledgeWriteback"] = knowledge_writeback
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_BASE}/support/cases/{case_id}/reply",
            headers=_headers(tenant_id),
            json=body,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def close_support_case(
    tenant_id: str,
    case_id: str,
    knowledge_writeback: Optional[str] = None,
) -> Dict[str, Any]:
    """Write: close a support case, optionally with knowledge writeback."""
    body: Dict[str, Any] = {}
    if knowledge_writeback:
        body["knowledgeWriteback"] = knowledge_writeback
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_BASE}/support/cases/{case_id}/close",
            headers=_headers(tenant_id),
            json=body,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
