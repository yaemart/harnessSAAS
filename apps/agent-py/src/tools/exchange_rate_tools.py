"""
Exchange rate tools — Agent-callable primitives for currency rate queries.

These tools call the Hono API over HTTP, keeping the Brain pure (no DB imports).
Observe-phase only (read-only). Registered into ToolRegistry by bootstrap_tools().
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

from .._shared import verify_brain_purity

verify_brain_purity()

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:4000")


async def get_exchange_rate(
    base: str,
    target: str,
    date: Optional[str] = None,
) -> Dict[str, Any] | None:
    """
    Read: get the exchange rate for a currency pair.

    Args:
        base:   Base currency code, e.g. "USD".
        target: Target currency code, e.g. "CNY".
        date:   Optional ISO date "YYYY-MM-DD". Returns latest if omitted.

    Returns:
        {date, baseCurrency, targetCurrency, rate, source} or None if no data.
    """
    params: Dict[str, str] = {"base": base, "target": target}
    if date:
        params["date"] = date

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/exchange-rates/daily/mcp",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


async def get_monthly_avg_rate(
    base: str,
    target: str,
    year: int,
    month: int,
) -> Dict[str, Any] | None:
    """
    Read: get the monthly average exchange rate for a currency pair.

    Args:
        base:   Base currency code, e.g. "USD".
        target: Target currency code, e.g. "CNY".
        year:   Year, e.g. 2025.
        month:  Month 1–12.

    Returns:
        {year, month, baseCurrency, targetCurrency, avgRate, minRate, maxRate, sampleCount}
        or None if no data.
    """
    params: Dict[str, str] = {
        "base": base,
        "target": target,
        "year": str(year),
        "month": str(month),
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{API_BASE}/exchange-rates/monthly/mcp",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
