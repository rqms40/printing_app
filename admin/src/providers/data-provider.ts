import dataProvider from "@refinedev/simple-rest";
import { API_URL } from "@/config/constants";
import { apiClient } from "@/providers/api-client";

export const gridDataProvider = dataProvider(API_URL, apiClient);
