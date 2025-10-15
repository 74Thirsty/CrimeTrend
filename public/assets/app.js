import React, { useCallback, useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const SEVERITY_STYLES = {
  violent: { label: 'Violent', color: '#f43f5e' },
  property: { label: 'Property', color: '#f97316' },
  medical: { label: 'Medical', color: '#38bdf8' },
  other: { label: 'Other', color: '#a855f7' }
};

const SEVERITY_ORDER = ['violent', 'property', 'medical', 'other'];
const DEFAULT_FILTERS = { violent: true, property: true, medical: true, other: true };
const FILTER_STORAGE_KEY = 'crimetrend:severity-filters';

const relativeTimeFormatter = typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  : null;

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 'Unknown';
  const diffMs = parsed - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (relativeTimeFormatter) {
    if (absSeconds < 60) {
      return relativeTimeFormatter.format(diffSeconds, 'second');
    }
    const diffMinutes = Math.round(diffSeconds / 60);
    const absMinutes = Math.abs(diffMinutes);
    if (absMinutes < 60) {
      return relativeTimeFormatter.format(diffMinutes, 'minute');
    }
    const diffHours = Math.round(diffMinutes / 60);
    const absHours = Math.abs(diffHours);
    if (absHours < 24) {
      return relativeTimeFormatter.format(diffHours, 'hour');
    }
    const diffDays = Math.round(diffHours / 24);
    const absDays = Math.abs(diffDays);
    if (absDays < 7) {
      return relativeTimeFormatter.format(diffDays, 'day');
    }
    const diffWeeks = Math.round(diffDays / 7);
    if (Math.abs(diffWeeks) < 5) {
      return relativeTimeFormatter.format(diffWeeks, 'week');
    }
    const diffMonths = Math.round(diffDays / 30);
    if (Math.abs(diffMonths) < 12) {
      return relativeTimeFormatter.format(diffMonths, 'month');
    }
    const diffYears = Math.round(diffDays / 365);
    return relativeTimeFormatter.format(diffYears, 'year');
  }
  return new Date(parsed).toLocaleString();
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  } catch (error) {
    return timestamp;
  }
}

function hasIncidentChanges(current, next) {
  if (current.length !== next.length) return true;
  for (let index = 0; index < current.length; index += 1) {
    const a = current[index];
    const b = next[index];
    if (!a || !b) return true;
    if (a.incident_id !== b.incident_id) return true;
    if ((a.updated_at || '') !== (b.updated_at || '')) return true;
    if ((a.confidence_updated_at || '') !== (b.confidence_updated_at || '')) return true;
    if ((a.status || '') !== (b.status || '')) return true;
  }
  return false;
}

