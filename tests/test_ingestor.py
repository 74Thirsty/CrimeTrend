import os
import sys

import pytest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.data_ingestor import DataCollector, DataSource
from server.config import Settings
from server.models import Incident
from server.normalizer import IncidentNormalizer


class StubQueue:
    def __init__(self) -> None:
        self.messages = []

    async def push(self, incident: Incident) -> None:
        self.messages.append(incident.to_message())


@pytest.mark.asyncio
async def test_collector_processes_mocked_feed():
    sample_feed = [
        {
            "cad_cdw_id": "A1",
            "event_clearance_date": "2024-01-01T10:00:00Z",
            "event_clearance_description": "Alarm",
            "incident_location": "100 Block Pine St",
            "latitude": 47.0,
            "longitude": -122.0,
            "status": "dispatched",
        },
        {
            "cad_cdw_id": "A2",
            "event_clearance_date": "2024-01-01T10:01:00Z",
            "event_clearance_description": "Medical",
            "incident_location": "200 Block Pine St",
            "latitude": 47.1,
            "longitude": -122.1,
            "status": "closed",
        },
    ]

    class MockSource(DataSource):
        async def fetch(self, session):  # type: ignore[override]
            return sample_feed

    settings = Settings(redis_url="redis://localhost:6379/0", open_data_apis=["seattle"], refresh_interval=1)
    queue = StubQueue()
    normalizer = IncidentNormalizer.default()
    collector = DataCollector(settings=settings, queue=queue, normalizer=normalizer, sources=[
        MockSource(name="seattle", url="https://example", interval=0)
    ])

    await collector._process_records("seattle", sample_feed)

    assert len(queue.messages) == 2
    first = queue.messages[0]
    assert first["type"] == "Alarm"
    assert first["agency"] == "Seattle PD"
    assert first["status"] == "dispatched"
    assert first["timestamp"] == "2024-01-01T10:00:00+00:00"
