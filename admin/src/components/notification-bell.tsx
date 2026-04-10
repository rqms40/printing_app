import { Badge, Button, Dropdown, Typography, theme } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useNotificationsContext } from "@/context/notifications-context";
import type { Notification } from "@/types/notification";

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function NotificationBell() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsContext();

  const latest = notifications.slice(0, 10);

  const dropdownContent = (
    <div
      style={{
        width: 340,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
        }}
      >
        <Text strong>Notifications</Text>
        <Button type="link" size="small" onClick={() => markAllRead()}>
          Mark all ✓
        </Button>
      </div>

      {/* Items */}
      {latest.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: token.colorTextSecondary,
          }}
        >
          <BellOutlined style={{ fontSize: 24, marginBottom: 8, display: "block" }} />
          <span>You're all caught up</span>
        </div>
      ) : (
        latest.map((n: Notification) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            style={{
              padding: "10px 16px",
              cursor: "pointer",
              borderLeft: n.isRead ? "none" : "3px solid #FFDE58",
              background: n.isRead ? "transparent" : token.colorFillAlter,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span>{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: n.isRead ? 400 : 600,
                    display: "block",
                  }}
                >
                  {n.title}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: token.colorTextSecondary,
                  }}
                >
                  {n.orderRef ? `${n.orderRef} · ` : ""}
                  {timeAgo(n.createdAt)}
                </Text>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: `1px solid ${token.colorBorder}`,
          textAlign: "center",
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={() => navigate("/notifications")}
        >
          View all notifications →
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
    >
      <Badge
        count={unreadCount}
        overflowCount={99}
        style={{ backgroundColor: "#FFDE58", color: "#141414", cursor: "pointer" }}
      >
        <BellOutlined
          data-testid="notification-bell"
          style={{ fontSize: 18, cursor: "pointer" }}
        />
      </Badge>
    </Dropdown>
  );
}
