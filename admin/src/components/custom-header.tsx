import { useGetIdentity, useLogout } from "@refinedev/core";
import { Layout, Space, Avatar, Typography, Button, App } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { GridLogo } from "@/components/grid-logo";

const { Text } = Typography;

interface Identity {
  id: string;
  name?: string;
  email?: string;
}

export function CustomHeader() {
  const { data: identity } = useGetIdentity<Identity>();
  const { mutate: logout } = useLogout();
  const { modal } = App.useApp();

  const handleLogout = () => {
    modal.confirm({
      title: "Log out",
      content: "Are you sure you want to log out?",
      okText: "Log out",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => logout(),
    });
  };

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 64,
        background: "#fff",
        borderBottom: "1px solid #f0f0f0",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      <Space align="center">
        <GridLogo size={24} />
        <Text strong style={{ fontSize: 16 }}>
          GRID Admin
        </Text>
      </Space>

      <Space align="center">
        <Avatar icon={<UserOutlined />} size="small" />
        <Text>{identity?.name ?? identity?.email ?? "Admin"}</Text>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          title="Log out"
        >
          Log out
        </Button>
      </Space>
    </Layout.Header>
  );
}
