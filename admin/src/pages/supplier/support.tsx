/**
 * Supplier portal — Support chat with GRIDGO ops / superadmin.
 * Opens (or resumes) a direct admin conversation; messages land in
 * admin Live Chat / Support with a Supplier badge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  App,
  Button,
  Input,
  Spin,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  CustomerServiceOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { List } from "@refinedev/antd";
import { apiClient } from "@/providers/api-client";
import {
  joinConversation,
  leaveConversation,
  sendAdminMessage,
  subscribeToMessages,
} from "@/providers/chat-ws";
import type { ChatMessage, Conversation } from "@/types/chat";
import { MessageBubble } from "@/components/chat/MessageBubble";

const { Text, Title, Paragraph } = Typography;

export function SupplierSupportPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const convRes = await apiClient.post<Conversation>("/chat/support");
      const conv = convRes.data;
      setConversation(conv);

      const msgRes = await apiClient.get<ChatMessage[]>(
        `/chat/conversations/${conv.id}/messages`,
      );
      setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);

      joinConversation(conv.id);
    } catch {
      void message.error("Could not open support chat. Try again.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!conversation) return;
    const unsub = subscribeToMessages(conversation.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      unsub();
      leaveConversation(conversation.id);
    };
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !conversation || sending) return;
    setSending(true);
    try {
      sendAdminMessage(conversation.id, trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <List
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CustomerServiceOutlined />
          Support
        </span>
      }
      headerButtons={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void loadThread()}
          loading={loading}
        >
          Refresh
        </Button>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 200px)",
          minHeight: 420,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${token.colorBorder}`,
            background: token.colorBgElevated,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Title level={5} style={{ margin: 0, color: token.colorText }}>
              GRIDGO Ops Support
            </Title>
            <Tag color="purple">Supplier</Tag>
            {conversation?.status && (
              <Tag
                color={
                  conversation.status === "closed"
                    ? "default"
                    : conversation.status === "assigned"
                      ? "orange"
                      : "green"
                }
              >
                {conversation.status}
              </Tag>
            )}
          </div>
          <Paragraph
            type="secondary"
            style={{ margin: "6px 0 0", fontSize: 12 }}
          >
            Message ops or superadmin about jobs, payouts, or account issues.
            Your inquiry appears in the Support inbox.
          </Paragraph>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px",
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: 48,
              }}
            >
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: token.colorTextSecondary,
                padding: "48px 16px",
              }}
            >
              <Text type="secondary">
                No messages yet. Say hello and describe how we can help.
              </Text>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                viewerIsParticipant
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderTop: `1px solid ${token.colorBorder}`,
            background: token.colorBgElevated,
          }}
        >
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              conversation?.status === "closed"
                ? "This conversation is closed — open support again to start a new one"
                : "Type your message to GRIDGO support…"
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading || conversation?.status === "closed"}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={
              loading ||
              !text.trim() ||
              conversation?.status === "closed"
            }
            style={{
              background: "#FFDE58",
              borderColor: "#FFDE58",
              color: "#141414",
              fontWeight: 600,
            }}
          >
            Send
          </Button>
        </div>
      </div>
    </List>
  );
}
