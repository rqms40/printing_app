import { List } from "@refinedev/antd";
import { Table, Tag, Avatar, Space, Typography, Input, Tooltip, Button, Alert } from "antd";
import { SearchOutlined, MailOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDate, formatRelativeTime } from "@/utils/format";
import { buildAdminUsersViewModel, loadAdminUsers } from "./data";
import {
  humanizeEnumValue,
  type AdminUserRecord,
} from "@/utils/api-normalizers";

const { Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  client: "blue",
  customer: "blue",
  supplier: "purple",
  rider: "gold",
  ops_admin: "red",
  super_admin: "magenta",
  admin: "red",
};

const AVATAR_BG: Record<string, string> = {
  client: "#1A2A3A",
  customer: "#1A2A3A",
  supplier: "#2A1A2A",
  rider: "#2A2A1A",
  ops_admin: "#2A1A1A",
  super_admin: "#2A1A2A",
  admin: "#2A1A1A",
};

const AVATAR_FG: Record<string, string> = {
  client: "#42A5F5",
  customer: "#42A5F5",
  supplier: "#AB47BC",
  rider: "#FFDE58",
  ops_admin: "#EF5350",
  super_admin: "#EC407A",
  admin: "#EF5350",
};

export function UserList() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void loadAdminUsers()
      .then((loadedUsers) => {
        if (!active) {
          return;
        }

        setUsers(loadedUsers);
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }

        setUsers([]);
        setError(cause instanceof Error ? cause.message : "Unable to load users");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const view = buildAdminUsersViewModel({
    loading,
    users,
    error,
  });

  const visibleUsers = view.users;
  const filtered = search
    ? visibleUsers.filter(
        (u) =>
          (u.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.profile_field?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (u.organization?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : visibleUsers;

  return (
    <List title="Users">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {view.kind === "error" ? (
          <Alert
            type="error"
            showIcon
            message={view.message}
            action={
              <Button type="link" onClick={() => setReloadKey((value) => value + 1)}>
                {view.retryLabel}
              </Button>
            }
          />
        ) : null}
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
              {visibleUsers.filter(
                (u) => u.role === "client" || u.role === "customer",
              ).length}{" "}
              Clients
            </Tag>
            <Tag color="gold" style={{ margin: 0, padding: "2px 10px" }}>
              {visibleUsers.filter((u) => u.role === "rider").length} Riders
            </Tag>
            <Tag color="red" style={{ margin: 0, padding: "2px 10px" }}>
              {visibleUsers.filter((u) => u.role === "admin").length} Admins
            </Tag>
          </Space>
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
          loading={loading}
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
            render={(_: unknown, record: AdminUserRecord) => (
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
            dataIndex="id"
            title="User ID"
            width={90}
            render={(v: number) => (
              <Tooltip title={String(v)}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#888" }}>
                  #{v}
                </span>
              </Tooltip>
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
            title="Profile"
            width={220}
            render={(_: unknown, record: AdminUserRecord) => (
              <Space direction="vertical" size={2}>
                <Space wrap size={[6, 6]}>
                  {record.profile_category ? (
                    <Tag color="cyan">
                      {humanizeEnumValue(record.profile_category)}
                    </Tag>
                  ) : null}
                  {record.profile_field ? (
                    <Tag color="geekblue">
                      {humanizeEnumValue(record.profile_field)}
                    </Tag>
                  ) : null}
                </Space>
                <Text style={{ color: "#808080", fontSize: 12 }}>
                  {record.course ?? record.organization ?? "No profile context"}
                </Text>
              </Space>
            )}
          />
          <Table.Column
            title="Print Focus"
            width={220}
            render={(_: unknown, record: AdminUserRecord) => (
              <Space wrap size={[6, 6]}>
                {record.printing_preferences.length > 0 ? (
                  record.printing_preferences.map((preference) => (
                    <Tag key={preference} color="default">
                      {humanizeEnumValue(preference)}
                    </Tag>
                  ))
                ) : (
                  <Text style={{ color: "#808080", fontSize: 12 }}>
                    No preferences
                  </Text>
                )}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="role"
            title="Role"
            width={110}
            render={(role: string) => (
              <Tag color={ROLE_COLORS[role]}>
                {humanizeEnumValue(role, "Unknown")}
              </Tag>
            )}
            filters={[
              { text: "Client", value: "client" },
              { text: "Supplier", value: "supplier" },
              { text: "Rider", value: "rider" },
              { text: "Ops Admin", value: "ops_admin" },
              { text: "Super Admin", value: "super_admin" },
            ]}
            onFilter={(value, record: AdminUserRecord) => record.role === value}
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
            onFilter={(value, record: AdminUserRecord) => record.is_active === value}
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
            sorter={(a: AdminUserRecord, b: AdminUserRecord) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
          <Table.Column
            title="Actions"
            width={100}
            fixed="right"
            render={(_: unknown, record: AdminUserRecord) => (
              <Link to={`/users/show/${record.id}`}>
                <Button type="link" style={{ paddingInline: 0 }}>
                  View
                </Button>
              </Link>
            )}
          />
        </Table>
      </Space>
    </List>
  );
}
