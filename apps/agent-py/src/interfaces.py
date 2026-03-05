from abc import ABC, abstractmethod
from typing import Dict, Any, List
from .models import AuditableIntent, ExecutionReceipt

class IPlatformAgent(ABC):
    """
    Sovereign Interface for Federated Platform Agents.
    Ensures that every platform (Amazon, Walmart, etc.) is autonomous and auditable.
    """

    @property
    @abstractmethod
    def platform_id(self) -> str:
        """Return the unique identifier for the platform (e.g., 'amazon')."""
        pass

    @abstractmethod
    async def get_capabilities(self) -> Dict[str, Any]:
        """
        Return the 'Vibe' and 'Schemas' of what this platform can do.
        Used by the Brain for selection.
        """
        pass

    @abstractmethod
    async def execute_intent(self, intent: AuditableIntent) -> ExecutionReceipt:
        """
        The only entry point for write actions.
        Must return an ExecutionReceipt for auditing.
        """
        pass

    @abstractmethod
    async def read_facts(self, keys: List[str], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Used for the 'Observe' phase of the OODA loop.
        Should only return read-only data.
        """
        pass
