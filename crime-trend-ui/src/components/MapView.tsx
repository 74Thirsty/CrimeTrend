import { useMemo } from 'react';
import { MapContainer, TileLayer, LayersControl, LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { HotZone, Incident } from '../hooks/useIncidentStream';
import type { FilterState } from './Filters';
import { ALL_STATE_OPTION } from '../constants/states';
import { ALL_COUNTY_OPTION } from '../constants/counties';
import { MapLayer } from './MapLayer';

interface MapViewProps {
  incidents: Incident[];
  filters: FilterState;
  hotZones?: HotZone[];
}

export function MapView({ incidents, filters, hotZones = [] }: MapViewProps) {
  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      if (filters.categories.size > 0 && !filters.categories.has(incident.category)) {
        return false;
      }
      if (filters.severities.size > 0 && !filters.severities.has(incident.severity)) {
        return false;
      }
      if (filters.state !== ALL_STATE_OPTION) {
        if (!incident.state || incident.state.toUpperCase() !== filters.state) {
          return false;
        }
      }
      if (filters.county !== ALL_COUNTY_OPTION) {
        if (!incident.location.toLowerCase().includes(filters.county.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, filters]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-200/70 transition-colors dark:border-slate-800/60 dark:bg-slate-900/50 dark:shadow-slate-900/50">
      <div className="flex items-center justify-between px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Geospatial view</h2>
        <span>{filtered.length} plotted incidents</span>
      </div>
      <div className="h-[420px]">
        <MapContainer center={[40.7128, -74.006]} zoom={11} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Incident layer">
              <LayerGroup>
                <MapLayer
                  incidents={filtered.map((incident) => ({
                    id: incident.id,
                    timestamp: incident.timestamp,
                    type: incident.canonical.type || incident.title,
                    agency: incident.canonical.agency || incident.source.name,
                    address: incident.location,
                    lat: incident.coordinates.lat,
                    lon: incident.coordinates.lng,
                    status: incident.canonical.status || incident.status || 'unknown',
                    source: incident.canonical.source || incident.source.name,
                    audio_url: incident.canonical.audioUrl ?? undefined
                  }))}
                />
              </LayerGroup>
            </LayersControl.BaseLayer>
            {hotZones.length > 0 && (
              <LayersControl.Overlay checked={filters.heatmap} name="Hot zones">
                <LayerGroup>
                  {filters.heatmap &&
                    hotZones.map((zone) => (
                      <CircleMarker
                        key={`hz-${zone.id}`}
                        center={[zone.center.lat, zone.center.lng]}
                        radius={Math.min(25, 8 + zone.count * 1.5)}
                        pathOptions={{
                          color: '#f43f5e',
                          fillColor: '#f43f5e',
                          fillOpacity: 0.25,
                          weight: 2
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -8]} opacity={1} className="bg-rose-200/90 text-rose-700 shadow dark:bg-rose-600/80 dark:text-rose-50">
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-rose-700 dark:text-white">{zone.count} incidents</p>
                            {Object.entries(zone.categories)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3)
                              .map(([category, count]) => (
                                <p key={category} className="text-rose-600 dark:text-rose-100/90">
                                  {category}: {count}
                                </p>
                              ))}
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                </LayerGroup>
              </LayersControl.Overlay>
            )}
          </LayersControl>
        </MapContainer>
      </div>
    </div>
  );
}
