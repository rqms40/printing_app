import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";
import type { Notification } from "@/types/notification";

type NotificationCallback = (notif: Notification) => void;

let socket: Socket | null = null;
const listeners = new Set<NotificationCallback>();

function connectNotifications(): void {
  if (socket !== null) return; // already exists: connecting, connected, or reconnecting
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  socket = io(`${WS_URL}/ws/notifications`, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("newNotification", (notif: Notification) => {
    listeners.forEach((cb) => cb(notif));
  });

  socket.on("disconnect", () => {
    // auto-reconnects via reconnection: true
  });
}

export function disconnectNotifications(): void {
  socket?.disconnect();
  socket = null;
  listeners.clear();
}

export function subscribeToNotifications(
  cb: NotificationCallback,
): () => void {
  connectNotifications();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
