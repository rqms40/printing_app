import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout, Tabs } from "antd";
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
    await assignConversation(activeConversation.id);
    setActiveConversation((prev) =>
      prev ? { ...prev, status: "assigned" } : null,
    );
  }, [activeConversation, assignConversation]);

  const handleClose = useCallback(async () => {
    if (!activeConversation) return;
    await closeConversation(activeConversation.id);
    setActiveConversation((prev) =>
      prev ? { ...prev, status: "closed" } : null,
    );
  }, [activeConversation, closeConversation]);

  return (
    <Layout style={{ height: "100vh", background: "#FFFFFF" }}>
      <Sider
        width={320}
        style={{
          background: "#FAFAFA",
          borderRight: "1px solid #F0F0F0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 16px 0",
            fontWeight: 700,
            fontSize: 16,
            color: "#1A1A1A",
            borderBottom: "1px solid #F0F0F0",
          }}
        >
          Support Chat
        </div>
        <Tabs
          activeKey={filter}
          onChange={(key) => setFilter(key as FilterKey)}
          size="small"
          style={{ padding: "0 16px" }}
          items={FILTER_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
        <div style={{ flex: 1, overflow: "auto" }}>
          <ConversationList
            conversations={filtered}
            activeId={activeConversation?.id ?? null}
            onSelect={setActiveConversation}
          />
        </div>
      </Sider>
      <Content
        style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
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
