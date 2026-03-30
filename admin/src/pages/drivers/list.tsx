import { List } from "@refinedev/antd";
import { Table, Tag, Avatar, Space, Typography, Input, Tooltip } from "antd";
import { SearchOutlined, EnvironmentOutlined, CarOutlined } from "@ant-design/icons";
import { useState } from "react";
import { mockDrivers } from "@/providers/mock-data";
import type { DriverProfile } from "@/types/driver";
import { formatDateTime, formatRelativeTime } from "@/utils/format";

const { Text } = Typography;

const VEHICLE_COLORS: Record<string, string> = {
  motorcycle: "gold",
  bicycle: "green",
  car: "blue",
};


export function DriverList() {
  const [search, setSearch] = useState("");

  const filtered = search
    ? mockDrivers.filter(
        (d) =>
          d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          d.plate_number?.toLowerCase().includes(search.toLowerCase()),
      )
    : mockDrivers;

  const onlineCount = mockDrivers.filter((d) => d.is_available).length;

  return (
    <List
      title="Drivers"
      headerButtons={() => (
        <Space>
          <Tag color="green" style={{ margin: 0, fontSize: 13, padding: "2px 10px" }}>
            {onlineCount} Online
          </Tag>
          <Tag color="default" style={{ margin: 0, fontSize: 13, padding: "2px 10px" }}>
            {mockDrivers.length - onlineCount} Offline
          </Tag>
        </Space>
      )}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Input
          placeholder="Search by name or plate..."
          prefix={<SearchOutlined style={{ color: "#555" }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 700 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => (
              <span style={{ color: "#808080" }}>{total} drivers</span>
            ),
          }}
        >
          <Table.Column
            title="Driver"
            width={220}
            render={(_: unknown, record: DriverProfile) => (
              <Space>
                <Avatar
                  size={40}
                  style={{
                    background: record.is_available ? "#1A2E1A" : "#2A2A2A",
                    color: record.is_available ? "#66BB6A" : "#808080",
                    fontWeight: 700,
                    border: `2px solid ${record.is_available ? "#66BB6A" : "#333"}`,
                  }}
                >
                  {record.full_name?.charAt(0) ?? "?"}
                </Avatar>
                <div>
                  <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                    {record.full_name ?? "Unknown"}
                  </Text>
                  <Text style={{ color: "#808080", fontSize: 11 }}>
                    ID: {record.user_id}
                  </Text>
                </div>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            width={140}
            render={(v: string) => (
              <Tag color={VEHICLE_COLORS[v] ?? "default"} icon={<CarOutlined />}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Tag>
            )}
            filters={[
              { text: "Motorcycle", value: "motorcycle" },
              { text: "Bicycle", value: "bicycle" },
              { text: "Car", value: "car" },
            ]}
            onFilter={(value, record: DriverProfile) => record.vehicle_type === value}
          />
          <Table.Column
            dataIndex="plate_number"
            title="Plate"
            width={120}
            render={(v?: string) => (
              <span style={{ fontFamily: "monospace", fontWeight: 500 }}>
                {v ?? "—"}
              </span>
            )}
          />
          <Table.Column
            dataIndex="is_available"
            title="Status"
            width={100}
            render={(available: boolean) => (
              <Tag color={available ? "green" : "default"}>
                {available ? "Online" : "Offline"}
              </Tag>
            )}
            filters={[
              { text: "Online", value: true },
              { text: "Offline", value: false },
            ]}
            onFilter={(value, record: DriverProfile) => record.is_available === value}
          />
          <Table.Column
            dataIndex="last_location_update"
            title="Last Active"
            width={150}
            render={(v?: string) =>
              v ? (
                <Tooltip title={formatDateTime(v)}>
                  <Space size={4}>
                    <EnvironmentOutlined style={{ color: "#808080", fontSize: 12 }} />
                    <span>{formatRelativeTime(v)}</span>
                  </Space>
                </Tooltip>
              ) : (
                <span style={{ color: "#555" }}>—</span>
              )
            }
          />
        </Table>
      </Space>
    </List>
  );
}
