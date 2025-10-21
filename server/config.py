"""Application configuration for the CrimeTrend backend."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
import os
from typing import List


@dataclass(slots=True)
class Settings:
    """Runtime configuration loaded from environment variables."""

    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    refresh_interval: int = field(default_factory=lambda: int(os.getenv("REFRESH_INTERVAL", "30")))
    open_data_apis: List[str] = field(default_factory=lambda: [
        api.strip() for api in os.getenv("OPEN_DATA_APIS", "seattle,pulsepoint,openmhz,noaa").split(",") if api.strip()
    ])
    retention_window: timedelta = field(
        default_factory=lambda: timedelta(seconds=int(os.getenv("RETENTION_SECONDS", str(6 * 60 * 60))))
    )
    broadcastify_base_url: str = field(
        default_factory=lambda: os.getenv("BROADCASTIFY_API_URL", "https://api.broadcastify.com/audio/")
    )


settings = Settings()
