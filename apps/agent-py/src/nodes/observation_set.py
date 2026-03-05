from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class SignalMeta:
    observed_at: Optional[str] = None
    freshness_hours: float = 0.0
    source: str = "unknown"
    confidence: float = 1.0


@dataclass
class Signal:
    value: Any
    meta: SignalMeta = field(default_factory=SignalMeta)

    @property
    def is_stale(self) -> bool:
        if not self.meta.observed_at:
            return True
        return self.meta.freshness_hours > 24.0


@dataclass
class SignalDomain:
    name: str
    signals: Dict[str, Signal] = field(default_factory=dict)

    def set(self, key: str, value: Any, source: str = "unknown", confidence: float = 1.0) -> None:
        self.signals[key] = Signal(
            value=value,
            meta=SignalMeta(
                observed_at=datetime.utcnow().isoformat(),
                freshness_hours=0.0,
                source=source,
                confidence=confidence,
            ),
        )

    def get(self, key: str, default: Any = None) -> Any:
        sig = self.signals.get(key)
        return sig.value if sig else default

    def completeness(self) -> float:
        if not self.signals:
            return 0.0
        non_none = sum(1 for s in self.signals.values() if s.value is not None)
        return non_none / len(self.signals)

    def stale_signals(self) -> List[str]:
        return [k for k, s in self.signals.items() if s.is_stale]


class StructuredObservationSet:
    def __init__(self) -> None:
        self.ads = SignalDomain("ads")
        self.inventory = SignalDomain("inventory")
        self.competitor = SignalDomain("competitor")
        self.customer = SignalDomain("customer")
        self.financial = SignalDomain("financial")
        self.market = SignalDomain("market")
        self.product = SignalDomain("product")
        self.lifecycle = SignalDomain("lifecycle")

    @property
    def domains(self) -> Dict[str, SignalDomain]:
        return {
            "ads": self.ads,
            "inventory": self.inventory,
            "competitor": self.competitor,
            "customer": self.customer,
            "financial": self.financial,
            "market": self.market,
            "product": self.product,
            "lifecycle": self.lifecycle,
        }

    def signal_completeness(self) -> Dict[str, float]:
        return {name: domain.completeness() for name, domain in self.domains.items()}

    def overall_completeness(self) -> float:
        scores = list(self.signal_completeness().values())
        return sum(scores) / len(scores) if scores else 0.0

    def stale_signals(self) -> Dict[str, List[str]]:
        result = {}
        for name, domain in self.domains.items():
            stale = domain.stale_signals()
            if stale:
                result[name] = stale
        return result

    def to_flat_snapshot(self) -> Dict[str, Any]:
        flat: Dict[str, Any] = {}
        seen_short_keys: Dict[str, str] = {}
        for name, domain in self.domains.items():
            for key, signal in domain.signals.items():
                flat[f"{name}.{key}"] = signal.value
                if key not in seen_short_keys:
                    flat[key] = signal.value
                    seen_short_keys[key] = name
        return flat

    @classmethod
    def from_state(cls, state: Dict[str, Any]) -> "StructuredObservationSet":
        obs = cls()
        perf = state.get("performance", {})
        signal = state.get("signal_context", {})
        tier2 = state.get("tier2_signals", {})

        obs.ads.set("roas", float(perf.get("normalizedRoas", 0)), "performance_snapshot")
        obs.ads.set("acos", float(perf.get("acos", 0)), "performance_snapshot")
        obs.ads.set("ctr", float(tier2.get("ctr", 0)), "tier2_enrich")
        obs.ads.set("cvr", float(tier2.get("cvr", 0)), "tier2_enrich")
        obs.ads.set("spend", float(perf.get("spend", 0)), "performance_snapshot")
        obs.ads.set("impressions", float(perf.get("impressions", 0)), "performance_snapshot")
        obs.ads.set("clicks", float(perf.get("clicks", 0)), "performance_snapshot")

        obs.inventory.set("in_transit_units", int(tier2.get("inTransitUnits", 0)), "tier2_enrich")
        obs.inventory.set("available_units", int(tier2.get("availableUnits", 0)), "tier2_enrich")
        obs.inventory.set("days_of_supply", float(tier2.get("daysOfSupply", 0)), "tier2_enrich")

        obs.competitor.set("price_delta", float(tier2.get("competitorPriceDelta", 0)), "tier2_enrich")

        obs.customer.set("review_score", float(signal.get("reviewScore", 0)), "signal_enrich")
        obs.customer.set("review_count", int(signal.get("reviewCount", 0)), "signal_enrich")
        obs.customer.set("return_rate", float(tier2.get("returnRate", 0)), "tier2_enrich")

        obs.financial.set("profit_margin_pct", float(signal.get("profitMarginPct", 0)), "signal_enrich")
        obs.financial.set("fx_impact_pct", float(tier2.get("fxImpactPct", 0)), "tier2_enrich")

        obs.market.set("is_promo_period", bool(tier2.get("isPromoPeriod", False)), "tier2_enrich")
        obs.market.set("seasonality_factor", float(tier2.get("seasonalityFactor", 1.0)), "tier2_enrich")

        obs.lifecycle.set("stage", signal.get("lifecycleStage", "UNKNOWN"), "lifecycle_detect")

        return obs
