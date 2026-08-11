import { useEffect, useRef, useState } from "react";
import { Button, Input, Tag, theme, Upload, Tooltip, App } from "antd";
import { SendOutlined, PaperClipOutlined } from "@ant-design/icons";
import { apiClient } from "@/providers/api-client";
import { useConversationThread } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { Conversation, ConversationStatus } from "@/types/chat";

const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

const STATUS_TAG: Record<ConversationStatus, { color: string; label: string }> = {
  open: { color: "error", label: "Open" },
  assigned: { color: "warning", label: "Assigned" },
  closed: { color: "success", label: "Closed" },
};

interface Props {
  conversation: Conversation | null;
  onAssign: () => void;
  onClose: () => void;
}

export function ChatThread({ conversation, onAssign, onClose }: Props) {
  const { token } = theme.useToken();
  const { messages, isBotTyping, sendMessage } = useConversationThread(
    conversation?.id ?? null,
  );
  const { message } = App.useApp();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isBotTyping]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    if (!conversation) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "general");

      const res = await apiClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      sendMessage("", data.id, data.mimeType);
      onSuccess?.(data);
    } catch (err) {
      console.error(err);
      onError?.(err as Error);
      void message.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  if (!conversation) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: token.colorBgContainer,
          color: token.colorTextDisabled,
          gap: 8,
        }}
      >
        <div style={{ fontSize: 32 }}>💬</div>
        <span
          style={{
            fontSize: 13,
            fontFamily: MONO,
            letterSpacing: "0.04em",
          }}
        >
          Select a conversation
        </span>
      </div>
    );
  }

  const statusCfg = STATUS_TAG[conversation.status] ?? { color: "default", label: conversation.status };
  const participantRole =
    conversation.participantRole ?? conversation.customer?.role ?? null;
  const isSupplier = participantRole === "supplier";
  const customerName =
    conversation.customer?.name ??
    conversation.customer?.fullName ??
    conversation.customer?.nickname ??
    (conversation.type === "rider"
      ? `Rider #${conversation.customerId}`
      : isSupplier
        ? `Supplier #${conversation.customerId}`
        : `Customer #${conversation.customerId}`);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: token.colorBgContainer,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          borderBottom: `1px solid ${token.colorBorder}`,
          flexShrink: 0,
          background: token.colorBgElevated,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: token.colorText,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {customerName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: token.colorTextSecondary,
              fontFamily: MONO,
              marginTop: 1,
            }}
          >
            {isSupplier
              ? "Supplier support"
              : conversation.type === "admin"
                ? "Human support"
                : conversation.type}
            {conversation.orderId ? ` · Order #${conversation.orderId}` : ""}
            {conversation.customer?.email
              ? ` · ${conversation.customer.email}`
              : ""}
          </div>
        </div>
        {isSupplier && <Tag color="purple">Supplier</Tag>}
        <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
        {conversation.status === "open" && (
          <Button size="small" type="primary" onClick={onAssign}>
            Assign to me
          </Button>
        )}
        {conversation.status !== "closed" && (
          <Button size="small" danger onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isBotTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          borderTop: `1px solid ${token.colorBorder}`,
          flexShrink: 0,
          alignItems: "center",
          background: token.colorBgElevated,
        }}
      >
        <Upload
          customRequest={handleUpload}
          showUploadList={false}
          disabled={uploading || conversation.status === "closed"}
          accept="image/*,.pdf,.doc,.docx"
        >
          <Tooltip title="Attach a file">
            <Button
              icon={<PaperClipOutlined />}
              type="text"
              loading={uploading}
              disabled={conversation.status === "closed"}
              style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
        </Upload>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ resize: "none", flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!text.trim()}
        />
      </div>
    </div>
  );
}
