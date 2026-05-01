import { useEffect, useState } from "react";
import { Table, Tag, Button, Select, App, Spin } from "antd";
import { apiClient } from "@/providers/api-client";
import type { ExternalDelivery } from "@/types/delivery-slot";

const STATUS_COLORS: Record<string, string> = {
  pending_admin: "orange",
  booked: "blue",
  delivered: "green",
};

const STATUS_LABELS: Record<string, string> = {
  pending_admin: "Pending Admin",
  booked: "Booked",
  delivered: "Delivered",
};

export function ExternalDeliveriesPage() {
  const { message } = App.useApp();
  const [items, setItems] = useState<ExternalDelivery[]>([]);
  const [status, setStatus] = useState<string>("pending_admin");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ExternalDelivery[]>(
        `/admin/external-deliveries?status=${status}`
      );
      setItems(res.data ?? []);
    } catch {
      message.error("Failed to load external deliveries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [status]);

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await apiClient.patch(`/admin/external-deliveries/${id}/status`, { status: newStatus });
      message.success(`Marked as ${STATUS_LABELS[newStatus]}`);
      refresh();
    } catch {
      message.error("Update failed");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2>External Deliveries</h2>
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 200 }}
          options={[
            { value: "pending_admin", label: "Pending Admin" },
            { value: "booked", label: "Booked" },
            { value: "delivered", label: "Delivered" },
          ]}
        />
      </div>

      {loading ? (
        <Spin />
      ) : (
        <Table
          dataSource={items}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "Batch", dataIndex: "batchRef" },
            {
              title: "Customer",
              render: (_: unknown, record: ExternalDelivery) =>
                record.user?.fullName || record.user?.email || `User ${record.id}`,
            },
            {
              title: "Status",
              dataIndex: "externalDeliveryStatus",
              render: (v: string) => (
                <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
              ),
            },
            {
              title: "Created",
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "Actions",
              render: (_: unknown, record: ExternalDelivery) => (
                <>
                  {record.externalDeliveryStatus === "pending_admin" && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => updateStatus(record.id, "booked")}
                    >
                      Mark as Booked
                    </Button>
                  )}
                  {record.externalDeliveryStatus === "booked" && (
                    <Button
                      size="small"
                      onClick={() => updateStatus(record.id, "delivered")}
                    >
                      Mark as Delivered
                    </Button>
                  )}
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
