import { useGetIdentity, useLogout } from "@refinedev/core";
import { Layout, Avatar, Dropdown, Typography, Space } from "antd";
import { LogoutOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function CustomHeader() {
  const { data: identity } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();

  const menuItems = [
    {
      key: "info",
      label: (
        <div style={{ padding: "4px 0" }}>
          <Text strong style={{ color: "#F0F0F0", display: "block" }}>
            {identity?.name ?? "Admin"}
          </Text>
          <Text style={{ color: "#808080", fontSize: 12 }}>
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
      onClick: () => logout(),
    },
  ];

  return (
    <Layout.Header
      style={{
        background: "#0A0A0A",
        borderBottom: "1px solid #1E1E1E",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: 56,
      }}
    >
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
          <Text style={{ color: "#F0F0F0", fontSize: 13 }}>
            {identity?.name ?? "Admin"}
          </Text>
        </Space>
      </Dropdown>
    </Layout.Header>
  );
}
