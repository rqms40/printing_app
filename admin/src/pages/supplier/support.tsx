/**
 * Supplier portal — Support chat with GRIDGO ops / superadmin, and direct chat with Clients.
 * Opens (or resumes) a direct conversation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  App,
  Button,
  Input,
  Spin,
  Tag,
  Typography,
  theme,
  List as AntList,
  Upload,
  Tooltip,
} from "antd";
import {
  CustomerServiceOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
  PaperClipOutlined,
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiClient.get<Conversation[]>("/chat/conversations");
      const list = res.data || [];
      // If there's no ADMIN conversation in the list, we might need to create it
      if (!list.some(c => c.type === 'admin')) {
         const supportRes = await apiClient.post<Conversation>("/chat/support");
         list.unshift(supportRes.data);
      }
      setConversations(list);

      const targetIdStr = searchParams.get("conversationId");
      if (targetIdStr) {
        const target = list.find((c) => c.id === Number(targetIdStr));
        if (target) {
          setActiveConv(target);
        } else {
          setActiveConv(list[0]);
        }
      } else if (list.length > 0) {
        setActiveConv(list[0]);
      }
    } catch {
      void message.error("Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  }, [message, searchParams]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Handle URL change or manual click
  const selectConversation = (conv: Conversation) => {
    setSearchParams({ conversationId: String(conv.id) });
    setActiveConv(conv);
  };

  useEffect(() => {
    if (!activeConv) return;
    let isSubscribed = true;

    const loadChat = async () => {
      setLoadingChat(true);
      try {
        const msgRes = await apiClient.get<ChatMessage[]>(
          `/chat/conversations/${activeConv.id}/messages`,
        );
        if (isSubscribed) {
          setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
          joinConversation(activeConv.id);
        }
      } catch {
        if (isSubscribed) void message.error("Could not load messages");
      } finally {
        if (isSubscribed) setLoadingChat(false);
      }
    };

    void loadChat();

    const unsub = subscribeToMessages(activeConv.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      isSubscribed = false;
      unsub();
      leaveConversation(activeConv.id);
    };
  }, [activeConv, message]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !activeConv || sending) return;
    setSending(true);
    try {
      sendAdminMessage(activeConv.id, trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    if (!activeConv) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "general");

      const res = await apiClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      sendAdminMessage(activeConv.id, "", data.id, data.mimeType);
      onSuccess?.(data);
    } catch (err) {
      console.error(err);
      onError?.(err as Error);
      void message.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <List
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MessageOutlined />
          Messages
        </span>
      }
      headerButtons={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void loadConversations()}
          loading={loadingList}
        >
          Refresh
        </Button>
      }
    >
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 200px)",
          minHeight: 420,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Left Sidebar */}
        <div style={{ width: 280, borderRight: `1px solid ${token.colorBorder}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px", borderBottom: `1px solid ${token.colorBorder}` }}>
            <Title level={5} style={{ margin: 0 }}>Inbox</Title>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ padding: 24, textAlign: "center" }}><Spin /></div>
            ) : (
              <AntList
                dataSource={conversations}
                renderItem={(conv) => {
                  const isActive = activeConv?.id === conv.id;
                  const isOps = conv.type === 'admin';
                  return (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      style={{
                        padding: "12px 16px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        background: isActive ? token.colorInfoBg : "transparent",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text strong style={{ color: isActive ? token.colorPrimary : token.colorText }}>
                          {isOps ? "GRIDGO Ops Support" : `Order #${conv.orderId}`}
                        </Text>
                        {isOps ? (
                          <CustomerServiceOutlined style={{ color: token.colorPrimary }} />
                        ) : (
                          <Tag color="blue" style={{ margin: 0 }}>Client</Tag>
                        )}
                      </div>
                      {!isOps && conv.customer && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {conv.customer.fullName || conv.customer.email}
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>

        {/* Right Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {activeConv ? (
            <>
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${token.colorBorder}`,
                  background: token.colorBgElevated,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Title level={5} style={{ margin: 0, color: token.colorText }}>
                    {activeConv.type === 'admin' ? "GRIDGO Ops Support" : `Client Chat (Order #${activeConv.orderId})`}
                  </Title>
                  <Tag color={activeConv.type === 'admin' ? "purple" : "blue"}>
                    {activeConv.type === 'admin' ? "Supplier" : "Client"}
                  </Tag>
                  {activeConv.status && (
                    <Tag
                      color={
                        activeConv.status === "closed"
                          ? "default"
                          : activeConv.status === "assigned"
                            ? "orange"
                            : "green"
                      }
                    >
                      {activeConv.status}
                    </Tag>
                  )}
                </div>
                <Paragraph
                  type="secondary"
                  style={{ margin: "6px 0 0", fontSize: 12 }}
                >
                  {activeConv.type === 'admin' 
                    ? "Message ops or superadmin about jobs, payouts, or account issues." 
                    : "Message the client directly regarding their order requirements or pickup."}
                </Paragraph>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px 18px",
                }}
              >
                {loadingChat ? (
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
                      No messages yet. Say hello!
                    </Text>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      viewerRole="supplier"
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
                  alignItems: "center",
                }}
              >
                <Upload
                  customRequest={handleUpload}
                  showUploadList={false}
                  disabled={uploading || activeConv.status === "closed"}
                  accept="image/*,.pdf,.doc,.docx"
                >
                  <Tooltip title="Attach a file">
                    <Button
                      icon={<PaperClipOutlined />}
                      type="text"
                      loading={uploading}
                      disabled={loadingChat || activeConv.status === "closed"}
                      style={{ color: token.colorTextSecondary }}
                    />
                  </Tooltip>
                </Upload>
                <Input.TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    activeConv.status === "closed"
                      ? "This conversation is closed."
                      : "Type your message…"
                  }
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={loadingChat || activeConv.status === "closed"}
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
                    loadingChat ||
                    !text.trim() ||
                    activeConv.status === "closed"
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
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <MessageOutlined style={{ fontSize: 48, color: token.colorTextTertiary, marginBottom: 16 }} />
              <Text type="secondary">Select a conversation to start messaging</Text>
            </div>
          )}
        </div>
      </div>
    </List>
  );
}
