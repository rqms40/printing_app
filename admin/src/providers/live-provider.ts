import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";

type OrderUpdateCallback = (order: unknown) => void;

let socket: Socket | null = null;
const listeners = new Set<OrderUpdateCallback>();

function connectLive(): void {
  if (socket !== null) return; // already exists: connecting, connected, or reconnecting
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  socket = io(`${WS_URL}/ws/orders`, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("orderUpdate", (order: unknown) => {
    listeners.forEach((cb) => cb(order));
  });

  socket.on("disconnect", () => {
    // Socket auto-reconnects via reconnection: true
  });
}

export function disconnectLive(): void {
  socket?.disconnect();
  socket = null;
  listeners.clear();
}

export function subscribeToOrderUpdates(cb: OrderUpdateCallback): () => void {
  connectLive();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
