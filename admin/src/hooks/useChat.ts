import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/providers/api-client";
import {
  joinConversation,
  leaveConversation,
  sendAdminMessage,
  subscribeToMessages,
  subscribeToNewConversations,
  subscribeToBotTyping,
} from "@/providers/chat-ws";
import type { Conversation, ChatMessage, NewConversationEvent } from "@/types/chat";

export function useChatInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    apiClient
      .get<Conversation[]>("/chat/admin/conversations?status=open")
      .then((res) => setConversations(res.data));

    const unsub = subscribeToNewConversations((conv: NewConversationEvent) => {
      setConversations((prev) => [conv, ...prev]);
      setUnreadCount((n) => n + 1);
    });
    return unsub;
  }, []);

  const assignConversation = useCallback(async (id: number) => {
    await apiClient.patch(`/chat/conversations/${id}/assign`);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "assigned" as const } : c)),
    );
  }, []);

  const closeConversation = useCallback(async (id: number) => {
    await apiClient.patch(`/chat/conversations/${id}/close`);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "closed" as const } : c)),
    );
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return { conversations, unreadCount, assignConversation, closeConversation, clearUnread };
}

export function useConversationThread(conversationId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    setMessages([]);
    setIsBotTyping(false);

    const controller = new AbortController();
    apiClient
      .get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`, {
        signal: controller.signal,
      })
      .then((res) => setMessages(res.data))
      .catch(() => {
        // Silently ignore AbortError on cleanup; network errors leave the list empty.
      });

    joinConversation(conversationId);
    const unsubMsg = subscribeToMessages(conversationId, (msg) => {
      setMessages((prev) => [...prev, msg]);
      setIsBotTyping(false);
    });
    const unsubTyping = subscribeToBotTyping((id) => {
      if (id === conversationId) setIsBotTyping(true);
    });

    return () => {
      controller.abort();
      leaveConversation(conversationId);
      unsubMsg();
      unsubTyping();
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!conversationId || !content.trim()) return;
      sendAdminMessage(conversationId, content.trim());
    },
    [conversationId],
  );

  return { messages, isBotTyping, sendMessage };
}
