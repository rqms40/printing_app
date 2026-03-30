import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockDrivers } from '../data/mockDrivers';

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Create custom icons based on status
const createIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

const availableIcon = createIcon('#34d399'); // success Green
const busyIcon = createIcon('#60a5fa'); // info Blue

export const MapTracker: React.FC = () => {
  // Center to Davao shop coordinates
  const center: [number, number] = [7.132836, 125.610605];

  return (
    <div className="card" style={{ height: '100%', padding: 0, overflow: 'hidden', minHeight: 400 }}>
      {/* 
        Using standard standard osm tiles. Dark tiles would be better for our theme, 
        but require registration usually (like mapbox). We'll stick to free OSM.
        Though CartoDB dark_all is free without auth! Let's use CartoDB dark.
      */}
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {mockDrivers.map(d => (
          <Marker 
            key={d.id} 
            position={[d.lastLatitude, d.lastLongitude]}
            icon={d.isAvailable ? availableIcon : busyIcon}
          >
            <Popup>
              <div style={{ color: '#000', padding: '4px' }}>
                <b style={{ fontSize: '1.1rem' }}>{d.name}</b><br/>
                {d.vehicleType} - {d.plateNumber}<br/>
                Status: {d.isAvailable ? 'Available' : 'On Delivery'}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
