import { apiClient } from "@/providers/api-client";
import {
  normalizeAdminUserDetail,
  normalizeAdminUsers,
  type AdminUserDetailPayload,
  type AdminUserRecord,
} from "@/utils/api-normalizers";

export async function loadAdminUsers(): Promise<AdminUserRecord[]> {
  const response = await apiClient.get("/admin/users");
  return normalizeAdminUsers(response.data);
}

export async function loadAdminUserDetail(
  id: number | string,
): Promise<AdminUserDetailPayload | null> {
  const response = await apiClient.get(`/admin/users/${id}`);
  return normalizeAdminUserDetail(response.data);
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

type AdminUserDetailState = {
  loading: boolean;
  detail: AdminUserDetailPayload | null;
  error: string | null;
};

type AdminUserDetailViewModel =
  | { kind: "loading"; title: "User" }
  | { kind: "error"; title: "User"; message: string; retryLabel: "Retry" }
  | { kind: "ready"; detail: AdminUserDetailPayload };

export function buildAdminUserDetailViewModel(
  state: AdminUserDetailState,
): AdminUserDetailViewModel {
  if (state.loading) {
    return {
      kind: "loading",
      title: "User",
    };
  }

  if (state.error || !state.detail) {
    return {
      kind: "error",
      title: "User",
      message: state.error ?? "Unable to load user",
      retryLabel: "Retry",
    };
  }

  return {
    kind: "ready",
    detail: state.detail,
  };
}
