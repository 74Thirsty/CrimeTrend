import React, { useCallback, useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const SEVERITY_STYLES = {
  violent: { label: 'Violent', color: '#f43f5e' },
  property: { label: 'Property', color: '#f97316' },
  medical: { label: 'Medical', color: '#38bdf8' },
  other: { label: 'Other', color: '#a855f7' }
};

function createMarkerIcon(severity = 'other') {
  const palette = SEVERITY_STYLES[severity] || SEVERITY_STYLES.other;
  return window.L.divIcon({
    className: 'incident-marker',
    html: `
      <div style="
        --marker-color: ${palette.color};
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: ${palette.color};
        box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.35), 0 0 18px rgba(15, 23, 42, 0.9);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function useIncidentStream() {
  const [incidents, setIncidents] = useState([]);
  const pollHandle = useRef(null);
  const sseRef = useRef(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch('/api/incidents', { headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        throw new Error(`Failed to load incidents: ${response.status}`);
      }
      const payload = await response.json();
      if (Array.isArray(payload.incidents)) {
        setIncidents(payload.incidents);
      }
    } catch (error) {
      console.error('snapshot fetch failed', error);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();

    const startPolling = () => {
      if (pollHandle.current) return;
      pollHandle.current = setInterval(fetchSnapshot, 10000);
    };

    const stopPolling = () => {
      if (!pollHandle.current) return;
      clearInterval(pollHandle.current);
      pollHandle.current = null;
    };

    const source = new EventSource('/stream/incidents');
    sseRef.current = source;

    source.onopen = () => {
      stopPolling();
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.incidents)) {
          setIncidents(data.incidents);
        }
      } catch (error) {
        console.error('unable to parse SSE payload', error);
      }
    };

    source.onerror = () => {
      source.close();
      startPolling();
    };

    return () => {
      stopPolling();
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [fetchSnapshot]);

  return incidents;
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

function IncidentPanel({ incident, onClose }) {
  const severityStyle = incident ? SEVERITY_STYLES[incident.severity] || SEVERITY_STYLES.other : null;
  const unitCount = incident?.units?.length ?? 0;
  const timeline = incident?.timeline ?? [];
  const transcript = incident?.audio?.transcript ?? [];
  const audioSource = incident?.audio?.stream_url ?? '';
  return (
    <aside className={['incident-panel', incident ? '' : 'hidden'].join(' ').trim()}>
      {incident ? (
        <>
          <header className="panel-header">
            <div>
              <p className="badge" data-severity={incident.severity}>{severityStyle.label}</p>
              <h2>{incident.call_type}</h2>
            </div>
            <button className="close-button" onClick={onClose}>Close</button>
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
              </tbody>
            </table>
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
                </div>
              ))
            )}
          </section>

          <section className="panel-section audio-player">
            <h3>Radio Feed</h3>
            <audio controls preload="none" src={audioSource}>
              Your browser does not support audio playback.
            </audio>
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

function FilterPanel({ filters, onToggleSeverity }) {
  return (
    <div className="filters">
      {Object.entries(filters).map(([severity, enabled]) => (
        <button
          key={severity}
          className={['filter-chip', enabled ? 'active' : ''].join(' ').trim()}
          onClick={() => onToggleSeverity(severity)}
        >
          {SEVERITY_STYLES[severity]?.label ?? severity}
        </button>
      ))}
    </div>
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
        const marker = window.L.marker(
          [incident.location.latitude, incident.location.longitude],
          {
            icon: createMarkerIcon(incident.severity),
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
  }, [incidents, filters, onSelectIncident]);

  useEffect(() => {
    if (!selectedIncident || !mapRef.current) return;
    mapRef.current.flyTo([selectedIncident.location.latitude, selectedIncident.location.longitude], 15, {
      duration: 0.6
    });
  }, [selectedIncident]);

  return <div id="map" role="presentation" aria-hidden="true" />;
}

function App() {
  const incidents = useIncidentStream();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [severityFilters, setSeverityFilters] = useState({
    violent: true,
    property: true,
    medical: true,
    other: true
  });

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => severityFilters[incident.severity] !== false);
  }, [incidents, severityFilters]);

  useEffect(() => {
    if (selectedIncident) {
      const exists = incidents.find((incident) => incident.incident_id === selectedIncident.incident_id);
      if (!exists) {
        setSelectedIncident(null);
      } else {
        setSelectedIncident(exists);
      }
    }
  }, [incidents, selectedIncident?.incident_id]);

  const handleToggleSeverity = useCallback((severity) => {
    setSeverityFilters((current) => ({
      ...current,
      [severity]: !current[severity]
    }));
  }, []);

  return (
    <div className="app-shell">
      <div className="map-container">
        <div className="panel-section" style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000, width: 'auto' }}>
          <h3 style={{ marginTop: 0 }}>Incident Filters</h3>
          <FilterPanel filters={severityFilters} onToggleSeverity={handleToggleSeverity} />
          <p className="summary" style={{ marginBottom: 0 }}>{filteredIncidents.length} active incidents</p>
        </div>
        <IncidentMap
          incidents={filteredIncidents}
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
