import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { apiClient } from "@/providers/api-client";
import { subscribeToNotifications } from "@/providers/notification-ws";
import type { Notification, BadgeCounts } from "@/types/notification";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  badgeCounts: BadgeCounts;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  refreshBadges: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    newOrders: 0,
    pendingTopUps: 0,
  });

  const refreshBadges = useCallback(async () => {
    try {
      const res = await apiClient.get<BadgeCounts>("/admin/badge-counts");
      setBadgeCounts(res.data);
    } catch {
      // Supplier / non-ops roles may not have badge access — keep zeros.
    }
  }, []);

  // Initial fetch (soft-fail: suppliers use this shell without ops badges)
  useEffect(() => {
    apiClient
      .get<Notification[]>("/notifications")
      .then((res) => setNotifications(res.data))
      .catch(() => undefined);

    apiClient
      .get<number>("/notifications/unread-count")
      .then((res) => setUnreadCount(res.data))
      .catch(() => undefined);

    void refreshBadges();
  }, [refreshBadges]);

  // WS subscription
  useEffect(() => {
    const audio = new Audio('/audio/notification_user.mp3');
    const unsub = subscribeToNotifications((notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      setUnreadCount((n) => n + 1);
      refreshBadges();
      audio.play().catch((e) => console.error('Audio playback failed', e));
    });
    return unsub;
  }, [refreshBadges]);

  const markRead = useCallback(async (id: number) => {
    await apiClient.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((n) => Math.max(0, n - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiClient.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(async () => {
    try {
      await apiClient.patch("/notifications/read-all");
    } catch {
      // best-effort — clear the UI regardless
    }
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        badgeCounts,
        markRead,
        markAllRead,
        clearNotifications,
        refreshBadges,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx)
    throw new Error(
      "useNotificationsContext must be used within NotificationsProvider",
    );
  return ctx;
}
