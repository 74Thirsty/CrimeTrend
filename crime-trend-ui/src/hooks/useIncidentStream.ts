import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import type { FilterState } from '../components/Filters';

type TimelineEntry = {
  code?: string;
  label?: string;
  timestamp?: string;
};

export interface Incident {
  id: string;
  title: string;
  category: 'violent' | 'property' | 'traffic' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  location: string;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  confidence: number;
  source: {
    name: string;
    feed?: string;
  };
  status?: string;
  timeline: TimelineEntry[];
  ingestedAt?: string;
}

interface RawIncident {
  incident_id: string;
  call_type?: string;
  summary?: string;
  location?: {
    latitude?: number | string;
    longitude?: number | string;
    address?: string;
  };
  time_received?: string;
  status?: string;
  severity?: string;
  subgroup?: string;
  latest_update?: {
    timestamp?: string;
  };
  confidence?: number;
  confidence_updated_at?: string;
  source?: {
    name?: string;
    feed?: string | null;
  } | string;
  provenance?: {
    feed?: string;
    fetched_at?: string;
  };
  timeline?: TimelineEntry[];
  ingested_at?: string;
}

export interface IncidentStats {
  total: number;
  categories: Record<string, number>;
}

export interface HotZone {
  id: string;
  center: {
    lat: number;
    lng: number;
  };
  count: number;
  categories: Record<string, number>;
}

const STREAM_URL = '/stream/incidents';

function parseCoordinate(value?: number | string): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function deriveCategory(raw: RawIncident): Incident['category'] {
  const haystack = `${raw.call_type ?? ''} ${raw.summary ?? ''} ${raw.subgroup ?? ''}`.toLowerCase();
  if (/(traffic|collision|accident|vehicle|dui|road|spd - traffic)/.test(haystack)) {
    return 'traffic';
  }
  switch (raw.severity) {
    case 'violent':
      return 'violent';
    case 'property':
      return 'property';
    default:
      return 'other';
  }
}

function deriveSeverity(raw: RawIncident, category: Incident['category']): Incident['severity'] {
  if (category === 'traffic') {
    return /(injury|fatal|rollover)/i.test(`${raw.summary ?? ''}`) ? 'high' : 'medium';
  }

  switch (raw.severity) {
    case 'violent':
      return 'critical';
    case 'property':
      return 'medium';
    case 'medical':
      return 'high';
    default:
      return 'low';
  }
}

function normaliseIncident(raw: RawIncident): Incident | null {
  if (!raw.incident_id) {
    return null;
  }

  const lat = parseCoordinate(raw.location?.latitude);
  const lng = parseCoordinate(raw.location?.longitude);

  if (lat == null || lng == null) {
    return null;
  }

  const category = deriveCategory(raw);
  const severity = deriveSeverity(raw, category);
  const title = raw.call_type?.trim() || raw.summary?.trim() || 'Incident';
  const description = raw.summary?.trim() && raw.summary.trim() !== title ? raw.summary.trim() : undefined;
  const timestamp = raw.latest_update?.timestamp || raw.time_received || new Date().toISOString();
  const confidence = typeof raw.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(raw.confidence))) : 60;
  const sourceName = typeof raw.source === 'string' ? raw.source : raw.source?.name ?? 'Unknown feed';
  const sourceFeed = typeof raw.source === 'object' && raw.source ? raw.source.feed ?? undefined : raw.provenance?.feed;
  const timeline: TimelineEntry[] = Array.isArray(raw.timeline)
    ? raw.timeline.filter((entry) => Boolean(entry?.timestamp))
    : [];
  const ingestedAt = raw.ingested_at || raw.provenance?.fetched_at;

  return {
    id: raw.incident_id,
    title,
    category,
    severity,
    timestamp,
    location: raw.location?.address?.trim() || 'Unknown location',
    description,
    coordinates: {
      lat,
      lng
    },
    confidence,
    source: {
      name: sourceName,
      feed: sourceFeed ?? undefined
    },
    status: raw.status,
    timeline,
    ingestedAt
  };
}

function mapIncidents(rawIncidents: RawIncident[] | undefined): Incident[] {
  if (!rawIncidents || rawIncidents.length === 0) {
    return [];
  }

  return rawIncidents
    .map((incident) => normaliseIncident(incident))
    .filter((incident): incident is Incident => Boolean(incident))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function useIncidentStream(filters: FilterState) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [paused, setPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data) as { incidents?: RawIncident[] };
    setIncidents(mapIncidents(data.incidents));
  }, []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<{ incidents?: RawIncident[] }>('/api/incidents')
      .then((response) => {
        if (!cancelled) {
          setIncidents(mapIncidents(response.data.incidents));
        }
      })
      .catch((error) => {
        console.error('Failed to preload incidents', error);
      });

    if (paused) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    const eventSource = new EventSource(STREAM_URL);
    eventSourceRef.current = eventSource;
    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('heartbeat', () => void 0);
    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        if (!paused) {
          setIncidents((current) => [...current]);
        }
      }, 3000);
    };

    return () => {
      cancelled = true;
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [handleMessage, paused]);

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const { filteredIncidents, hotZones, stats } = useMemo(() => {
    const limitTimestamp = (() => {
      const now = Date.now();
      switch (filters.timeframe) {
        case '1h':
          return now - 60 * 60 * 1000;
        case '7d':
          return now - 7 * 24 * 60 * 60 * 1000;
        default:
          return now - 24 * 60 * 60 * 1000;
      }
    })();

    const recent = incidents.filter((incident) => new Date(incident.timestamp).getTime() >= limitTimestamp);
    recent.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const buckets = new Map<
      string,
      {
        lat: number;
        lng: number;
        count: number;
        categories: Record<string, number>;
      }
    >();

    for (const incident of recent) {
      const latKey = incident.coordinates.lat.toFixed(2);
      const lngKey = incident.coordinates.lng.toFixed(2);
      const key = `${latKey},${lngKey}`;
      const bucket = buckets.get(key) ?? {
        lat: Number.parseFloat(latKey),
        lng: Number.parseFloat(lngKey),
        count: 0,
        categories: {}
      };
      bucket.count += 1;
      bucket.categories[incident.category] = (bucket.categories[incident.category] ?? 0) + 1;
      buckets.set(key, bucket);
    }

    const hotZoneList: HotZone[] = Array.from(buckets.entries())
      .filter(([, bucket]) => bucket.count >= 4)
      .map(([key, bucket]) => ({
        id: key,
        center: { lat: bucket.lat, lng: bucket.lng },
        count: bucket.count,
        categories: bucket.categories
      }))
      .sort((a, b) => b.count - a.count);

    const categories: Record<string, number> = {};
    recent.forEach((incident) => {
      categories[incident.category] = (categories[incident.category] ?? 0) + 1;
    });

    return {
      filteredIncidents: recent,
      hotZones: hotZoneList,
      stats: {
        total: recent.length,
        categories
      }
    };
  }, [incidents, filters.timeframe]);

  return {
    incidents: filteredIncidents,
    togglePause,
    paused,
    hotZones,
    stats
  };
}
