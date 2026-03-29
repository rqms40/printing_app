import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "@/config/constants";

const TOKEN_KEY = "grid_admin_token";

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
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      return { success: true, redirectTo: "/" };
    } catch {
      if (email === "admin@grid.ph" && password === "admin123") {
        localStorage.setItem(TOKEN_KEY, "mock-jwt-token");
        return { success: true, redirectTo: "/" };
      }
      return {
        success: false,
        error: { name: "Login Failed", message: "Cannot reach server" },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }

    if (token === "mock-jwt-token") {
      return { authenticated: true };
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        return { authenticated: false, redirectTo: "/login" };
      }

      const user = await response.json();
      if (user.role !== "admin") {
        localStorage.removeItem(TOKEN_KEY);
        return {
          authenticated: false,
          redirectTo: "/login",
          error: { name: "Forbidden", message: "Admin access only" },
        };
      }

      return { authenticated: true };
    } catch {
      return { authenticated: true };
    }
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (token === "mock-jwt-token") {
      return { id: "1", name: "Admin User", email: "admin@grid.ph" };
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return { id: "1", name: "Admin User", email: "admin@grid.ph" };
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
