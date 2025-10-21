"""FastAPI application exposing incidents via REST and WebSocket."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .data_ingestor import DataCollector
from .ingest_queue import IngestQueue


class IncidentResponse(BaseModel):
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


queue = IngestQueue(settings.redis_url, int(settings.retention_window.total_seconds()))
collector = DataCollector(settings=settings, queue=queue)
app = FastAPI(title="CrimeTrend API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    await collector.start()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await collector.stop()
    await queue.close()


class _QueryParams(BaseModel):
    since: Optional[datetime] = None


async def get_recent(params: _QueryParams = Depends()) -> List[IncidentResponse]:
    since = params.since
    if since is not None and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    incidents = await queue.get_recent(since)
    return [IncidentResponse(**incident) for incident in incidents]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/incidents", response_model=List[IncidentResponse])
async def incidents_endpoint(items: List[IncidentResponse] = Depends(get_recent)) -> List[IncidentResponse]:
    return items


@app.websocket("/stream")
async def stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        async for incident in queue.stream():
            await websocket.send_json(incident)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - runtime logging
        await websocket.close(code=1011, reason=str(exc))


@app.exception_handler(Exception)
async def handle_exception(_, exc: Exception):  # pragma: no cover - global safety net
    raise HTTPException(status_code=500, detail=str(exc))
