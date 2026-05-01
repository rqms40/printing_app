import { useState } from "react";
import { theme } from "antd";
import type { Conversation, ConversationStatus, ConversationType } from "@/types/chat";

const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

const STATUS_DOT: Record<ConversationStatus, string> = {
  open: "#FF4D4F",
  assigned: "#FA8C16",
  closed: "#52C41A",
};

const TYPE_LABEL: Record<string, string> = {
  ai: "AI",
  admin: "Admin",
  rider: "Rider",
};

const TYPE_COLORS: Record<ConversationType, { bg: string; text: string }> = {
  ai: { bg: "rgba(59,130,246,0.12)", text: "#93C5FD" },
  admin: { bg: "rgba(82,196,26,0.12)", text: "#86EFAC" },
  rider: { bg: "rgba(245,158,11,0.12)", text: "#FCD34D" },
};

function timeAgo(iso: string): string {
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (conv: Conversation) => void;
}

export function ConversationList({ conversations, activeId, onSelect }: Props) {
  const { token } = theme.useToken();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (conversations.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 120,
          color: token.colorTextDisabled,
          fontSize: 12,
          fontFamily: MONO,
          letterSpacing: "0.04em",
        }}
      >
        No conversations
      </div>
    );
  }

  return (
    <div>
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        const isHovered = conv.id === hoveredId && !isActive;
        const customerName = conv.customer?.name ?? `Customer #${conv.customerId}`;
        const dotColor = STATUS_DOT[conv.status] ?? token.colorTextSecondary;
        const typeColors = TYPE_COLORS[conv.type];

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "13px 20px",
              paddingLeft: isActive ? 17 : 20,
              borderLeft: isActive ? "3px solid #FFDE58" : "3px solid transparent",
              cursor: "pointer",
              background: isActive
                ? "rgba(255,255,255,0.06)"
                : isHovered
                ? "rgba(255,255,255,0.03)"
                : "transparent",
              borderBottom: `1px solid ${token.colorBorder}`,
              transition: "background 0.1s ease, border-left-color 0.1s ease",
              gap: 12,
            }}
          >
            {/* Status dot — aligned to first text line */}
            <div
              style={{
                marginTop: 4,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: dotColor,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${token.colorBgElevated}, 0 0 0 3.5px ${dotColor}44`,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Row 1: name + timestamp */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: token.colorText,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {customerName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: token.colorTextSecondary,
                    flexShrink: 0,
                    fontFamily: MONO,
                    letterSpacing: "0.03em",
                  }}
                >
                  {timeAgo(conv.updatedAt)}
                </span>
              </div>

              {/* Row 2: type badge + optional order ref */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: MONO,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: typeColors.text,
                    background: typeColors.bg,
                    padding: "2px 7px",
                    borderRadius: 4,
                  }}
                >
                  {TYPE_LABEL[conv.type] ?? conv.type}
                </span>
                {conv.orderId && (
                  <span
                    style={{
                      fontSize: 10,
                      color: token.colorTextSecondary,
                      fontFamily: MONO,
                      letterSpacing: "0.02em",
                    }}
                  >
                    #{conv.orderId}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
