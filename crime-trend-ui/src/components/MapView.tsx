import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, LayersControl, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { HotZone, Incident } from '../hooks/useIncidentStream';
import type { FilterState } from './Filters';
import { ALL_STATE_OPTION } from '../constants/states';
import { ALL_COUNTY_OPTION } from '../constants/counties';

interface MapViewProps {
  incidents: Incident[];
  filters: FilterState;
  hotZones?: HotZone[];
}

const categoryColor: Record<string, string> = {
  violent: '#ef4444',
  property: '#f97316',
  traffic: '#3b82f6',
  other: '#10b981'
};

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
    <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/50 shadow-xl">
      <div className="flex items-center justify-between px-5 py-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Geospatial view</h2>
        <span>{filtered.length} plotted incidents</span>
      </div>
      <div className="h-[420px]">
        <MapContainer center={[40.7128, -74.006]} zoom={11} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Pins">
              <LayerGroup>
                {filtered.map((incident) => (
                  <CircleMarker
                    key={incident.id}
                    center={[incident.coordinates.lat, incident.coordinates.lng]}
                    radius={8}
                    pathOptions={{
                      color: categoryColor[incident.category] ?? '#22d3ee',
                      fillColor: categoryColor[incident.category] ?? '#22d3ee',
                      fillOpacity: 0.6,
                      className: 'animate-pulseGlow'
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1} className="bg-slate-900/90">
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-white">{incident.title}</p>
                        <p className="text-slate-300">{incident.location}</p>
                        {incident.state && <p className="text-slate-400">{incident.state}</p>}
                        <p className="text-slate-400">{incident.severity.toUpperCase()}</p>
                        <p className="text-slate-400">{incident.confidence}% confidence</p>
                        <p className="text-slate-500">{incident.source.name}</p>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
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
                        <Tooltip direction="top" offset={[0, -8]} opacity={1} className="bg-rose-600/80">
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold text-white">{zone.count} incidents</p>
                            {Object.entries(zone.categories)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3)
                              .map(([category, count]) => (
                                <p key={category} className="text-rose-100/90">
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
