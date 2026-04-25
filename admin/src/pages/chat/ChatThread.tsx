import { useEffect, useRef, useState } from "react";
import { Button, Input, Tag } from "antd";
import { SendOutlined } from "@ant-design/icons";
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
  const { messages, isBotTyping, sendMessage } = useConversationThread(
    conversation?.id ?? null,
  );
  const [text, setText] = useState("");
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

  if (!conversation) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAFA",
          color: "#BFBFBF",
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
  const customerName =
    conversation.customer?.name ?? `Customer #${conversation.customerId}`;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#FFFFFF",
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
          borderBottom: "1px solid #F0F0F0",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#1A1A1A",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {customerName}
          </div>
          {conversation.orderId && (
            <div
              style={{
                fontSize: 11,
                color: "#8C8C8C",
                fontFamily: MONO,
                marginTop: 1,
              }}
            >
              Order #{conversation.orderId}
            </div>
          )}
        </div>
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
          borderTop: "1px solid #F0F0F0",
          flexShrink: 0,
          alignItems: "flex-end",
        }}
      >
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
          style={{ background: "#1A1A1A", borderColor: "#1A1A1A" }}
        />
      </div>
    </div>
  );
}
