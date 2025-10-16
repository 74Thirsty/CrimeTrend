# CrimeTrend
![Sheen Banner](https://raw.githubusercontent.com/74Thirsty/74Thirsty/main/assets/crime.svg)


CrimeTrend is a real-time crime intelligence stack built around a lightweight Node.js backend and a modern, responsive React dashboard. The system ingests live incident data, streams it to connected clients via Server-Sent Events (SSE), and visualises it through a map-first UI with live feed cards, analytics, and alerting.

## Repository Structure

```
├── server/             # Node backend with SSE stream and REST snapshot
├── public/             # Static assets served by the backend (production UI build target)
├── crime-trend-ui/     # React + Vite frontend source (TypeScript, Tailwind, Leaflet, Recharts)
└── package.json        # Backend entry point (`npm start`)
```

## Features

- **Live incident stream:** SSE endpoint (`/stream/incidents`) broadcasts an always-fresh incident snapshot. Clients auto-heartbeat and gracefully handle reconnection.
- **Interactive dashboard:** React UI (Tailwind + Framer Motion) stitches together the map, live feed, filter panel, and analytics for a cohesive situational view.
- **Geospatial context:** Leaflet map with category-coloured pins, optional heatmap overlay, and dynamic hot-zone highlighting.
- **Trend analytics:** Live-updating area and bar charts summarise volume over time and category distribution via Recharts.
- **Alerting:** Automatic detection of geographic clusters raises a “Hot zone” banner and draws proportional overlays on the map.
- **Persistent UX:** Filters (query, category, severity, timeframe, heatmap toggle) persist in `localStorage`, and the entire layout adapts fluidly from desktop to tablet widths.
- **Confidence & provenance metadata:** Each incident carries a calculated confidence score, first-seen timestamp, and source feed details for quick triage.
- **Saved analyst presets:** Store and reuse named filter configurations for rapid context switching between beats or missions.

## Getting Started

### Backend

```bash
npm install   # no external deps but ensures lockfile generation if desired
npm start
```

The backend listens on `http://localhost:8080`, serves static assets from `public/`, and exposes:

- `GET /api/incidents` – Current snapshot
- `GET /api/incidents/:id` – Single incident lookup
- `GET /stream/incidents` – Server-Sent Events feed

### Frontend (development)

```bash
cd crime-trend-ui
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/stream` calls to the Node backend, so run both processes concurrently.

### Frontend (production)

```bash
cd crime-trend-ui
npm install
npm run build
rm -rf ../public/*
cp -r dist/* ../public/
```

Restart the backend (`npm start`) and visit `http://localhost:8080` to load the built SPA.

## Configuration

- `PORT` – Override backend HTTP port (default `8080`).
- `LOG_LEVEL` – Adjust logging verbosity (`info` by default).
- `DATA_ENDPOINT` / `SOCRATA_APP_TOKEN` – Extend `IncidentService` with custom feeds if integrating real-world data.

## Development Notes

- Tailwind configuration lives in `crime-trend-ui/tailwind.config.cjs` with custom palette entries for incident categories and animation utilities.
- Map tiles default to OpenStreetMap. Provide your own tile server or Mapbox key by editing `MapView.tsx` if required.
- Hot zone detection buckets incidents into ~1km² cells (two decimal precision) and flags clusters of four or more events within the selected timeframe.
- Styling is dark-mode first. A theme toggle toggles the `dark` class on `<html>`; extend as needed for full light mode palettes.

## Additional Documentation

- [Broadcastify Integration Guide](docs/broadcastify_integration.md) – Architecture overview, implementation patterns, and deployment considerations for incorporating Broadcastify streams across all states and counties.

## License

MIT
