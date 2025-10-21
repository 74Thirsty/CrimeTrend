import PropTypes from 'prop-types';
import { CircleMarker, Tooltip } from 'react-leaflet';

const TYPE_STYLE = {
  police: { color: '#2563eb', label: 'Police', icon: '🛡️' },
  fire: { color: '#dc2626', label: 'Fire', icon: '🔥' },
  medical: { color: '#16a34a', label: 'Medical', icon: '✚' },
  weather: { color: '#9333ea', label: 'Weather', icon: '☁️' },
  disaster: { color: '#f97316', label: 'Disaster', icon: '⚠️' },
  other: { color: '#0ea5e9', label: 'Other', icon: 'ⓘ' }
};

function resolveStyle(type) {
  const key = type?.toLowerCase() ?? 'other';
  if (key.includes('fire')) return TYPE_STYLE.fire;
  if (key.includes('med') || key.includes('ems')) return TYPE_STYLE.medical;
  if (key.includes('weather') || key.includes('storm')) return TYPE_STYLE.weather;
  if (key.includes('disaster') || key.includes('fema')) return TYPE_STYLE.disaster;
  if (key.includes('police') || key.includes('law') || key.includes('pd')) return TYPE_STYLE.police;
  return TYPE_STYLE.other;
}

export function MapLayer({ incidents, onMarkerClick }) {
  return incidents.map((incident) => {
    const style = resolveStyle(incident.type);
    return (
      <CircleMarker
        key={incident.id}
        center={[incident.lat, incident.lon]}
        radius={8}
        eventHandlers={
          onMarkerClick
            ? {
                click: () => onMarkerClick(incident)
              }
            : undefined
        }
        pathOptions={{
          color: style.color,
          fillColor: style.color,
          fillOpacity: 0.7,
          weight: 2
        }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1} className="bg-white/95 text-slate-700 shadow">
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-slate-900">
              {style.icon} {incident.type}
            </p>
            <p className="text-slate-600">{incident.agency}</p>
            <p className="text-slate-500">{new Date(incident.timestamp).toLocaleTimeString()}</p>
            <p className="text-slate-500">{incident.address}</p>
            <p className="text-slate-500 capitalize">Status: {incident.status ?? 'unknown'}</p>
            {incident.audio_url ? (
              <a
                href={incident.audio_url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:underline"
              >
                Listen Live
              </a>
            ) : (
              <span className="text-slate-400">Audio unavailable</span>
            )}
          </div>
        </Tooltip>
      </CircleMarker>
    );
  });
}

MapLayer.propTypes = {
  incidents: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      agency: PropTypes.string.isRequired,
      address: PropTypes.string.isRequired,
      lat: PropTypes.number.isRequired,
      lon: PropTypes.number.isRequired,
      status: PropTypes.string,
      source: PropTypes.string.isRequired,
      audio_url: PropTypes.string
    })
  ).isRequired,
  onMarkerClick: PropTypes.func
};

MapLayer.defaultProps = {
  onMarkerClick: undefined
};

export default MapLayer;
