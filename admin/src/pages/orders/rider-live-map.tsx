import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { DivIcon, LatLngBounds, type LatLngExpression } from "leaflet";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";
import { getDispatchPlan } from "@/services/dispatchPlansApi";
import type { DispatchPlan } from "@/types/dispatch-plan";

const SUPPLIER_ICON = new DivIcon({
  className: "live-supplier-pin",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#FFDE58;border:2px solid #141414"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const CUSTOMER_ICON = new DivIcon({
  className: "live-customer-pin",
  html: `<div style="width:16px;height:16px;border-radius:4px;background:#60a5fa;border:2px solid #141414"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const RIDER_ICON = new DivIcon({
  className: "live-rider-pin",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#34d399;border:3px solid #fff;box-shadow:0 0 0 2px #141414"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitPoints({ points }: { points: LatLngExpression[] }) {
  const map = useMap();
  const key = points.map((p) => (Array.isArray(p) ? p.join(",") : "")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(new LatLngBounds(points), { padding: [28, 28] });
  }, [map, key, points]);
  return null;
}

function routePointsFromPlan(
  plan: DispatchPlan | null,
  assignmentId: number | null,
): LatLngExpression[] {
  if (!plan || assignmentId == null) return [];
  const pending = plan.stops
    .filter(
      (stop) =>
        stop.status === "pending" &&
        Number(stop.assignment_id) === assignmentId,
    )
    .sort((a, b) => a.sequence - b.sequence)[0];
  const geometry = pending?.leg_geometry?.coordinates ?? [];
  return geometry
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => [lat, lng] as [number, number]);
}

export function RiderLiveTrackingMap({
  assignmentId,
  riderProfileId,
  riderLatitude,
  riderLongitude,
  supplierLatitude,
  supplierLongitude,
  customerLatitude,
  customerLongitude,
  headingTo,
}: {
  assignmentId: number | null;
  riderProfileId: number | null;
  riderLatitude?: number | null;
  riderLongitude?: number | null;
  supplierLatitude?: number | null;
  supplierLongitude?: number | null;
  customerLatitude?: number | null;
  customerLongitude?: number | null;
  headingTo: "supplier" | "customer";
}) {
  const [liveRider, setLiveRider] = useState<[number, number] | null>(null);
  const [plan, setPlan] = useState<DispatchPlan | null>(null);

  useEffect(() => {
    if (riderProfileId == null) return;
    void getDispatchPlan(riderProfileId)
      .then((next) => setPlan(next))
      .catch(() => setPlan(null));
  }, [riderProfileId, assignmentId, headingTo]);

  useEffect(() => {
    if (assignmentId == null) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const socket: Socket = io(`${WS_URL}/ws/location`, {
      auth: { token },
      reconnection: true,
    });
    socket.emit("subscribe", String(assignmentId));
    socket.on(
      "locationUpdate",
      (payload: { latitude?: number; longitude?: number }) => {
        const lat = Number(payload.latitude);
        const lng = Number(payload.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLiveRider([lat, lng]);
        }
      },
    );
    return () => {
      socket.disconnect();
    };
  }, [assignmentId]);

  const riderPoint: [number, number] | null = liveRider
    ?? (Number.isFinite(Number(riderLatitude)) &&
    Number.isFinite(Number(riderLongitude))
      ? [Number(riderLatitude), Number(riderLongitude)]
      : null);
  const supplierPoint: [number, number] | null =
    Number.isFinite(Number(supplierLatitude)) &&
    Number.isFinite(Number(supplierLongitude))
      ? [Number(supplierLatitude), Number(supplierLongitude)]
      : null;
  const customerPoint: [number, number] | null =
    Number.isFinite(Number(customerLatitude)) &&
    Number.isFinite(Number(customerLongitude))
      ? [Number(customerLatitude), Number(customerLongitude)]
      : null;
  const route = useMemo(
    () => routePointsFromPlan(plan, assignmentId),
    [plan, assignmentId],
  );
  const fitPoints = [
    ...(riderPoint ? [riderPoint] : []),
    ...(supplierPoint ? [supplierPoint] : []),
    ...(headingTo === "customer" && customerPoint ? [customerPoint] : []),
    ...route,
  ];

  return (
    <div style={{ height: 360, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        center={riderPoint ?? supplierPoint ?? customerPoint ?? [7.064, 125.6079]}
        zoom={14}
        style={{ height: "100%", width: "100%", background: "#111" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />
        <FitPoints points={fitPoints} />
        {route.length >= 2 && (
          <Polyline
            positions={route}
            pathOptions={{ color: "#FFDE58", weight: 5, opacity: 0.9 }}
          />
        )}
        {supplierPoint && (
          <Marker position={supplierPoint} icon={SUPPLIER_ICON}>
            <Popup>Supplier pickup</Popup>
          </Marker>
        )}
        {customerPoint && (
          <Marker position={customerPoint} icon={CUSTOMER_ICON}>
            <Popup>Customer delivery</Popup>
          </Marker>
        )}
        {riderPoint && (
          <Marker position={riderPoint} icon={RIDER_ICON}>
            <Popup>
              Rider live location
              <div style={{ color: "#888", fontSize: 12 }}>
                Heading to {headingTo === "supplier" ? "supplier shop" : "customer"}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
