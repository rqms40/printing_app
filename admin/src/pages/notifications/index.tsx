import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "@refinedev/antd";
import {
  Typography,
  Button,
  Tabs,
  List as AntList,
  theme,
  Empty,
  Space,
} from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useNotificationsContext } from "@/context/notifications-context";
import type { Notification, NotificationType } from "@/types/notification";
import { MarketingSettings } from "./marketing-settings";
import { CustomStatusNotifications } from "./custom-status";

const { Text } = Typography;

const TYPE_ICON: Record<string, string> = {
  order_placed: "🛒",
  order_cancelled: "🛒",
  order_declined: "🛒",
  topup_request: "💳",
  topup_approved: "💳",
  topup_rejected: "💳",
  new_user: "👤",
  status_change: "🔄",
};

const CATEGORY_TYPES: Record<string, NotificationType[]> = {
  orders: ["order_placed", "order_cancelled", "order_declined", "status_change"],
  credits: ["topup_request", "topup_approved", "topup_rejected"],
  users: ["new_user"],
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function NotificationsPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsContext();
  const [activeTab, setActiveTab] = useState("all");

  // Mark all read after 1s on page visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (unreadCount > 0 && activeTab !== "marketing") markAllRead();
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered =
    activeTab === "all"
      ? notifications
      : activeTab === "unread"
        ? notifications.filter((n) => !n.isRead)
        : notifications.filter((n) =>
            CATEGORY_TYPES[activeTab]?.includes(n.type),
          );

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.orderRef) {
      const orderId = n.metadata?.orderId;
      if (orderId) navigate(`/orders/show/${orderId}`);
      else navigate("/orders");
    } else if (
      n.type === "topup_request" ||
      n.type === "topup_approved" ||
      n.type === "topup_rejected"
    ) {
      navigate("/credit-requests");
    }
  };

  const tabItems = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { key: "orders", label: "Orders" },
    { key: "credits", label: "Credits" },
    { key: "users", label: "Users" },
    { key: "marketing", label: "Marketing Settings" },
    { key: "custom-status", label: "Custom Status" },
  ];

  return (
    <List
      title="Notifications"
      headerButtons={
        unreadCount > 0 && activeTab !== "marketing" ? (
          <Button
            icon={<CheckOutlined />}
            onClick={() => markAllRead()}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 0 }}
        />

        {activeTab === "marketing" ? (
          <MarketingSettings />
        ) : activeTab === "custom-status" ? (
          <CustomStatusNotifications />
        ) : filtered.length === 0 ? (
          <Empty description="No notifications" style={{ marginTop: 48 }} />
        ) : (
          <AntList
            dataSource={filtered}
            renderItem={(n) => (
              <AntList.Item
                onClick={() => handleClick(n)}
                style={{
                  cursor: "pointer",
                  padding: "12px 16px",
                  borderLeft: n.isRead ? "none" : "3px solid #FFDE58",
                  background: n.isRead ? "transparent" : token.colorFillAlter,
                  marginBottom: 1,
                }}
              >
                <AntList.Item.Meta
                  avatar={
                    <span style={{ fontSize: 20 }}>
                      {TYPE_ICON[n.type] ?? "🔔"}
                    </span>
                  }
                  title={
                    <Text strong={!n.isRead} style={{ fontSize: 14 }}>
                      {n.title}
                    </Text>
                  }
                  description={
                    <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
                      {n.message}
                    </Text>
                  }
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: token.colorTextTertiary,
                    whiteSpace: "nowrap",
                    marginLeft: 12,
                  }}
                >
                  {timeAgo(n.createdAt)}
                </Text>
              </AntList.Item>
            )}
          />
        )}
      </Space>
    </List>
  );
}
