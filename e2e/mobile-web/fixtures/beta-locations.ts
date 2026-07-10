export type BetaRouteCheckpoint = {
  id: "store" | "road-to-ven" | "ven" | "road-to-mark" | "mark";
  latitude: number;
  longitude: number;
  accuracy: number;
};

export const betaAddresses = {
  ven: {
    label: "Ven beta route stop",
    fullAddress: "Ven beta route address, Davao City",
    latitude: 7.0645,
    longitude: 125.6082,
  },
  mark: {
    label: "Mark beta route stop",
    fullAddress: "Mark beta route address, Davao City",
    latitude: 7.0731,
    longitude: 125.6128,
  },
} as const;

// These points are acknowledged by the rider REST location endpoint. They are
// deliberately deterministic and follow the store -> Ven -> Mark road order.
export const betaRouteCheckpoints: readonly BetaRouteCheckpoint[] = [
  { id: "store", latitude: 7.064, longitude: 125.6079, accuracy: 4 },
  { id: "road-to-ven", latitude: 7.06424, longitude: 125.60804, accuracy: 4 },
  {
    id: "ven",
    latitude: betaAddresses.ven.latitude,
    longitude: betaAddresses.ven.longitude,
    accuracy: 3,
  },
  { id: "road-to-mark", latitude: 7.0687, longitude: 125.6102, accuracy: 4 },
  {
    id: "mark",
    latitude: betaAddresses.mark.latitude,
    longitude: betaAddresses.mark.longitude,
    accuracy: 3,
  },
];

export function betaCheckpoint(
  id: BetaRouteCheckpoint["id"],
): BetaRouteCheckpoint {
  const checkpoint = betaRouteCheckpoints.find(
    (candidate) => candidate.id === id,
  );
  if (!checkpoint) throw new Error(`Unknown beta route checkpoint: ${id}`);
  return checkpoint;
}
