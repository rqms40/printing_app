import type { UserRole } from "./enums";

export interface User {
  id: string;
  uid: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  gender?: string;
  date_of_birth?: string;
  role: UserRole;
  is_profile_complete: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
