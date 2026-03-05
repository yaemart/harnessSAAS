"""
Bootstrap — register all tool implementations into the global ToolRegistry.

Call bootstrap_tools() once at startup (e.g. in server.py or main.py).
"""
from __future__ import annotations

from .registry import ToolRegistry
from . import support_tools
from . import exchange_rate_tools


def bootstrap_tools(registry: ToolRegistry) -> ToolRegistry:
    """Register all available tool implementations."""

    # ── Support tools (read) ──
    registry.register("list_support_cases", "read", support_tools.list_support_cases)
    registry.register("get_support_case", "read", support_tools.get_support_case)
    registry.register("get_support_stats", "read", support_tools.get_support_stats)

    # ── Support tools (write) ──
    registry.register("reply_support_case", "write", support_tools.reply_support_case)
    registry.register("close_support_case", "write", support_tools.close_support_case)

    # ── Exchange rate tools (read) ──
    registry.register("get_exchange_rate", "read", exchange_rate_tools.get_exchange_rate)
    registry.register("get_monthly_avg_rate", "read", exchange_rate_tools.get_monthly_avg_rate)

    return registry

