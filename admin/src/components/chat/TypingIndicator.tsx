import { useEffect } from "react";

const KEYFRAMES = `
  @keyframes chatDotBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
    30% { transform: translateY(-6px); opacity: 1; }
  }
  .chat-dot { animation: chatDotBounce 1.2s ease-in-out infinite; }
  .chat-dot:nth-child(2) { animation-delay: 150ms; }
  .chat-dot:nth-child(3) { animation-delay: 300ms; }
`;

export function TypingIndicator() {
  useEffect(() => {
    if (document.getElementById("chat-typing-anim")) return;
    const s = document.createElement("style");
    s.id = "chat-typing-anim";
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "10px 14px",
          background: "#F5F5F5",
          borderRadius: "14px 14px 14px 4px",
          height: 36,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="chat-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#8C8C8C",
            }}
          />
        ))}
      </div>
    </div>
  );
}
