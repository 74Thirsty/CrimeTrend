import type { FC } from 'react';
import MapLayerComponent from '../../../frontend/MapLayer.jsx';

type CanonicalIncident = {
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
};

type MapLayerProps = {
  incidents: CanonicalIncident[];
  onMarkerClick?: (incident: CanonicalIncident) => void;
};

export const MapLayer: FC<MapLayerProps> = ({ incidents, onMarkerClick }) => (
  <MapLayerComponent incidents={incidents} onMarkerClick={onMarkerClick} />
);

export type { CanonicalIncident, MapLayerProps };
