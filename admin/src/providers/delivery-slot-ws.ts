import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";

let socket: Socket | null = null;
const subscribedDates = new Set<string>();

/// Connect (or reuse) the singleton socket and subscribe to a single date
/// room. Subsequent calls with a different date unsubscribe from previously
/// joined rooms so the page only receives updates for the date currently
/// being viewed. Idempotent for the same date.
export function connectDeliverySlotsWS(date: string): Socket {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";
  if (!socket) {
    socket = io(`${WS_URL}/ws/delivery-slots`, {
      transports: ["websocket"],
      auth: { token },
    });
  }
  // Drop stale subscriptions before adding the new one.
  for (const old of subscribedDates) {
    if (old !== date) {
      socket.emit("unsubscribe-slots", { date: old });
      subscribedDates.delete(old);
    }
  }
  if (!subscribedDates.has(date)) {
    socket.emit("subscribe-slots", { date });
    subscribedDates.add(date);
  }
  return socket;
}

export function disconnectDeliverySlotsWS(): void {
  if (socket) {
    for (const d of subscribedDates) {
      socket.emit("unsubscribe-slots", { date: d });
    }
  }
  subscribedDates.clear();
  socket?.disconnect();
  socket = null;
}
