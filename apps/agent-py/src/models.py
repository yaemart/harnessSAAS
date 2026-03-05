from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

IntentDomain = Literal["ads", "listing", "pricing", "inventory", "cs"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class IntentTarget(BaseModel):
    type: Literal["listing", "campaign", "commodity", "product"]
    id: str


class IntentScope(BaseModel):
    tenantId: str
    platform: str
    market: str
    brand: Optional[str] = None
    category: Optional[str] = None
    fulfillment: Optional[str] = None


class IntentRisk(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    level: RiskLevel
    violations: List[str] = Field(default_factory=list)


class IntentReasoningEvidence(BaseModel):
    metric: str
    value: Any
    note: Optional[str] = None


class IntentReasoning(BaseModel):
    summary: str
    evidence: List[IntentReasoningEvidence] = Field(default_factory=list)


class AuditableIntent(BaseModel):
    intentId: str
    type: str # The specific action type
    payload: Dict[str, Any] = Field(default_factory=dict)
    tenantId: str
    traceId: str
    riskHint: float = Field(ge=0.0, le=1.0)
    origin: Literal["USER", "SYSTEM", "AGENT"]
    constitutionVersion: str
    timestamp: datetime


class AgentIntent(AuditableIntent):
    pass


class ObservationSet(BaseModel):
    snapshot: Dict[str, Any]
    fossilized: bool = True


class ContextAwareAnalysis(BaseModel):
    analysis: str
    matchedRules: List[str] = Field(default_factory=list)
    ruleRiskScore: float


class StrategicRationale(BaseModel):
    rationale: str
    alternativesConsidered: List[str] = Field(default_factory=list)


class ReasoningLog(BaseModel):
    traceId: str
    tenantId: str
    timestamp: datetime
    observe: ObservationSet
    orient: ContextAwareAnalysis
    decide: StrategicRationale
    act: AuditableIntent


class ExecutionReceipt(BaseModel):
    intentId: str
    platform: Literal["amazon", "walmart", "tiktok"]
    executionId: str
    timestamp: datetime
    status: Literal["SUCCESS", "FAILED"]
    rollbackSupported: bool
    rawResponse: Dict[str, Any]


class RunRequest(BaseModel):
    tenantId: str
    intent: AuditableIntent


class RunResponse(BaseModel):
    status: Literal["ACCEPTED"]
    runId: str


class SyncRunResponse(BaseModel):
    status: Literal["COMPLETED"]
    runId: str
    outcome: Dict[str, Any]
