export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000/api";
export const WS_URL = import.meta.env.VITE_WS_URL ?? "http://127.0.0.1:3000";
export const PAGE_SIZE = 20;

/** Same Google key as server `GOOGLE_MAPS_API` for early integration. */
export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ||
  "";
