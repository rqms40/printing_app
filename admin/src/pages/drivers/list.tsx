import { List } from "@refinedev/antd";
import { Table, Tag, Avatar, Space, Typography } from "antd";
import { CarOutlined } from "@ant-design/icons";
import { mockDrivers } from "@/providers/mock-data";
import type { DriverProfile } from "@/types/driver";
import { formatDateTime } from "@/utils/format";

const { Text } = Typography;

const VEHICLE_COLORS: Record<string, string> = {
  motorcycle: "gold",
  bicycle: "green",
  car: "blue",
};

export function DriverList() {
  return (
    <List title="Drivers">
      <Table dataSource={mockDrivers} rowKey="id">
        <Table.Column
          title="Driver"
          render={(_: unknown, record: DriverProfile) => (
            <Space>
              <Avatar
                size={36}
                style={{ background: "#2A2A2A", color: "#FFDE58", fontWeight: 700 }}
              >
                {record.full_name?.charAt(0) ?? "?"}
              </Avatar>
              <div>
                <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                  {record.full_name ?? "Unknown"}
                </Text>
                <Text style={{ color: "#808080", fontSize: 12 }}>{record.user_id}</Text>
              </div>
            </Space>
          )}
        />
        <Table.Column
          dataIndex="vehicle_type"
          title="Vehicle"
          render={(v: string) => (
            <Tag color={VEHICLE_COLORS[v] ?? "default"} icon={<CarOutlined />}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Tag>
          )}
        />
        <Table.Column dataIndex="plate_number" title="Plate Number" />
        <Table.Column
          dataIndex="is_available"
          title="Status"
          render={(available: boolean) => (
            <Tag color={available ? "green" : "default"}>
              {available ? "Online" : "Offline"}
            </Tag>
          )}
        />
        <Table.Column
          dataIndex="last_location_update"
          title="Last Active"
          render={(v?: string) => (v ? formatDateTime(v) : "—")}
        />
      </Table>
    </List>
  );
}
