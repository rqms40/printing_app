import dataProvider from "@refinedev/simple-rest";
import axios from "axios";
import { API_URL } from "@/config/constants";

const TOKEN_KEY = "grid_admin_token";

const axiosInstance = axios.create();

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export const gridDataProvider = dataProvider(API_URL, axiosInstance);
