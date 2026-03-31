import axios from "axios";

import { API_URL } from "@/config/constants";

export const TOKEN_KEY = "grid_admin_token";

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});
