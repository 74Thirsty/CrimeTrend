"""Feed ingestion pipeline for CrimeTrend."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Iterable, List, Mapping, Optional

import aiohttp

from .config import Settings
from .ingest_queue import IngestQueue
from .normalizer import IncidentNormalizer


@dataclass(slots=True)
class DataSource:
    """Definition of a source feed."""

    name: str
    url: str
    interval: int

    async def fetch(self, session: aiohttp.ClientSession) -> Iterable[Mapping[str, object]]:
        async with session.get(self.url, timeout=20) as response:
            response.raise_for_status()
            payload = await response.json()
            if isinstance(payload, dict) and "features" in payload and isinstance(payload["features"], list):
                return payload["features"]
            if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], list):
                return payload["data"]
            if isinstance(payload, list):
                return payload
            return [payload]


class DataCollector:
    """Collect incidents from multiple feeds and push them to the queue."""

    def __init__(
        self,
        settings: Settings,
        queue: IngestQueue,
        normalizer: Optional[IncidentNormalizer] = None,
        sources: Optional[List[DataSource]] = None,
    ) -> None:
        self.settings = settings
        self.queue = queue
        self.normalizer = normalizer or IncidentNormalizer.default()
        self.sources = sources or build_default_sources(settings)
        self._tasks: List[asyncio.Task[None]] = []
        self._session: Optional[aiohttp.ClientSession] = None
        self._running = asyncio.Event()

    async def start(self) -> None:
        if self._session is not None:
            return
        self._session = aiohttp.ClientSession()
        self._running.set()
        for source in self.sources:
            task = asyncio.create_task(self._run_source(source))
            self._tasks.append(task)

    async def stop(self) -> None:
        self._running.clear()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        if self._session:
            await self._session.close()
            self._session = None

    async def _run_source(self, source: DataSource) -> None:
        assert self._session is not None
        while self._running.is_set():
            try:
                raw_records = await source.fetch(self._session)
                await self._process_records(source.name, raw_records)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover - logged upstream
                print(f"[{source.name}] ingestion error: {exc}")
            await asyncio.sleep(source.interval)

    async def _process_records(self, source: str, records: Iterable[Mapping[str, object]]) -> None:
        for record in records:
            incident = self.normalizer.normalize(source, record)
            await self.queue.push(incident)


def build_default_sources(settings: Settings) -> List[DataSource]:
    """Construct default data sources based on configuration."""

    catalogue = {
        "seattle": DataSource(
            name="seattle",
            url="https://data.seattle.gov/resource/kzjm-xkqj.json?$limit=200&$order=event_clearance_date%20DESC",
            interval=settings.refresh_interval,
        ),
        "pulsepoint": DataSource(
            name="pulsepoint",
            url="https://web.pulsepoint.org/dbapi/incidents?agencyid=12345",
            interval=settings.refresh_interval,
        ),
        "openmhz": DataSource(
            name="openmhz",
            url="https://api.openmhz.com/calls?system=seattle&limit=50",
            interval=settings.refresh_interval,
        ),
        "noaa": DataSource(
            name="noaa",
            url="https://api.weather.gov/alerts/active",
            interval=max(settings.refresh_interval * 2, 60),
        ),
        "fema": DataSource(
            name="fema",
            url="https://www.fema.gov/api/open/v1/DisasterDeclarationsSummaries",
            interval=max(settings.refresh_interval * 4, 300),
        ),
    }

    selected = [catalogue[name] for name in settings.open_data_apis if name in catalogue]
    if not selected:
        raise ValueError("No valid OPEN_DATA_APIS configured")
    return selected
