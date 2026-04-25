import type { ChatMessage, SenderRole } from "@/types/chat";

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

interface RoleConfig {
  align: "flex-end" | "flex-start";
  bg: string;
  color: string;
  label: string | null;
  borderRadius: string;
  border?: string;
  shadow: string;
}

const ROLE_CONFIG: Record<SenderRole, RoleConfig> = {
  admin: {
    align: "flex-end",
    bg: "#1A1A1A",
    color: "#FFFFFF",
    label: null,
    borderRadius: "14px 14px 4px 14px",
    shadow: "0 2px 10px rgba(0,0,0,0.18)",
  },
  customer: {
    align: "flex-start",
    bg: "#F5F5F5",
    color: "#1A1A1A",
    label: null,
    borderRadius: "14px 14px 14px 4px",
    shadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  bot: {
    align: "flex-start",
    bg: "#EFF6FF",
    color: "#1E3A5F",
    label: "🤖 GridBot",
    borderRadius: "14px 14px 14px 4px",
    border: "1.5px solid #BFDBFE",
    shadow: "0 1px 6px rgba(59,130,246,0.08)",
  },
  rider: {
    align: "flex-start",
    bg: "#FFF9EC",
    color: "#92400E",
    label: "🚴 Rider",
    borderRadius: "14px 14px 14px 4px",
    border: "1.5px solid #FDE68A",
    shadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const cfg = ROLE_CONFIG[message.senderRole];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: cfg.align,
        marginBottom: 14,
      }}
    >
      {cfg.label && (
        <span
          style={{
            fontSize: 10,
            color: "#8C8C8C",
            marginBottom: 5,
            fontFamily: MONO,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {cfg.label}
        </span>
      )}
      <div
        style={{
          maxWidth: "70%",
          padding: "10px 14px",
          background: cfg.bg,
          color: cfg.color,
          borderRadius: cfg.borderRadius,
          border: cfg.border ?? "none",
          fontSize: 14,
          lineHeight: 1.55,
          wordBreak: "break-word",
          boxShadow: cfg.shadow,
        }}
      >
        {message.content}
      </div>
      <span
        style={{
          fontSize: 10,
          color: "#BFBFBF",
          marginTop: 4,
          fontFamily: MONO,
          letterSpacing: "0.04em",
        }}
      >
        {formatTime(message.createdAt)}
      </span>
    </div>
  );
}
