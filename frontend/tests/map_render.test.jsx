import { render, screen } from '@testing-library/react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapLayer from '../MapLayer.jsx';

const incidents = [
  {
    id: '1',
    timestamp: '2024-01-01T00:00:00Z',
    type: 'Police Response',
    agency: 'Seattle PD',
    address: '500 Pine St, Seattle, WA',
    lat: 47.608,
    lon: -122.335,
    status: 'dispatched',
    source: 'seattle',
    audio_url: 'https://example.com/audio'
  },
  {
    id: '2',
    timestamp: '2024-01-01T00:05:00Z',
    type: 'Medical Aid',
    agency: 'Seattle Fire',
    address: '600 Pine St, Seattle, WA',
    lat: 47.609,
    lon: -122.336,
    status: 'active',
    source: 'seattle',
    audio_url: null
  }
];

describe('MapLayer', () => {
  it('renders incidents with audio metadata', async () => {
    render(
      <MapContainer center={[47.608, -122.335]} zoom={12} style={{ height: 400, width: 400 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapLayer incidents={incidents} />
      </MapContainer>
    );

    expect(await screen.findByText(/Police Response/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /listen live/i })).toHaveAttribute('href', incidents[0].audio_url);
    expect(screen.getByText(/Audio unavailable/i)).toBeInTheDocument();
  });
});
