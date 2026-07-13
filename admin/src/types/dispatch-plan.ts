export type DispatchPlanStatus = "active" | "superseded" | "completed";
export type DispatchStopStatus = "pending" | "completed" | "skipped";

export interface LineStringGeometry {
  type: "LineString";
  coordinates: [longitude: number, latitude: number][];
}

export interface DispatchPlanStop {
  id: number;
  plan_id: number;
  assignment_id: number;
  sequence: number;
  status: DispatchStopStatus;
  destination_latitude: number;
  destination_longitude: number;
  leg_duration_seconds: number;
  leg_distance_meters: number;
  leg_geometry: LineStringGeometry;
  order_ref: string | null;
  completed_at: string | null;
  skipped_at: string | null;
}

export interface DispatchPlan {
  id: number;
  rider_profile_id: number;
  version: number;
  status: DispatchPlanStatus;
  origin_latitude: number;
  origin_longitude: number;
  provider: string;
  profile: string;
  total_duration_seconds: number;
  total_distance_meters: number;
  routing_data_stale: boolean;
  planned_at: string;
  stops: DispatchPlanStop[];
}
