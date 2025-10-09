# CrimeTrend

CrimeTrend is a forensic-grade real-time situational awareness dashboard for police and emergency incident monitoring. It streams live CAD events into an interactive, dark-mode mapping console with integrated radio feeds, unit assignments, and status timelines.

## Features

- **Live mapping:** Leaflet-powered map with clustering, hover tooltips, severity-based styling, and smooth fly-to interactions.
- **Real-time sync:** Server-Sent Events keep the UI synchronized with CAD updates; the client automatically falls back to 10-second polling if the stream drops.
- **Structured incident detail:** Dedicated side panel exposes call metadata, unit dispatch information, timeline updates, and radio playback.
- **Radio integration:** Each incident links to a Broadcastify scanner stream aligned to its sector (configurable per deployment).
- **Responsive UX:** Dark, high-contrast UI with mobile and desktop layouts, animated transitions, and accessible typography.

## System Architecture

```
┌────────────────────┐        SSE / Polling        ┌─────────────────────┐
│  CAD / Public API  │ ─────────────────────────▶  │  Browser Front-End  │
└────────────────────┘                             │  (React + Leaflet)  │
            ▲                                      └─────────────────────┘
            │ HTTP Fetch                                   ▲
            │                                              │ Web Audio
┌────────────────────┐        Normalised incidents         │
│  Node Ingestion +  │ ───────────────────────────────▶ ┌─────────────────────┐
│  Event Broadcaster │                                 │  Broadcastify Feed  │
└────────────────────┘                                 └─────────────────────┘
```

1. **Ingestion:** `IncidentService` polls the Seattle Real Time 911 feed (Socrata dataset `kzjm-xkqj`) for incidents within the last two hours. Records are normalised into a consistent schema with severity tagging, timeline extraction, and audio feed selection.
2. **Distribution:** The Node.js server exposes the latest snapshot via REST and streams deltas over Server-Sent Events at `/stream/incidents`.
3. **Presentation:** A React front-end renders a Leaflet map, clusters incident markers, and opens a detailed inspection panel with live audio playback and transcript support when available.

> **Note:** External HTTP access is required for both the Seattle data portal and Broadcastify streams. If outbound internet is restricted the ingestion pipeline will log failures and no incidents will appear.

## Getting Started

1. **Install dependencies:** This service is dependency-free beyond Node.js 20+. Ensure `node` is available in your environment.
2. **Configure (optional):**
   - `PORT`: HTTP port for the server (default `8080`).
   - `SOCRATA_APP_TOKEN`: Optional Socrata application token to increase rate limits.
   - `DATA_ENDPOINT`: Override the default CAD feed URL.
3. **Run the server:**

   ```bash
   npm start
   ```

4. **Access the dashboard:** Open `http://localhost:8080` in a modern browser. Allow autoplay for the embedded radio feeds when prompted.

## Deployment Notes

- **Audio feeds:** Broadcastify stream URLs are mapped by patrol sector in `server/incident-service.js`. Update the `AUDIO_FEEDS` table to match your jurisdiction or provide authenticated streams.
- **Transcription:** The incident schema includes placeholders for transcript URLs and entries. Integrate with your preferred speech-to-text pipeline and populate `audio.transcript` for each incident to surface live captions in the UI.
- **Security:** Apply authentication, TLS termination, and rate limiting before exposing the service publicly. The provided implementation is a baseline and should be extended with production-grade controls.

## Troubleshooting

- **No incidents visible:** Confirm outbound HTTPS access to `data.seattle.gov`. Without connectivity the poller will log failures and retain the previous snapshot.
- **Audio will not play:** Browsers may block autoplay with sound; interact with the page before pressing play. Validate that the Broadcastify stream is accessible from your network.
- **Map tiles missing:** The application pulls OpenStreetMap tiles from `tile.openstreetmap.org`. Ensure network access or host tiles locally.

## License

MIT
