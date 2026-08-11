import { useEffect, useState } from "react";
import { theme, Image as AntImage } from "antd";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/providers/api-client";
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

type Align = "flex-end" | "flex-start";

interface RoleConfig {
  align: Align;
  bg: string;
  color: string;
  label: string | null;
  borderRadius: string;
  border?: string;
  shadow: string;
}

function useRoleConfigs(): Record<SenderRole, RoleConfig> {
  const { token } = theme.useToken();

  return {
    admin: {
      align: "flex-end",
      bg: "#FFDE58",
      color: "#141414",
      label: null,
      borderRadius: "14px 14px 4px 14px",
      shadow: "0 2px 10px rgba(255,222,88,0.18)",
    },
    customer: {
      align: "flex-start",
      bg: token.colorBgElevated,
      color: token.colorText,
      label: null,
      borderRadius: "14px 14px 14px 4px",
      shadow: `0 1px 4px rgba(0,0,0,0.24)`,
    },
    bot: {
      align: "flex-start",
      bg: "rgba(59, 130, 246, 0.1)",
      color: "#93C5FD",
      label: "🤖 GridBot",
      borderRadius: "14px 14px 14px 4px",
      border: "1.5px solid rgba(59,130,246,0.3)",
      shadow: "0 1px 6px rgba(59,130,246,0.12)",
    },
    rider: {
      align: "flex-start",
      bg: "rgba(245, 158, 11, 0.1)",
      color: "#FCD34D",
      label: "🚴 Rider",
      borderRadius: "14px 14px 14px 4px",
      border: "1.5px solid rgba(245,158,11,0.3)",
      shadow: "0 1px 4px rgba(0,0,0,0.12)",
    },
  };
}

function ImageAttachment({ fileId, accentBg }: { fileId: number; accentBg: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get(`/files/${fileId}/presigned-url`)
      .then((r) => {
        if (mounted) setUrl((r.data?.url as string) ?? null);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, [fileId]);

  if (error) {
    return (
      <div
        style={{
          width: 220,
          height: 150,
          background: accentBg,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontSize: 12,
          fontFamily: MONO,
        }}
      >
        Image unavailable
      </div>
    );
  }

  if (!url) {
    return (
      <div
        style={{
          width: 220,
          height: 150,
          background: accentBg,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          fontFamily: MONO,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <AntImage
      src={url}
      style={{
        maxWidth: "100%",
        maxHeight: 280,
        borderRadius: 10,
        objectFit: "cover",
        display: "block",
      }}
      preview={{ mask: false }}
    />
  );
}

function MarkdownContent({
  text,
  textColor,
  accentColor,
  codeBg,
}: {
  text: string;
  textColor: string;
  accentColor: string;
  codeBg: string;
}) {
  return (
    <div
      style={{
        color: textColor,
        fontSize: 14,
        lineHeight: 1.55,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 6px 0" }}>{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{
                color: accentColor,
                textDecoration: "underline",
                textDecorationColor: `${accentColor}80`,
              }}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  style={{
                    background: codeBg,
                    color: textColor,
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: MONO,
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                style={{
                  display: "block",
                  background: codeBg,
                  color: textColor,
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: MONO,
                  overflow: "auto",
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre style={{ margin: "6px 0", padding: 0, background: "transparent" }}>
              {children}
            </pre>
          ),
          h1: ({ children }) => (
            <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0 4px" }}>
              {children}
            </div>
          ),
          h2: ({ children }) => (
            <div style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 4px" }}>
              {children}
            </div>
          ),
          h3: ({ children }) => (
            <div style={{ fontSize: 15, fontWeight: 700, margin: "6px 0 3px" }}>
              {children}
            </div>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "4px 0", paddingLeft: 20 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: 2 }}>{children}</li>
          ),
          blockquote: ({ children }) => (
            <div
              style={{
                borderLeft: `3px solid ${textColor}40`,
                paddingLeft: 10,
                margin: "4px 0",
                color: `${textColor}D9`,
                fontStyle: "italic",
              }}
            >
              {children}
            </div>
          ),
          hr: () => (
            <hr
              style={{
                border: "none",
                borderTop: `1px solid ${textColor}33`,
                margin: "8px 0",
              }}
            />
          ),
          table: ({ children }) => (
            <table
              style={{
                borderCollapse: "collapse",
                margin: "6px 0",
                fontSize: 13,
              }}
            >
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: `1px solid ${textColor}33`,
                padding: "4px 8px",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                border: `1px solid ${textColor}33`,
                padding: "4px 8px",
              }}
            >
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function MessageBubble({
  message,
  /** When true, participant (customer/supplier) messages are right-aligned. */
  viewerIsParticipant = false,
}: {
  message: ChatMessage;
  viewerIsParticipant?: boolean;
}) {
  const { token } = theme.useToken();
  const roleConfigs = useRoleConfigs();
  const baseCfg = roleConfigs[message.senderRole] ?? roleConfigs.customer;

  // From the participant's view, own messages (customer) should sit on the right
  // and admin replies on the left — opposite of the ops inbox.
  let cfg = baseCfg;
  if (viewerIsParticipant) {
    if (message.senderRole === "customer") {
      cfg = {
        ...baseCfg,
        align: "flex-end",
        bg: "#FFDE58",
        color: "#141414",
        borderRadius: "14px 14px 4px 14px",
        shadow: "0 2px 10px rgba(255,222,88,0.18)",
      };
    } else if (message.senderRole === "admin") {
      cfg = {
        ...baseCfg,
        align: "flex-start",
        bg: token.colorBgElevated,
        color: token.colorText,
        borderRadius: "14px 14px 14px 4px",
        label: "GRIDGO Support",
      };
    }
  }

  const hasImage =
    message.attachmentFileId != null &&
    (message.attachmentMimeType?.startsWith("image/") ?? false);
  const hasContent = (message.content ?? "").trim().length > 0;
  const imageOnly = hasImage && !hasContent;
  const shouldRenderMarkdown =
    message.senderRole === "bot" || message.senderRole === "admin";

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
            color: token.colorTextSecondary,
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
          padding: imageOnly ? 4 : "10px 14px",
          background: cfg.bg,
          color: cfg.color,
          borderRadius: cfg.borderRadius,
          border: cfg.border ?? "none",
          fontSize: 14,
          lineHeight: 1.55,
          wordBreak: "break-word",
          boxShadow: cfg.shadow,
          display: "flex",
          flexDirection: "column",
          gap: hasImage && hasContent ? 8 : 0,
        }}
      >
        {hasImage && (
          <ImageAttachment
            fileId={message.attachmentFileId!}
            accentBg={token.colorBgElevated}
          />
        )}
        {hasContent && (
          shouldRenderMarkdown ? (
            <MarkdownContent
              text={message.content!}
              textColor={cfg.color}
              accentColor={
                message.senderRole === "admin" ? "#141414" : token.colorPrimary
              }
              codeBg={
                message.senderRole === "admin"
                  ? "rgba(0,0,0,0.12)"
                  : "rgba(0,0,0,0.35)"
              }
            />
          ) : (
            <div>{message.content}</div>
          )
        )}
      </div>
      <span
        style={{
          fontSize: 10,
          color: token.colorTextTertiary,
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
