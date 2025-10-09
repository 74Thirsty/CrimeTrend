# Crime Trend UI

A modern, responsive single-page interface for the Crime Trend Tracker backend. Built with React, Vite, Tailwind CSS, Recharts, and React Leaflet to provide real-time situational awareness through streaming incident data, geospatial visualization, and interactive analytics.

## Getting Started

> **Prerequisites**
>
> - Node.js 18+
> - npm 9+
> - Backend server from the root of this repository (`npm start`) running on port 8080

### Installation

```bash
cd crime-trend-ui
npm install
```

### Development

Run the backend in another terminal using `npm start` from the repository root. Then launch the frontend with:

```bash
npm run dev
```

The Vite dev server proxies API and SSE requests to the backend.

### Production Build

```bash
npm run build
```

The compiled assets will live in `crime-trend-ui/dist`. Copy the contents of that folder into the repository `public/` directory (overwriting its contents) so the Node backend can serve the built UI:

```bash
rm -rf ../public/*
cp -r dist/* ../public/
```

## Project Structure

- `src/App.tsx` – orchestrates the dashboard layout and theming
- `src/components/MapView.tsx` – interactive Leaflet map with live incident pins
- `src/components/LiveFeed.tsx` – animated real-time event cards with filtering
- `src/components/Trends.tsx` – trend visualizations using Recharts
- `src/components/Filters.tsx` – search, filtering, and heatmap controls
- `src/hooks/useIncidentStream.ts` – SSE data handling with pause/resume and stats
- `src/styles/index.css` – Tailwind and base styling overrides

## Features

- Realtime SSE connection with pause/resume controls
- Persisted filter state via `localStorage`
- Animated transitions with Framer Motion
- Responsive layout tuned for desktop and tablet breakpoints
- Dark theme-first design with optional toggle
- Map, live feed, and analytics kept in sync across filters

