import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout, Tabs, theme } from "antd";
import { useChatInbox } from "@/hooks/useChat";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatThread } from "./ChatThread";
import type { Conversation } from "@/types/chat";

const { Sider, Content } = Layout;

type FilterKey = "all" | "open" | "mine" | "closed";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "closed", label: "Closed" },
];

export function ChatInboxPage() {
  const { token } = theme.useToken();
  const { conversations, assignConversation, closeConversation, clearUnread } =
    useChatInbox();
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "open":
        return conversations.filter((c) => c.status === "open");
      case "mine":
        return conversations.filter((c) => c.assignedAdminId !== null);
      case "closed":
        return conversations.filter((c) => c.status === "closed");
      default:
        return conversations;
    }
  }, [conversations, filter]);

  const handleAssign = useCallback(async () => {
    if (!activeConversation) return;
    const updated = await assignConversation(activeConversation.id);
    setActiveConversation(updated);
  }, [activeConversation, assignConversation]);

  const handleClose = useCallback(async () => {
    if (!activeConversation) return;
    const updated = await closeConversation(activeConversation.id);
    setActiveConversation(updated);
  }, [activeConversation, closeConversation]);

  return (
    <Layout
      style={{
        height: "calc(100vh - 64px)",
        margin: -24,
        overflow: "hidden",
        background: token.colorBgContainer,
      }}
    >
      <Sider
        width={300}
        style={{
          background: token.colorBgElevated,
          borderRight: `1px solid ${token.colorBorder}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: "100%",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 0", flexShrink: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.01em",
              color: token.colorText,
            }}
          >
            Support Chat
            {conversations.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                  background: token.colorBgTextHover,
                  padding: "1px 7px",
                  borderRadius: 10,
                  verticalAlign: "middle",
                }}
              >
                {conversations.length}
              </span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <Tabs
          activeKey={filter}
          onChange={(key) => setFilter(key as FilterKey)}
          size="small"
          style={{ padding: "6px 20px 0", flexShrink: 0 }}
          tabBarStyle={{ marginBottom: 0, borderBottom: `1px solid ${token.colorBorder}` }}
          items={FILTER_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ConversationList
            conversations={filtered}
            activeId={activeConversation?.id ?? null}
            onSelect={setActiveConversation}
          />
        </div>
      </Sider>
      <Content
        style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}
      >
        <ChatThread
          conversation={activeConversation}
          onAssign={handleAssign}
          onClose={handleClose}
        />
      </Content>
    </Layout>
  );
}
