from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Literal


class ToolStats:
    def __init__(self):
        self.call_count = 0
        self.error_count = 0
        self.total_duration_ms = 0.0

    def to_dict(self):
        return {
            "callCount": self.call_count,
            "errorCount": self.error_count,
            "totalDurationMs": round(self.total_duration_ms, 2),
            "avgDurationMs": round(self.total_duration_ms / self.call_count, 2) if self.call_count > 0 else 0,
        }


class ToolEntry:
    def __init__(self, name: str, tool_type: Literal["read", "write"], fn: Callable[..., Any]):
        self.name = name
        self.tool_type = tool_type
        self.fn = fn
        self.stats = ToolStats()


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolEntry] = {}

    def register(self, name: str, tool_type: Literal["read", "write"], fn: Callable[..., Any]) -> None:
        self._tools[name] = ToolEntry(name, tool_type, fn)

    def call(self, name: str, **kwargs: Any) -> Any:
        entry = self._tools.get(name)
        if not entry:
            raise KeyError(f"Tool not registered: {name}")
        start = time.monotonic()
        try:
            result = entry.fn(**kwargs)
            return result
        except Exception:
            entry.stats.error_count += 1
            raise
        finally:
            elapsed = (time.monotonic() - start) * 1000
            entry.stats.call_count += 1
            entry.stats.total_duration_ms += elapsed

    def get_stats(self) -> Dict[str, Any]:
        return {name: entry.stats.to_dict() for name, entry in self._tools.items()}

    def get_capabilities(self) -> Dict[str, List[str]]:
        result: Dict[str, List[str]] = {"read": [], "write": []}
        for entry in self._tools.values():
            result[entry.tool_type].append(entry.name)
        return result

    def has(self, name: str) -> bool:
        return name in self._tools
