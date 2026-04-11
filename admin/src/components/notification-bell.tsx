import { Badge, Button, Dropdown, Typography, theme } from "antd";
import { BellOutlined, CheckOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useNotificationsContext } from "@/context/notifications-context";
import type { Notification } from "@/types/notification";

const { Text } = Typography;

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  order_placed:    { color: "#4096ff", label: "Order" },
  order_cancelled: { color: "#ff4d4f", label: "Order" },
  order_declined:  { color: "#ff7875", label: "Order" },
  topup_request:   { color: "#FFDE58", label: "Top-up" },
  topup_approved:  { color: "#52c41a", label: "Credits" },
  topup_rejected:  { color: "#ff4d4f", label: "Credits" },
  new_user:        { color: "#b37feb", label: "User" },
  status_change:   { color: "#fa8c16", label: "Update" },
};

const MAX_VISIBLE = 5;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, clearNotifications } =
    useNotificationsContext();

  const latest = notifications.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, notifications.length - MAX_VISIBLE);

  const dropdownContent = (
    <div
      style={{
        width: 360,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 12,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,222,88,0.05)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "11px 12px 11px 16px",
          borderBottom: `1px solid ${token.colorBorder}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text strong style={{ fontSize: 13, letterSpacing: "0.01em" }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <span
              style={{
                background: "#FFDE58",
                color: "#141414",
                borderRadius: 10,
                padding: "0 7px",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "18px",
                display: "inline-block",
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          {unreadCount > 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined style={{ fontSize: 10 }} />}
              onClick={() => markAllRead()}
              style={{
                fontSize: 11,
                color: token.colorTextSecondary,
                padding: "0 8px",
                height: 26,
              }}
            >
              Mark all
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined style={{ fontSize: 10 }} />}
              onClick={() => clearNotifications()}
              style={{
                fontSize: 11,
                color: "#ff7875",
                padding: "0 8px",
                height: 26,
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Items ── */}
      {latest.length === 0 ? (
        <div
          style={{
            padding: "36px 16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
            }}
          >
            <BellOutlined
              style={{ fontSize: 18, color: token.colorTextSecondary }}
            />
          </div>
          <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
            You're all caught up
          </Text>
        </div>
      ) : (
        latest.map((n: Notification, i: number) => {
          const cfg = TYPE_CONFIG[n.type] ?? { color: "#8c8c8c", label: "Notice" };
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                padding: "10px 16px 10px 13px",
                cursor: "pointer",
                borderLeft: `3px solid ${n.isRead ? "transparent" : cfg.color}`,
                background: n.isRead ? "transparent" : `${cfg.color}0d`,
                borderBottom:
                  i < latest.length - 1
                    ? `1px solid ${token.colorBorderSecondary}`
                    : "none",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                transition: "background 0.15s",
              }}
            >
              {/* Type dot */}
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: cfg.color,
                  marginTop: 5,
                  flexShrink: 0,
                  opacity: n.isRead ? 0.3 : 1,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: n.isRead ? 400 : 600,
                    color: n.isRead ? token.colorTextSecondary : token.colorText,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {n.title}
                </div>

                {/* Message */}
                <div
                  style={{
                    fontSize: 11,
                    color: token.colorTextSecondary,
                    marginBottom: 5,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {n.message}
                </div>

                {/* Meta row: type tag + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: `${cfg.color}1f`,
                      color: cfg.color,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* ── Footer ── */}
      <div
        style={{
          padding: "9px 16px",
          borderTop: `1px solid ${token.colorBorder}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
          {overflow > 0
            ? `+${overflow} more notification${overflow > 1 ? "s" : ""}`
            : notifications.length > 0
            ? `${notifications.length} notification${notifications.length > 1 ? "s" : ""}`
            : ""}
        </Text>
        <Button
          type="link"
          size="small"
          style={{ fontSize: 12, padding: 0 }}
          onClick={() => navigate("/notifications")}
        >
          View all →
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
