# CrimeTrend
![Sheen Banner](https://raw.githubusercontent.com/74Thirsty/74Thirsty/main/assets/crime.svg)


# CrimeTrend Data Revolution

CrimeTrend is a real-time incident intelligence platform that ingests public safety data from open feeds, normalises it into a canonical schema, and streams the results to a live geospatial dashboard. The refreshed architecture replaces the legacy Node/SSE stack with an asyncio-first Python backend, a Redis-backed ingestion queue, and a WebSocket-powered React interface ready for optional Broadcastify audio overlays.

## Repository Structure

```
├── server/                 # FastAPI backend, ingestion workers, normalisation logic
├── crime-trend-ui/         # React + Vite frontend (TypeScript, Leaflet, Socket-based updates)
├── frontend/               # Shared JS components consumed by the UI build (MapLayer, tests)
├── tests/                  # Python unit tests
├── requirements.txt        # Backend dependencies
├── .env.template           # Sample environment configuration
└── README.md               # You are here
```

## Canonical Incident Schema

All feeds are normalised into the following structure before being published to the queue:

```json
{
  "id": "uuid-or-hash",
  "timestamp": "2024-01-01T00:00:00Z",
  "type": "Medical Aid",
  "agency": "Seattle Fire",
  "address": "800 Pine St, Seattle, WA",
  "lat": 47.61,
  "lon": -122.33,
  "status": "dispatched",
  "source": "seattle",
  "audio_url": null
}
```

The frontend enriches these records with derived categories, severity levels, and map-layer metadata while preserving the original canonical payload for popups and audio playback.

## Backend

### Features

- **Multi-feed ingestion:** `server/data_ingestor.py` polls Socrata, PulsePoint, OpenMHz, NOAA, and FEMA endpoints on configurable intervals.
- **Normalisation:** `server/normalizer.py` converts heterogeneous payloads into the canonical schema and hashes incidents for deduplication.
- **Queue + dedup:** `server/ingest_queue.py` stores incidents in Redis, performs 6-hour rolling deduplication, and publishes events for WebSocket consumers.
- **API surface:** `server/api_server.py` exposes REST endpoints (`/health`, `/incidents`) and a `/stream` WebSocket that emits incidents as they arrive.
- **Optional audio:** `server/audio_adapter.py` validates Broadcastify API keys and resolves feed URLs without persisting user secrets.

### Prerequisites

- Python 3.11+
- Redis 6+

### Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.template .env  # update OPEN_DATA_APIS or Redis URL if required
uvicorn server.api_server:app --reload
```

By default the API listens on `http://127.0.0.1:8000`, streams incidents via `ws://127.0.0.1:8000/stream`, and stores data in `redis://localhost:6379/0`.

### Testing

```bash
pytest
```

The test suite (`tests/test_ingestor.py`) validates mocked feed ingestion and normalisation flows.

## Frontend

### Features

- **WebSocket updates:** `useIncidentStream` consumes the `/stream` socket, merges it with periodic `/incidents` snapshots, and maintains deduplicated state.
- **Leaflet visualisation:** `frontend/MapLayer.jsx` draws incident dots with the colour/icon scheme specified in the Codex brief and exposes optional “Listen Live” links when audio is available.
- **Filters & presets:** Existing query, severity, category, timeframe, and location filters continue to function with derived metadata from the canonical payloads.
- **Hot zone analytics:** Client-side clustering highlights geographic concentrations and drives the trend widgets in `Trends.tsx` and `HotZoneAlerts.tsx`.

### Setup

```bash
cd crime-trend-ui
npm install
npm run dev
```

The Vite dev server proxies API calls to `http://127.0.0.1:8000` for both REST and WebSocket traffic. Run the backend and frontend in parallel during development.

### Frontend Tests

```bash
npm run test
```

Vitest is configured with JSDOM. `frontend/tests/map_render.test.jsx` ensures the shared map layer renders incidents and audio metadata correctly.

## Environment Configuration

Environment variables (see `.env.template`):

- `REDIS_URL` – Redis connection string (default `redis://localhost:6379/0`).
- `REFRESH_INTERVAL` – Polling cadence in seconds for high-frequency feeds (default `30`).
- `OPEN_DATA_APIS` – Comma-separated feed keys (`seattle,pulsepoint,openmhz,noaa,fema`).
- `RETENTION_SECONDS` – Deduplication horizon (defaults to 6 hours).
- `BROADCASTIFY_API_URL` – Override for Broadcastify endpoint, if necessary.

## Optional Broadcastify Support

Users can supply their personal Broadcastify API key in the UI settings. The key is stored client-side and exchanged with `server/audio_adapter.AudioAdapter` only for validation and feed lookups. No keys are persisted server-side.

## Monitoring & Performance Targets

- Sub-10-second latency from feed polling to map update (async ingestion + Redis pub/sub).
- Deduplication accuracy above 99% via hashed `source:id:timestamp` keys.
- Redis retains a rolling six-hour history for snapshot requests.
- WebSocket reconnection logic in the UI handles transient outages gracefully.

## License

MIT
