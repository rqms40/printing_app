import type { VehicleType } from "./enums";

export interface RiderProfile {
  id: string;
  user_id: string;
  full_name?: string;
  vehicle_type: VehicleType;
  plate_number?: string;
  license_number?: string;
  is_available: boolean;
  last_latitude?: number;
  last_longitude?: number;
  last_location_update?: string;
  created_at: string;
  updated_at: string;
}
