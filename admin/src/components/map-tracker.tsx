import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
// We will create the icons inside the component or just use the named export
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockRiders } from '@/providers/mock-data';

// Configure custom circular icons with lucide/css styling.
const createIcon = (color: string) => {
  return new DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

export const MapTracker: React.FC = () => {
  const availableIcon = createIcon('#34d399'); // Green
  const busyIcon = createIcon('#60a5fa');     // Blue

  // Center to Davao shop coordinates
  const center: [number, number] = [7.132836, 125.610605];

  return (
    <div style={{ height: '100%', minHeight: 400, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        {mockRiders
          .filter(d => d.last_latitude && d.last_longitude)
          .map(d => (
            <Marker
              key={d.id}
              position={[d.last_latitude!, d.last_longitude!]}
              icon={d.is_available ? availableIcon : busyIcon}
            >
              <Popup>
                <div style={{ color: '#000' }}>
                  <b>{d.full_name}</b><br/>
                  {d.vehicle_type} - {d.plate_number}<br/>
                  Status: {d.is_available ? 'Available' : 'Busy'}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};
