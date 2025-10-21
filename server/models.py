"""Data models used by the CrimeTrend backend."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass(slots=True)
class Incident:
    """Canonical incident representation."""

    id: str
    timestamp: datetime
    type: str
    agency: str
    address: str
    lat: float
    lon: float
    status: str
    source: str
    audio_url: Optional[str] = None

    def to_message(self) -> Dict[str, Any]:
        """Convert the incident to a serialisable dictionary."""

        payload = asdict(self)
        payload["timestamp"] = self.timestamp.isoformat()
        return payload
