import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/config/constants";

export type GridLatLng = { lat: number; lng: number };

export type GridMapMarker = {
  id: string;
  position: GridLatLng;
  title?: string;
  /** Named pin color for status (used in title/label only; classic markers). */
  color?: string;
};

export type GridMapPolyline = {
  id: string;
  path: GridLatLng[];
  color?: string;
  weight?: number;
};

export type GridMapCircle = {
  id: string;
  center: GridLatLng;
  radiusMeters: number;
  strokeColor?: string;
  fillColor?: string;
};

type Props = {
  center: GridLatLng;
  zoom?: number;
  height?: number | string;
  markers?: GridMapMarker[];
  polylines?: GridMapPolyline[];
  circles?: GridMapCircle[];
  fitPositions?: GridLatLng[];
  interactive?: boolean;
  onClick?: (position: GridLatLng) => void;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
};

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e0e0e" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
];

function FitBounds({ positions }: { positions: GridLatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || positions.length === 0) return;
    if (positions.length === 1) {
      map.setCenter(positions[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    positions.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 40);
  }, [map, positions]);
  return null;
}

function PolylineLayer({ polylines }: { polylines: GridMapPolyline[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const drawn = polylines
      .filter((p) => p.path.length >= 2)
      .map(
        (p) =>
          new google.maps.Polyline({
            map,
            path: p.path,
            strokeColor: p.color ?? "#FFDE58",
            strokeWeight: p.weight ?? 4,
            strokeOpacity: 0.95,
          }),
      );
    return () => {
      drawn.forEach((line) => line.setMap(null));
    };
  }, [map, polylines]);
  return null;
}

function CircleLayer({ circles }: { circles: GridMapCircle[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const drawn = circles.map(
      (c) =>
        new google.maps.Circle({
          map,
          center: c.center,
          radius: c.radiusMeters,
          strokeColor: c.strokeColor ?? "#FFDE58",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: c.fillColor ?? "#FFDE58",
          fillOpacity: 0.12,
        }),
    );
    return () => {
      drawn.forEach((circle) => circle.setMap(null));
    };
  }, [map, circles]);
  return null;
}

function MapShell({
  center,
  zoom = 13,
  markers = [],
  polylines = [],
  circles = [],
  fitPositions,
  interactive = true,
  onClick,
  style,
  className,
  children,
  height = 320,
}: Props) {
  const fit = useMemo(
    () => fitPositions ?? markers.map((m) => m.position),
    [fitPositions, markers],
  );

  return (
    <div
      className={className}
      style={{
        height,
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        ...style,
      }}
    >
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling={interactive ? "greedy" : "none"}
        disableDefaultUI
        styles={DARK_STYLE}
        onClick={(e: MapMouseEvent) => {
          if (!onClick || !e.detail.latLng) return;
          onClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {fit.length > 0 && <FitBounds positions={fit} />}
        <PolylineLayer polylines={polylines} />
        <CircleLayer circles={circles} />
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            title={marker.title}
          />
        ))}
        {children}
      </Map>
    </div>
  );
}

function MapFallback({
  height,
  message,
}: {
  height?: number | string;
  message: ReactNode;
}) {
  return (
    <div
      style={{
        height: height ?? 320,
        display: "grid",
        placeItems: "center",
        background: "#141414",
        color: "#A0A0A0",
        borderRadius: 8,
        border: "1px solid #2E2E2E",
        padding: 16,
        textAlign: "center",
        lineHeight: 1.5,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

/**
 * GRIDGO admin Google Map host.
 * Requires VITE_GOOGLE_MAPS_API_KEY (same value as server GOOGLE_MAPS_API).
 *
 * ApiTargetBlockedMapError means the key cannot use Maps JavaScript API —
 * enable that API in GCP and include it under the key's API restrictions.
 */
export function GridGoogleMap(props: Props) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <MapFallback
        height={props.height}
        message={
          <>
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> (or compose{" "}
            <code>GOOGLE_MAPS_API</code>) to load Google Maps.
          </>
        }
      />
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      onError={(error) => {
        // Surfaces in console; Map still may show Google's error tile.
        console.error("[GridGoogleMap]", error);
      }}
    >
      <MapShell {...props} />
    </APIProvider>
  );
}

export default GridGoogleMap;
