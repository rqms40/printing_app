import type { Conversation, ConversationStatus } from "@/types/chat";

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
  if (conversations.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 120,
          color: "#BFBFBF",
          fontSize: 13,
          fontFamily: MONO,
          letterSpacing: "0.04em",
        }}
      >
        No conversations
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        const customerName = conv.customer?.name ?? `Customer #${conv.customerId}`;

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              height: 64,
              cursor: "pointer",
              background: isActive ? "#FFDE58" : "transparent",
              borderBottom: "1px solid #F0F0F0",
              transition: "background 0.12s ease",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: STATUS_DOT[conv.status] ?? "#8C8C8C",
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${isActive ? "rgba(0,0,0,0.08)" : "#fff"}, 0 0 0 3px ${STATUS_DOT[conv.status] ?? "#8C8C8C"}22`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#1A1A1A",
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
                    color: isActive ? "#595959" : "#8C8C8C",
                    flexShrink: 0,
                    fontFamily: MONO,
                    letterSpacing: "0.04em",
                  }}
                >
                  {timeAgo(conv.updatedAt)}
                </span>
              </div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: isActive ? "#1A1A1A" : "#595959",
                  background: isActive ? "rgba(0,0,0,0.1)" : "#F0F0F0",
                  padding: "1px 6px",
                  borderRadius: 3,
                  marginTop: 3,
                  fontFamily: MONO,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {TYPE_LABEL[conv.type] ?? conv.type}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
