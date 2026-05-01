import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/config/constants";
import { TOKEN_KEY } from "@/providers/api-client";
import type { ChatMessage, NewConversationEvent } from "@/types/chat";

type MessageCallback = (msg: ChatMessage) => void;
type NewConvCallback = (conv: NewConversationEvent) => void;
type BotTypingCallback = (conversationId: number) => void;

let socket: Socket | null = null;
const msgListeners = new Map<number, Set<MessageCallback>>();
const newConvListeners = new Set<NewConvCallback>();
const botTypingListeners = new Set<BotTypingCallback>();

function connectChat(): void {
  if (socket !== null) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  socket = io(`${WS_URL}/ws/chat`, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("message-received", (msg: ChatMessage) => {
    msgListeners.get(msg.conversationId)?.forEach((cb) => cb(msg));
  });
  socket.on("bot-response", (msg: ChatMessage) => {
    msgListeners.get(msg.conversationId)?.forEach((cb) => cb(msg));
  });
  socket.on("bot-typing", ({ conversationId }: { conversationId: number }) => {
    botTypingListeners.forEach((cb) => cb(conversationId));
  });
  socket.on("new-conversation", (conv: NewConversationEvent) => {
    newConvListeners.forEach((cb) => cb(conv));
  });
}

export function joinConversation(conversationId: number): void {
  connectChat();
  socket?.emit("join-conversation", { conversationId });
}

export function leaveConversation(conversationId: number): void {
  socket?.emit("leave-conversation", { conversationId });
  msgListeners.delete(conversationId);
}

export function sendAdminMessage(conversationId: number, content: string): void {
  connectChat();
  socket?.emit("send-message", { conversationId, content });
}

export function subscribeToMessages(
  conversationId: number,
  cb: MessageCallback,
): () => void {
  connectChat();
  if (!msgListeners.has(conversationId)) {
    msgListeners.set(conversationId, new Set());
  }
  msgListeners.get(conversationId)!.add(cb);
  return () => msgListeners.get(conversationId)?.delete(cb);
}

export function subscribeToNewConversations(cb: NewConvCallback): () => void {
  connectChat();
  newConvListeners.add(cb);
  return () => newConvListeners.delete(cb);
}

export function subscribeToBotTyping(cb: BotTypingCallback): () => void {
  connectChat();
  botTypingListeners.add(cb);
  return () => botTypingListeners.delete(cb);
}

export function disconnectChat(): void {
  socket?.disconnect();
  socket = null;
  msgListeners.clear();
  newConvListeners.clear();
  botTypingListeners.clear();
}
