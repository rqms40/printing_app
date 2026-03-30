import { List } from "@refinedev/antd";
import { Table, Tag, Avatar, Space, Typography, Input, Tooltip } from "antd";
import { SearchOutlined, MailOutlined } from "@ant-design/icons";
import { useState } from "react";
import { formatDate, formatRelativeTime } from "@/utils/format";

const { Text } = Typography;

const mockUsers = [
  { id: "usr_001", full_name: "Maria Santos", email: "maria.santos@gmail.com", phone_number: "+639171234567", role: "customer" as const, is_active: true, created_at: "2025-12-25T00:00:00Z" },
  { id: "usr_002", full_name: "Jose Garcia", email: "jose.garcia@gmail.com", phone_number: "+639181234567", role: "customer" as const, is_active: true, created_at: "2026-01-10T00:00:00Z" },
  { id: "usr_003", full_name: "Ana Reyes", email: "ana.reyes@gmail.com", phone_number: "+639191234567", role: "customer" as const, is_active: true, created_at: "2026-02-05T00:00:00Z" },
  { id: "usr_004", full_name: "Pedro Cruz", email: "pedro.cruz@gmail.com", phone_number: "+639201234567", role: "customer" as const, is_active: false, created_at: "2026-01-20T00:00:00Z" },
  { id: "usr_010", full_name: "Juan Reyes", email: "juan.reyes@gmail.com", phone_number: "+639211234567", role: "driver" as const, is_active: true, created_at: "2026-01-15T00:00:00Z" },
  { id: "usr_011", full_name: "Marco dela Cruz", email: "marco.delacruz@gmail.com", phone_number: "+639221234567", role: "driver" as const, is_active: true, created_at: "2026-02-01T00:00:00Z" },
  { id: "admin_001", full_name: "Admin User", email: "admin@grid.ph", phone_number: "+639001234567", role: "admin" as const, is_active: true, created_at: "2025-11-01T00:00:00Z" },
];

type MockUser = (typeof mockUsers)[0];

const ROLE_COLORS: Record<string, string> = {
  customer: "blue",
  driver: "gold",
  admin: "red",
};

const AVATAR_BG: Record<string, string> = {
  customer: "#1A2A3A",
  driver: "#2A2A1A",
  admin: "#2A1A1A",
};

const AVATAR_FG: Record<string, string> = {
  customer: "#42A5F5",
  driver: "#FFDE58",
  admin: "#EF5350",
};

export function UserList() {
  const [search, setSearch] = useState("");

  const filtered = search
    ? mockUsers.filter(
        (u) =>
          u.full_name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : mockUsers;

  return (
    <List title="Users">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Input
            placeholder="Search by name or email..."
            prefix={<SearchOutlined style={{ color: "#555" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Space>
            <Tag color="blue" style={{ margin: 0, padding: "2px 10px" }}>
              {mockUsers.filter((u) => u.role === "customer").length} Customers
            </Tag>
            <Tag color="gold" style={{ margin: 0, padding: "2px 10px" }}>
              {mockUsers.filter((u) => u.role === "driver").length} Drivers
            </Tag>
            <Tag color="red" style={{ margin: 0, padding: "2px 10px" }}>
              {mockUsers.filter((u) => u.role === "admin").length} Admins
            </Tag>
          </Space>
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => (
              <span style={{ color: "#808080" }}>{total} users</span>
            ),
          }}
        >
          <Table.Column
            title="User"
            width={250}
            render={(_: unknown, record: MockUser) => (
              <Space>
                <Avatar
                  size={40}
                  style={{
                    background: AVATAR_BG[record.role],
                    color: AVATAR_FG[record.role],
                    fontWeight: 700,
                    border: `2px solid ${AVATAR_FG[record.role]}33`,
                  }}
                >
                  {record.full_name?.charAt(0) ?? "?"}
                </Avatar>
                <div>
                  <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                    {record.full_name}
                  </Text>
                  <Space size={4}>
                    <MailOutlined style={{ color: "#555", fontSize: 11 }} />
                    <Text style={{ color: "#808080", fontSize: 11 }}>
                      {record.email}
                    </Text>
                  </Space>
                </div>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="phone_number"
            title="Phone"
            width={150}
            render={(v: string) => (
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span>
            )}
          />
          <Table.Column
            dataIndex="role"
            title="Role"
            width={110}
            render={(role: string) => (
              <Tag color={ROLE_COLORS[role]}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Tag>
            )}
            filters={[
              { text: "Customer", value: "customer" },
              { text: "Driver", value: "driver" },
              { text: "Admin", value: "admin" },
            ]}
            onFilter={(value, record: MockUser) => record.role === value}
          />
          <Table.Column
            dataIndex="is_active"
            title="Status"
            width={100}
            render={(active: boolean) => (
              <Tag color={active ? "green" : "default"}>
                {active ? "Active" : "Inactive"}
              </Tag>
            )}
            filters={[
              { text: "Active", value: true },
              { text: "Inactive", value: false },
            ]}
            onFilter={(value, record: MockUser) => record.is_active === value}
          />
          <Table.Column
            dataIndex="created_at"
            title="Joined"
            width={120}
            render={(v: string) => (
              <Tooltip title={formatDate(v)}>
                <span>{formatRelativeTime(v)}</span>
              </Tooltip>
            )}
            sorter={(a: MockUser, b: MockUser) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
        </Table>
      </Space>
    </List>
  );
}
