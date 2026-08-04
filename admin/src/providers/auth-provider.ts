import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";
import { normalizeIdentity } from "@/utils/api-normalizers";
import { disconnectLive } from "@/providers/live-provider";
import { disconnectNotifications } from "@/providers/notification-ws";
import { isAdminAppLoginRole, isSupplierRole } from "@/types/enums";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: { name: "Login Failed", message: "Invalid email or password" },
        };
      }

      const data = await response.json();

      // Ops Admin + Super Admin (+ legacy admin) and Supplier portal
      if (!isAdminAppLoginRole(data.user?.role)) {
        return {
          success: false,
          error: {
            name: "Login Failed",
            message: "Access denied. Admin or supplier accounts only.",
          },
        };
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      const redirectTo = isSupplierRole(data.user?.role)
        ? "/supplier/jobs"
        : "/";
      return { success: true, redirectTo };
    } catch {
      return {
        success: false,
        error: { name: "Login Failed", message: "Cannot reach server" },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    disconnectLive();
    disconnectNotifications();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }

    try {
      const response = await fetch(`${API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        return { authenticated: false, redirectTo: "/login" };
      }

      const user = await response.json();
      if (!isAdminAppLoginRole(user.role)) {
        localStorage.removeItem(TOKEN_KEY);
        return {
          authenticated: false,
          redirectTo: "/login",
          error: {
            name: "Forbidden",
            message: "Admin or supplier access only",
          },
        };
      }

      return { authenticated: true };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      return { authenticated: false, redirectTo: "/login" };
    }
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return normalizeIdentity(await response.json());
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
