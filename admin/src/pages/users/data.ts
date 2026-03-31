import { apiClient } from "@/providers/api-client";
import { normalizeAdminUsers, type AdminUserRecord } from "@/utils/api-normalizers";

export async function loadAdminUsers(): Promise<AdminUserRecord[]> {
  const response = await apiClient.get("/admin/users");
  return normalizeAdminUsers(response.data);
}

type AdminUsersState = {
  loading: boolean;
  users: AdminUserRecord[];
  error: string | null;
};

type AdminUsersViewModel =
  | { kind: "ready"; users: AdminUserRecord[] }
  | { kind: "error"; users: AdminUserRecord[]; retryLabel: string; message: string };

export function buildAdminUsersViewModel(state: AdminUsersState): AdminUsersViewModel {
  if (state.error) {
    return {
      kind: "error",
      users: state.users,
      retryLabel: "Retry",
      message: state.error,
    };
  }

  return {
    kind: "ready",
    users: state.users,
  };
}
