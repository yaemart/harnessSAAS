"""
Global Registry tools — Agent-callable primitives for system-level registry queries.

Layer A knowledge: markets, platforms, categories, warehouses, ERP systems, and tools
that the system administrator has enabled. Tenants can only select from these.

These tools call the Hono API over HTTP, keeping the Brain pure (no DB imports).
Observe-phase only (read-only). Registered into ToolRegistry by bootstrap_tools().
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

from .._shared import verify_brain_purity

verify_brain_purity()

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:3000")


async def get_available_markets() -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled global markets.

    Returns a list of markets the system administrator has activated.
    Each entry includes code, name, region, currency, flag, and status.
    Tenants may only select markets from this registry.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/markets",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_available_platforms() -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled global e-commerce platforms.

    Returns platforms (e.g. Amazon, Shopee, TikTok Shop) that the system
    administrator has activated. Includes code, name, supportedMarkets, and status.
    Tenants may only select platforms from this registry.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/platforms",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_available_categories(
    platform_code: Optional[str] = None,
    market_code: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled global product categories.

    Args:
        platform_code: Optional filter by platform (e.g. "amazon").
        market_code:   Optional filter by market (e.g. "us").

    Returns hierarchical category entries (L1/L2/L3) that the system
    administrator has activated. Tenants may only select from these.
    """
    params: Dict[str, str] = {}
    if platform_code:
        params["platform"] = platform_code
    if market_code:
        params["market"] = market_code

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/categories",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_available_warehouses(
    region: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled global warehouses (FBA / 3PL).

    Args:
        region: Optional filter by region code (e.g. "us", "eu", "jp").

    Returns warehouse entries including code, name, type, region, nodes, and status.
    Tenants may only select warehouses from this registry.
    """
    params: Dict[str, str] = {}
    if region:
        params["region"] = region

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/warehouses",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_available_erp_systems() -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled ERP integrations.

    Returns ERP systems (e.g. SAP, Kingdee, NetSuite) that the system
    administrator has activated. Includes code, name, vendor, and status.
    Tenants may only connect to ERPs from this registry.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/erp-systems",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_available_tools() -> List[Dict[str, Any]]:
    """
    Read: list all system-enabled third-party tools.

    Returns tools (e.g. Keepa, Helium 10, Jungle Scout) that the system
    administrator has activated. Includes code, name, category, and status.
    Tenants may only integrate tools from this registry.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/tools",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def search_categories(query: str) -> List[Dict[str, Any]]:
    """
    Read: search global categories by name, Chinese name, code, or alias.

    Args:
        query: Search term (minimum 2 characters, supports English and Chinese).

    Returns matching categories with id, code, name, level, path, and mappingCount.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/categories/search",
            params={"q": query},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_category_mappings(category_id: str) -> List[Dict[str, Any]]:
    """
    Read: get all platform mappings for a specific global category.

    Args:
        category_id: UUID of the global category.

    Returns platform mappings including platform, marketCode, externalCategoryId,
    mappingType, confidenceScore, and direction.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/categories/{category_id}/mappings",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)


async def get_category_aliases(category_id: str) -> List[Dict[str, Any]]:
    """
    Read: get all aliases for a specific global category.

    Args:
        category_id: UUID of the global category.

    Returns aliases with language, weight, and source information.
    Useful for understanding how a category is known across markets and languages.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/system/available/categories/{category_id}/aliases",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", data)