function createMarkerIcon(severity = 'other', highlighted = false) {
  const palette = SEVERITY_STYLES[severity] || SEVERITY_STYLES.other;
  const className = ['incident-marker', highlighted ? 'active' : ''].join(' ').trim();
  return window.L.divIcon({
    className,
    html: `
      <div class="marker-dot" style="--marker-color: ${palette.color};"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function useIncidentStream() {
  const [incidents, setIncidents] = useState([]);
  const [connectionState, setConnectionState] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [error, setError] = useState(null);
  const pollHandle = useRef(null);
  const sseRef = useRef(null);
  const reconnectTimer = useRef(null);

  const applyIncidents = useCallback((incoming) => {
    if (!Array.isArray(incoming)) return false;
    const normalised = incoming.filter((item) => item && item.incident_id);
    let changed = false;
    setIncidents((current) => {
      if (!hasIncidentChanges(current, normalised)) {
        return current;
      }
      changed = true;
      return normalised;
    });
    if (changed) {
      setLastUpdated(new Date().toISOString());
      setError(null);
    }
    return changed;
  }, []);

  const fetchSnapshot = useCallback(async ({ explicit = false } = {}) => {
    try {
      setConnectionState((state) => (state === 'connected' ? state : 'polling'));
      const response = await fetch('/api/incidents', { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        throw new Error(`Failed to load incidents: ${response.status}`);
      }
      const payload = await response.json();
      applyIncidents(payload.incidents || []);
      setError(null);
      return true;
    } catch (err) {
      console.error('snapshot fetch failed', err);
      setError(err);
      setConnectionState('error');
      return false;
    }
  }, [applyIncidents]);

  const refresh = useCallback(() => fetchSnapshot({ explicit: true }), [fetchSnapshot]);

  useEffect(() => {
    let disposed = false;

    function startPolling() {
      if (pollHandle.current) return;
      pollHandle.current = setInterval(() => {
        fetchSnapshot().catch(() => {});
      }, 10000);
    }

    function stopPolling() {
      if (!pollHandle.current) return;
      clearInterval(pollHandle.current);
      pollHandle.current = null;
    }

    function clearReconnectTimer() {
      if (!reconnectTimer.current) return;
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    function scheduleReconnect() {
      if (reconnectTimer.current) return;
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, 5000);
    }

    function connect() {
      if (disposed) return;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      const source = new EventSource('/stream/incidents');
      sseRef.current = source;

      source.onopen = () => {
        if (disposed) return;
        stopPolling();
        setConnectionState('connected');
        setError(null);
        setLastHeartbeat(new Date().toISOString());
      };

      source.onmessage = (event) => {
        if (disposed) return;
        try {
          const data = JSON.parse(event.data);
          if (applyIncidents(data.incidents)) {
            setConnectionState('connected');
          }
          setLastHeartbeat(new Date().toISOString());
        } catch (err) {
          console.error('unable to parse SSE payload', err);
        }
      };

      source.addEventListener('heartbeat', (event) => {
        if (disposed) return;
        try {
          const payload = JSON.parse(event.data);
          setLastHeartbeat(payload.timestamp || new Date().toISOString());
        } catch (err) {
          setLastHeartbeat(new Date().toISOString());
        }
      });

      source.onerror = () => {
        if (disposed) return;
        setConnectionState((state) => (state === 'loading' ? 'loading' : 'reconnecting'));
        startPolling();
        clearReconnectTimer();
        source.close();
        sseRef.current = null;
        scheduleReconnect();
      };
    }

    fetchSnapshot().catch(() => {});
    connect();

    const handleFocus = () => {
      refresh();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      disposed = true;
      stopPolling();
      clearReconnectTimer();
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [applyIncidents, fetchSnapshot, refresh]);

  return { incidents, status: connectionState, lastUpdated, lastHeartbeat, error, refresh };
}

function ConnectionBanner({ status, lastUpdated, lastHeartbeat, error, onRefresh }) {
  const meta = {
    loading: {
      title: 'Initialising live stream',
      description: 'Fetching the latest incidents...'
    },
    connected: {
      title: 'Live updates active',
      description: lastHeartbeat ? `Heartbeat ${formatRelativeTime(lastHeartbeat)}` : 'Receiving live incident updates.'
    },
    polling: {
      title: 'Polling snapshot',
      description: 'Live stream paused — falling back to 10s polling.'
    },
    reconnecting: {
      title: 'Reconnecting…',
      description: 'Attempting to re-establish the live incident feed.'
    },
    error: {
      title: 'Live data unavailable',
      description: 'Unable to reach the incident feed right now.'
    }
  }[status] || {
    title: 'Status unknown',
    description: 'Waiting for live data.'
  };

  const lastUpdatedText = lastUpdated ? `Last update ${formatRelativeTime(lastUpdated)}` : null;

  return (
    <div className="connection-banner" data-state={status}>
      <span className="connection-indicator" aria-hidden="true" />
      <div className="connection-details">
        <strong>{meta.title}</strong>
        <p>
          {meta.description}
          {lastUpdatedText ? ` · ${lastUpdatedText}` : ''}
        </p>
        {error ? <p className="connection-error">{error.message || 'An unexpected error occurred.'}</p> : null}
      </div>
      <div className="banner-actions">
        <button type="button" onClick={onRefresh} className="ghost-button">
          Refresh
        </button>
      </div>
    </div>
  );
}

function FilterPanel({ filters, summary, onToggleSeverity }) {
  return (
    <div className="filters">
      {SEVERITY_ORDER.map((severity) => {
        const enabled = filters[severity] !== false;
        const palette = SEVERITY_STYLES[severity] || SEVERITY_STYLES.other;
        const count = summary?.[severity] ?? 0;
        return (
          <button
            key={severity}
            className={['filter-chip', enabled ? 'active' : ''].join(' ').trim()}
            onClick={() => onToggleSeverity(severity)}
            type="button"
            data-severity={severity}
          >
            <span className="chip-dot" style={{ background: palette.color }} aria-hidden="true" />
            <span>{palette.label}</span>
            <span className="chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function RecentIncidentList({ incidents, onSelectIncident }) {
  const display = incidents.slice(0, 6);
  if (display.length === 0) {
    return <p className="summary" style={{ marginBottom: 0 }}>No incidents match the current filters.</p>;
  }
  return (
    <ul className="recent-incidents">
      {display.map((incident) => {
        const palette = SEVERITY_STYLES[incident.severity] || SEVERITY_STYLES.other;
        return (
          <li key={incident.incident_id}>
            <button type="button" onClick={() => onSelectIncident(incident)}>
              <span className="recent-dot" style={{ background: palette.color }} aria-hidden="true" />
              <span className="recent-details">
                <strong>{incident.call_type}</strong>
                <span>{incident.location.address}</span>
                <span className="recent-meta">Confidence {incident.confidence}%</span>
              </span>
              <time>{formatRelativeTime(incident.latest_update?.timestamp || incident.time_received)}</time>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function IncidentPanel({ incident, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (incident && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [incident?.incident_id]);

  const severityStyle = incident ? SEVERITY_STYLES[incident.severity] || SEVERITY_STYLES.other : null;
  const unitCount = incident?.units?.length ?? 0;
  const timeline = incident?.timeline ?? [];
  const transcript = incident?.audio?.transcript ?? [];
  const audioSource = incident?.audio?.stream_url ?? '';
  return (
    <aside ref={panelRef} className={['incident-panel', incident ? '' : 'hidden'].join(' ').trim()}>
      {incident ? (
        <>
          <header className="panel-header">
            <div className="panel-header-title">
              <p className="badge" data-severity={incident.severity}>{severityStyle.label}</p>
              <h2>{incident.call_type}</h2>
            </div>
            <div className="panel-header-actions">
              <span className="confidence-chip">{incident.confidence}% confidence</span>
              <button className="close-button" onClick={onClose} type="button">Close</button>
            </div>
          </header>

          <section className="panel-section">
            <p className="summary">{incident.summary}</p>
            <table className="table">
              <tbody>
                <tr>
                  <th>Location</th>
                  <td>{incident.location.address}</td>
                </tr>
                <tr>
                  <th>Received</th>
                  <td>{formatTime(incident.time_received)}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{incident.status}</td>
                </tr>
                <tr>
                  <th>Latest Update</th>
                  <td>
                    {incident.latest_update ? (
                      <>
                        {incident.latest_update.label}<br />
                        <span className="muted">{formatTime(incident.latest_update.timestamp)}</span>
                      </>
                    ) : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <th>First Seen</th>
                  <td>{formatTime(incident.ingested_at)}</td>
                </tr>
                <tr>
                  <th>Source Feed</th>
                  <td>
                    <span>{incident.source?.name ?? 'Unknown source'}</span>
                    {incident.source?.feed ? (
                      <div className="muted">{incident.source.feed}</div>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="panel-section confidence-section">
            <h3>Confidence</h3>
            <div
              className="confidence-meter"
              role="meter"
              aria-valuenow={incident.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="confidence-track">
                <div className="confidence-progress" style={{ width: `${incident.confidence}%` }} />
              </div>
              <div className="confidence-meta">
                <strong>{incident.confidence}%</strong>
                <span className="muted">Last evaluated {formatTime(incident.confidence_updated_at)}</span>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <h3>Dispatched Units</h3>
            {unitCount === 0 ? (
              <p className="summary">No unit metadata available.</p>
            ) : (
              <ul>
                {incident.units.map((unit) => (
                  <li key={`${unit.role}-${unit.unit_id}`}>{unit.unit_id} · {unit.role}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel-section timeline">
            <h3>Timeline</h3>
            {timeline.length === 0 ? (
              <p className="summary">No timeline entries published yet.</p>
            ) : (
              timeline.map((step) => (
                <div key={step.code + step.timestamp} className="timeline-item" data-severity={incident.severity}>
                  <strong>{step.label}</strong>
                  <div>{formatTime(step.timestamp)}</div>
                  <div className="muted">{formatRelativeTime(step.timestamp)}</div>
                </div>
              ))
            )}
          </section>

          <section className="panel-section">
            <h3>Provenance</h3>
            <ul className="provenance-list">
              <li><strong>Lookback window:</strong> {incident.provenance?.lookback_minutes ?? '—'} minutes</li>
              <li><strong>Snapshot limit:</strong> {incident.provenance?.limit ?? '—'} records</li>
              <li><strong>Last fetch:</strong> {formatTime(incident.provenance?.fetched_at)}</li>
            </ul>
          </section>

          <section className="panel-section audio-player">
            <h3>Radio Feed</h3>
            {audioSource ? (
              <audio controls preload="none" src={audioSource}>
                Your browser does not support audio playback.
              </audio>
            ) : (
              <p className="summary">No radio feed linked for this incident.</p>
            )}
            {transcript.length ? (
              <div className="transcript-log">
                {transcript.map((entry, index) => (
                  <div className="transcript-entry" key={index}>
                    <time>{formatTime(entry.timestamp)}</time>
                    <span>{entry.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="summary">Live transcript is not available for this feed.</p>
            )}
          </section>
        </>
      ) : (
        <div className="panel-section">
          <h3>No incident selected</h3>
          <p className="summary">Select an incident pin to explore detailed updates, dispatched units, and live radio.</p>
        </div>
      )}
    </aside>
  );
}

function IncidentMap({ incidents, filters, onSelectIncident, selectedIncident }) {
  const mapRef = useRef(null);
  const clusterRef = useRef(null);

  useEffect(() => {
    const map = window.L.map('map', {
      center: [47.60357, -122.32945],
      zoom: 12,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      preferCanvas: true
    });

    window.L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    tileLayer.addTo(map);

    const markerCluster = window.L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16
    });
    markerCluster.addTo(map);

    mapRef.current = map;
    clusterRef.current = markerCluster;

    return () => {
      markerCluster.clearLayers();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const clusterGroup = clusterRef.current;
    if (!clusterGroup) return;
    clusterGroup.clearLayers();

    incidents
      .filter((incident) => filters[incident.severity] !== false)
      .forEach((incident) => {
        const highlighted = Boolean(selectedIncident && incident.incident_id === selectedIncident.incident_id);
        const marker = window.L.marker(
          [incident.location.latitude, incident.location.longitude],
          {
            icon: createMarkerIcon(incident.severity, highlighted),
            title: incident.summary
          }
        );

        marker.on('click', () => onSelectIncident(incident));

        marker.bindTooltip(
          `<div class="tooltip"><strong>${incident.call_type}</strong><br/>${incident.location.address}</div>`,
          { direction: 'top', offset: [0, -10] }
        );

        clusterGroup.addLayer(marker);
      });
  }, [incidents, filters, onSelectIncident, selectedIncident?.incident_id]);

  useEffect(() => {
    if (!selectedIncident || !mapRef.current) return;
    mapRef.current.flyTo([selectedIncident.location.latitude, selectedIncident.location.longitude], 15, {
      duration: 0.6
    });
  }, [selectedIncident?.incident_id]);

  return <div id="map" role="presentation" aria-hidden="true" />;
}

function App() {
  const { incidents, status, lastUpdated, lastHeartbeat, error, refresh } = useIncidentStream();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [severityFilters, setSeverityFilters] = useState(() => {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_FILTERS };
    }
    try {
      const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_FILTERS, ...parsed };
      }
    } catch (err) {
      console.warn('unable to parse stored filters', err);
    }
    return { ...DEFAULT_FILTERS };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(severityFilters));
    } catch (err) {
      console.warn('unable to persist filters', err);
    }
  }, [severityFilters]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => severityFilters[incident.severity] !== false);
  }, [incidents, severityFilters]);

  useEffect(() => {
    if (!selectedIncident) return;
    const updated = incidents.find((incident) => incident.incident_id === selectedIncident.incident_id);
    if (!updated) {
      setSelectedIncident(null);
    } else if (updated !== selectedIncident) {
      setSelectedIncident(updated);
    }
  }, [incidents, selectedIncident]);

  const handleToggleSeverity = useCallback((severity) => {
    setSeverityFilters((current) => ({
      ...current,
      [severity]: !current[severity]
    }));
  }, []);

  const severitySummary = useMemo(() => {
    const summary = { violent: 0, property: 0, medical: 0, other: 0 };
    incidents.forEach((incident) => {
      const key = SEVERITY_ORDER.includes(incident.severity) ? incident.severity : 'other';
      summary[key] = (summary[key] ?? 0) + 1;
    });
    return summary;
  }, [incidents]);

  const recentIncidents = useMemo(() => filteredIncidents.slice(0, 6), [filteredIncidents]);

  return (
    <div className="app-shell">
      <div className="map-container">
        <div className="map-overlay">
          <div className="panel-section overlay-block">
            <ConnectionBanner
              status={status}
              lastUpdated={lastUpdated}
              lastHeartbeat={lastHeartbeat}
              error={error}
              onRefresh={refresh}
            />
          </div>
          <div className="panel-section overlay-block">
            <div className="overlay-header">
              <div>
                <h3>Incident Filters</h3>
                <p className="summary">Showing {filteredIncidents.length} of {incidents.length} active incidents</p>
              </div>
            </div>
            <FilterPanel filters={severityFilters} summary={severitySummary} onToggleSeverity={handleToggleSeverity} />
          </div>
          <div className="panel-section overlay-block">
            <div className="overlay-header">
              <h3>Recent Activity</h3>
            </div>
            <RecentIncidentList incidents={recentIncidents} onSelectIncident={setSelectedIncident} />
          </div>
        </div>
        <IncidentMap
          incidents={incidents}
          filters={severityFilters}
          onSelectIncident={setSelectedIncident}
          selectedIncident={selectedIncident}
        />
      </div>
      <IncidentPanel incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
