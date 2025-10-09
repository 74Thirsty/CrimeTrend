import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import type { FilterState } from '../components/Filters';

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

export function useIncidentStream(filters: FilterState) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [paused, setPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { incidents: Incident[] };
      setIncidents(data.incidents);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get<{ incidents: Incident[] }>('/api/incidents')
      .then((response) => {
        if (!cancelled) {
          setIncidents(response.data.incidents ?? []);
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
