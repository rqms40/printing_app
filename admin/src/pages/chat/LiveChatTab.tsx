import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout, Tabs, theme } from "antd";
import { useChatInbox } from "@/hooks/useChat";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatThread } from "./ChatThread";
import type { Conversation } from "@/types/chat";

const { Sider, Content } = Layout;

type FilterKey = "all" | "open" | "suppliers" | "mine" | "closed";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "suppliers", label: "Suppliers" },
  { key: "mine", label: "Mine" },
  { key: "closed", label: "Closed" },
];

function isSupplierConversation(c: Conversation): boolean {
  return (c.participantRole ?? c.customer?.role) === "supplier";
}

export function LiveChatTab() {
  const { token } = theme.useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, assignConversation, closeConversation, clearUnread } =
    useChatInbox();
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  useEffect(() => {
    const convIdParam = searchParams.get("convId");
    if (convIdParam && conversations.length > 0) {
      const targetId = parseInt(convIdParam, 10);
      const targetConv = conversations.find((c) => c.id === targetId);
      if (targetConv) {
        setActiveConversation(targetConv);
        // Clear param so it doesn't get stuck if they click another chat
        setSearchParams(new URLSearchParams(), { replace: true });
      }
    }
  }, [searchParams, conversations, setSearchParams]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "open":
        return conversations.filter((c) => c.status === "open");
      case "suppliers":
        return conversations.filter((c) => isSupplierConversation(c));
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
        height: "100%",
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
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            <ConversationList
              conversations={filtered}
              activeId={activeConversation?.id ?? null}
              onSelect={setActiveConversation}
            />
          </div>
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
