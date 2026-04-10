import { useGetIdentity, useLogout } from "@refinedev/core";
import { Layout, Avatar, Dropdown, Typography, Space, App, theme } from "antd";
import { LogoutOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { NotificationBell } from "@/components/notification-bell";

const { Text } = Typography;

export function CustomHeader() {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();

  const handleLogout = () => {
    modal.confirm({
      title: "Sign Out",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to sign out?",
      okText: "Sign Out",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => logout(),
    });
  };

  const menuItems = [
    {
      key: "info",
      label: (
        <div style={{ padding: "4px 0" }}>
          <Text strong style={{ color: token.colorText, display: "block" }}>
            {identity?.name ?? "Admin"}
          </Text>
          <Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            {identity?.email ?? ""}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" as const },
    {
      key: "logout",
      label: "Sign Out",
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout.Header
      style={{
        backgroundColor: token.colorBgElevated,
        borderBottom: `1px solid ${token.colorBorder}`,
        padding: "0px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 20,
        height: "64px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <NotificationBell />
      <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
        <Space style={{ cursor: "pointer" }}>
          <Avatar
            size={32}
            style={{
              background: "#FFDE58",
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {identity?.name?.charAt(0)?.toUpperCase() ?? "A"}
          </Avatar>
          <Text style={{ color: token.colorText, fontSize: 13 }}>
            {identity?.name ?? "Admin"}
          </Text>
        </Space>
      </Dropdown>
    </Layout.Header>
  );
}
