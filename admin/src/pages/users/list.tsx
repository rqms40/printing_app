import { List } from "@refinedev/antd";
import { Table, Tag, Avatar, Space, Typography } from "antd";
import { formatDate } from "@/utils/format";

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

type MockUser = typeof mockUsers[0];

const ROLE_COLORS: Record<string, string> = {
  customer: "blue",
  driver: "gold",
  admin: "red",
};

export function UserList() {
  return (
    <List title="Users">
      <Table dataSource={mockUsers} rowKey="id">
        <Table.Column
          title="User"
          render={(_: unknown, record: MockUser) => (
            <Space>
              <Avatar
                size={36}
                style={{
                  background:
                    record.role === "admin"
                      ? "#EF5350"
                      : record.role === "driver"
                      ? "#FFDE58"
                      : "#42A5F5",
                  color: "#000",
                  fontWeight: 700,
                }}
              >
                {record.full_name?.charAt(0) ?? "?"}
              </Avatar>
              <div>
                <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                  {record.full_name}
                </Text>
                <Text style={{ color: "#808080", fontSize: 12 }}>{record.email}</Text>
              </div>
            </Space>
          )}
        />
        <Table.Column dataIndex="phone_number" title="Phone" />
        <Table.Column
          dataIndex="role"
          title="Role"
          render={(role: string) => (
            <Tag color={ROLE_COLORS[role]}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Tag>
          )}
        />
        <Table.Column
          dataIndex="is_active"
          title="Status"
          render={(active: boolean) => (
            <Tag color={active ? "green" : "default"}>{active ? "Active" : "Inactive"}</Tag>
          )}
        />
        <Table.Column
          dataIndex="created_at"
          title="Joined"
          render={(v: string) => formatDate(v)}
        />
      </Table>
    </List>
  );
}
