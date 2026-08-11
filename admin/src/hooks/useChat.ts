import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/providers/api-client";
import {
  joinConversation,
  leaveConversation,
  sendAdminMessage,
  subscribeToMessages,
  subscribeToNewConversations,
  subscribeToBotTyping,
} from "@/providers/chat-ws";
import type {
  Conversation,
  ChatMessage,
  NewConversationEvent,
} from "@/types/chat";

function normalizeNewConversationEvent(
  event: NewConversationEvent,
): Conversation {
  const now = new Date().toISOString();
  return {
    id: event.conversationId,
    customerId: event.customerId,
    customer: {
      id: event.customerId,
      name: event.customerName,
      email: "",
      role: event.participantRole ?? undefined,
    },
    participantRole: event.participantRole ?? null,
    type: event.type,
    orderId: event.orderId,
    assignedAdminId: null,
    assignedRiderId: null,
    status: "open",
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };
}

function mergeConversation(
  current: Conversation,
  updated: Conversation,
): Conversation {
  return {
    ...current,
    ...updated,
    customer: updated.customer ?? current.customer,
    participantRole:
      updated.participantRole ??
      updated.customer?.role ??
      current.participantRole ??
      current.customer?.role ??
      null,
  };
}

export function useChatInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    apiClient.get<Conversation[]>("/chat/admin/conversations").then((res) => {
      conversationsRef.current = res.data;
      setConversations(res.data);
    });

    const unsub = subscribeToNewConversations((event: NewConversationEvent) => {
      const conv = normalizeNewConversationEvent(event);
      setConversations((prev) => {
        const next = [conv, ...prev];
        conversationsRef.current = next;
        return next;
      });
      setUnreadCount((n) => n + 1);
    });
    return unsub;
  }, []);

  const assignConversation = useCallback(async (id: number) => {
    const res = await apiClient.patch<Conversation>(
      `/chat/conversations/${id}/assign`,
    );
    const existing = conversationsRef.current.find((c) => c.id === id);
    const merged = existing ? mergeConversation(existing, res.data) : res.data;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? mergeConversation(c, res.data) : c)),
    );
    conversationsRef.current = conversationsRef.current.map((c) =>
      c.id === id ? mergeConversation(c, res.data) : c,
    );
    return merged;
  }, []);

  const closeConversation = useCallback(async (id: number) => {
    const res = await apiClient.patch<Conversation>(
      `/chat/conversations/${id}/close`,
    );
    const existing = conversationsRef.current.find((c) => c.id === id);
    const merged = existing ? mergeConversation(existing, res.data) : res.data;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? mergeConversation(c, res.data) : c)),
    );
    conversationsRef.current = conversationsRef.current.map((c) =>
      c.id === id ? mergeConversation(c, res.data) : c,
    );
    return merged;
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const startDirectConversation = useCallback(async (userId: number) => {
    const res = await apiClient.post<Conversation>(
      `/chat/admin/conversations/direct/${userId}`,
    );
    // Let the websocket or the next fetch update the list, just return the conversation.
    return res.data;
  }, []);

  return {
    conversations,
    unreadCount,
    assignConversation,
    closeConversation,
    startDirectConversation,
    clearUnread,
  };
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
