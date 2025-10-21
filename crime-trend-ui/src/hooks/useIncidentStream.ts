import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import type { FilterState, Category, Severity } from '../components/Filters';
import { ALL_STATE_OPTION, normaliseStateCode } from '../constants/states';
import { ALL_COUNTY_OPTION } from '../constants/counties';

export type TimelineEntry = {
  code?: string;
  label?: string;
  timestamp?: string;
};

export interface Incident {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
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
  state?: string;
  canonical: {
    type: string;
    agency: string;
    status: string;
    source: string;
    audioUrl?: string | null;
  };
}

interface RawIncident {
  id: string;
  timestamp: string;
  type: string;
  agency: string;
  address: string;
  lat: number;
  lon: number;
  status: string;
  source: string;
  audio_url?: string | null;
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

const STREAM_ENDPOINT = '/stream';

function timeframeToMs(timeframe: FilterState['timeframe']): number {
  switch (timeframe) {
    case '1h':
      return 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function classifyCategory(type: string): Category {
  const needle = type.toLowerCase();
  if (/(shooting|assault|weapon|robbery|police)/.test(needle)) return 'violent';
  if (/(burglary|theft|property|trespass)/.test(needle)) return 'property';
  if (/(fire|hazmat|alarm)/.test(needle)) return 'other';
  if (/(traffic|collision|vehicle|accident)/.test(needle)) return 'traffic';
  if (/(medical|ems|aid)/.test(needle)) return 'other';
  return 'other';
}

function classifySeverity(type: string): Severity {
  const needle = type.toLowerCase();
  if (/(critical|shooting|fatal|major)/.test(needle)) return 'critical';
  if (/(fire|hazmat|weapon)/.test(needle)) return 'high';
  if (/(medical|injury|collision)/.test(needle)) return 'medium';
  return 'low';
}

function parseState(address: string): string | undefined {
  const match = /,\s*([A-Z]{2})(?:\s+\d{5})?$/.exec(address.trim());
  if (!match) {
    return undefined;
  }
  const state = normaliseStateCode(match[1]);
  return state ?? undefined;
}

function normaliseIncident(raw: RawIncident): Incident | null {
  if (!raw.id) {
    return null;
  }
  if (typeof raw.lat !== 'number' || typeof raw.lon !== 'number') {
    return null;
  }

  const title = raw.type?.trim() || 'Incident';
  const category = classifyCategory(title);
  const severity = classifySeverity(title);
  const state = parseState(raw.address) ?? undefined;

  return {
    id: raw.id,
    title,
    category,
    severity,
    timestamp: raw.timestamp,
    location: raw.address || 'Unknown location',
    coordinates: {
      lat: raw.lat,
      lng: raw.lon
    },
    description: undefined,
    confidence: severity === 'critical' ? 90 : severity === 'high' ? 80 : severity === 'medium' ? 70 : 60,
    source: {
      name: raw.agency || raw.source || 'Unknown feed',
      feed: raw.source
    },
    status: raw.status,
    timeline: [],
    ingestedAt: raw.timestamp,
    state,
    canonical: {
      type: raw.type,
      agency: raw.agency,
      status: raw.status,
      source: raw.source,
      audioUrl: raw.audio_url ?? null
    }
  };
}

function mapIncidents(rawIncidents: RawIncident[] | undefined): Incident[] {
  if (!rawIncidents || rawIncidents.length === 0) {
    return [];
  }
  const map = new Map<string, Incident>();
  rawIncidents.forEach((raw) => {
    const incident = normaliseIncident(raw);
    if (incident) {
      map.set(incident.id, incident);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function useIncidentStream(filters: FilterState) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [paused, setPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [connectionNonce, setConnectionNonce] = useState(0);
  const pausedRef = useRef(false);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as RawIncident;
      const incident = normaliseIncident(payload);
      if (!incident) {
        return;
      }
      setIncidents((prev) => {
        const map = new Map(prev.map((item) => [item.id, item] as const));
        map.set(incident.id, incident);
        return Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 500);
      });
    } catch (error) {
      console.error('Failed to parse incident stream payload', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - timeframeToMs(filters.timeframe)).toISOString();
    axios
      .get<RawIncident[]>('/incidents', {
        params: { since }
      })
      .then((response) => {
        if (!cancelled) {
          setIncidents(mapIncidents(response.data));
        }
      })
      .catch((error) => {
        console.error('Failed to preload incidents', error);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.timeframe, connectionNonce]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (paused) {
      wsRef.current?.close();
      wsRef.current = null;
      return undefined;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}${STREAM_ENDPOINT}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', () => {
      ws.removeEventListener('message', handleMessage);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (!pausedRef.current) {
        reconnectTimerRef.current = window.setTimeout(() => {
          setConnectionNonce((value) => value + 1);
        }, 3000);
      }
    });
    ws.addEventListener('error', () => {
      ws.close();
    });

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.close();
      wsRef.current = null;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [handleMessage, paused, connectionNonce]);

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const { filteredIncidents, hotZones, stats } = useMemo(() => {
    const limitTimestamp = Date.now() - timeframeToMs(filters.timeframe);
    const countyNeedle = filters.county !== ALL_COUNTY_OPTION ? filters.county.toLowerCase() : null;
    const query = filters.query.toLowerCase();

    const matches = incidents
      .filter((incident) => new Date(incident.timestamp).getTime() >= limitTimestamp)
      .filter((incident) => {
        if (filters.state === ALL_STATE_OPTION) {
          return true;
        }
        return incident.state?.toUpperCase() === filters.state;
      })
      .filter((incident) => {
        if (!countyNeedle) {
          return true;
        }
        return incident.location.toLowerCase().includes(countyNeedle);
      })
      .filter((incident) => {
        if (filters.categories.size > 0 && !filters.categories.has(incident.category)) {
          return false;
        }
        if (filters.severities.size > 0 && !filters.severities.has(incident.severity)) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = `${incident.title} ${incident.location} ${incident.status ?? ''} ${incident.source.name} ${
          incident.canonical.agency
        }`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const buckets = new Map<string, { lat: number; lng: number; count: number; categories: Record<string, number> }>();
    for (const incident of matches) {
      const latKey = incident.coordinates.lat.toFixed(2);
      const lngKey = incident.coordinates.lng.toFixed(2);
      const key = `${latKey},${lngKey}`;
      const bucket =
        buckets.get(key) ?? {
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
      .filter(([, bucket]) => bucket.count >= 3)
      .map(([key, bucket]) => ({
        id: key,
        center: { lat: bucket.lat, lng: bucket.lng },
        count: bucket.count,
        categories: bucket.categories
      }))
      .sort((a, b) => b.count - a.count);

    const categories: Record<string, number> = {};
    matches.forEach((incident) => {
      categories[incident.category] = (categories[incident.category] ?? 0) + 1;
    });

    return {
      filteredIncidents: matches,
      hotZones: hotZoneList,
      stats: {
        total: matches.length,
        categories
      }
    };
  }, [incidents, filters]);

  return {
    incidents: filteredIncidents,
    togglePause,
    paused,
    hotZones,
    stats
  };
}
