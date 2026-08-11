import { Tabs, theme } from "antd";
import { LiveChatTab } from "./LiveChatTab";
import { TicketList } from "./TicketList";

export function ChatInboxPage() {
  const { token } = theme.useToken();

  return (
    <div style={{ 
      height: "calc(100vh - 64px)", 
      margin: -24, 
      background: token.colorBgContainer, 
      display: "flex", 
      flexDirection: "column",
      overflow: "hidden"
    }}>
      <Tabs
        defaultActiveKey="1"
        tabBarStyle={{ padding: "16px 24px 0", marginBottom: 0, borderBottom: `1px solid ${token.colorBorder}` }}
        items={[
          {
            key: "1",
            label: "Live Chat / Support",
            children: <div style={{ height: "calc(100vh - 64px - 60px)" }}><LiveChatTab /></div>,
          },
          {
            key: "2",
            label: "Web Support Tickets",
            children: <div style={{ height: "calc(100vh - 64px - 60px)" }}><TicketList /></div>,
          },
        ]}
      />
    </div>
  );
}
