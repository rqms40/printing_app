import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";

let socket: Socket | null = null;

export function connectDeliverySlotsWS(date: string): Socket {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";
  if (!socket) {
    socket = io(`${WS_URL}/ws/delivery-slots`, {
      transports: ["websocket"],
      auth: { token },
    });
  }
  socket.emit("subscribe-slots", { date });
  return socket;
}

export function disconnectDeliverySlotsWS(): void {
  socket?.disconnect();
  socket = null;
}
