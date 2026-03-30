import { Show } from "@refinedev/antd";
import {
  Card, Descriptions, Typography, Button, Select, App, Modal,
  Input, Table, Space, Row, Col, Timeline,
} from "antd";
import {
  ExclamationCircleOutlined,
  UserSwitchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router";
import { useState } from "react";
import type { OrderStatus } from "@/types/enums";
import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_LABELS,
} from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import {
  formatCurrency,
  formatDateTime,
  statusLabel,
} from "@/utils/format";
import {
  mockOrders,
  mockDrivers,
  mockStatusHistory,
} from "@/providers/mock-data";

const { Text } = Typography;
const { TextArea } = Input;

export function OrderShow() {
  const { id } = useParams<{ id: string }>();
  const { modal, message } = App.useApp();
  const order = mockOrders.find((o) => o.id === id);
  const history = mockStatusHistory.filter((h) => h.order_id === id);
  const availableDrivers = mockDrivers.filter((d) => d.is_available);

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  if (!order) {
    return <Show title="Order Not Found"><Text>Order not found.</Text></Show>;
  }

  const validNextStatuses = ORDER_STATUS_TRANSITIONS[order.order_status];
  const canAssignDriver =
    order.order_status === "ready_for_dispatch" ||
    order.order_status === "driver_assigned";

  const handleStatusChange = (newStatus: OrderStatus) => {
    modal.confirm({
      title: "Update Status",
      icon: <ExclamationCircleOutlined />,
      content: `Change status to "${statusLabel(newStatus)}"?`,
      onOk: () => {
        message.success(`Status updated to ${statusLabel(newStatus)}`);
      },
    });
  };

  const handleAssignDriver = (_driverId: string) => {
    message.success("Driver assigned");
    setDriverModalOpen(false);
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      message.error("Please provide a reason");
      return;
    }
    message.success("Order declined");
    setDeclineModalOpen(false);
    setDeclineReason("");
  };

  return (
    <Show title={`Order ${order.order_id}`}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header with actions */}
        <Card>
          <Row justify="space-between" align="middle">
            <Col>
              <Space size="middle">
                <StatusBadge status={order.order_status} />
                <Text style={{ textTransform: "capitalize" }}>
                  {order.category === "paper" ? "Paper Printing" : "3D Printing"}
                </Text>
              </Space>
            </Col>
            <Col>
              <Space>
                {validNextStatuses.length > 0 && (
                  <Select
                    placeholder="Update Status"
                    style={{ width: 200 }}
                    onChange={handleStatusChange}
                    options={validNextStatuses.map((s) => ({
                      label: ORDER_STATUS_LABELS[s],
                      value: s,
                    }))}
                  />
                )}
                {canAssignDriver && (
                  <Button
                    icon={<UserSwitchOutlined />}
                    onClick={() => setDriverModalOpen(true)}
                  >
                    Assign Driver
                  </Button>
                )}
                {order.order_status !== "cancelled" &&
                  order.order_status !== "delivered" &&
                  order.order_status !== "file_declined" && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setDeclineModalOpen(true)}
                    >
                      Decline
                    </Button>
                  )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Specifications */}
        <Card title="Specifications">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="File">{order.file_name ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Quantity">{order.quantity}</Descriptions.Item>
            {order.paper_specs && (
              <>
                <Descriptions.Item label="Paper Size">{order.paper_specs.paper_size.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Color">{order.paper_specs.color_mode === "full_color" ? "Full Color" : "B&W"}</Descriptions.Item>
                <Descriptions.Item label="Media">{order.paper_specs.media_type}</Descriptions.Item>
                <Descriptions.Item label="Sides">{order.paper_specs.print_sides === "back_to_back" ? "Both Sides" : "Front Only"}</Descriptions.Item>
                <Descriptions.Item label="Binding">{order.paper_specs.binding}</Descriptions.Item>
              </>
            )}
            {order.three_d_specs && (
              <>
                <Descriptions.Item label="Format">{order.three_d_specs.file_format.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Material">{order.three_d_specs.material.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Color">{order.three_d_specs.color}</Descriptions.Item>
                <Descriptions.Item label="Infill">{order.three_d_specs.infill_percentage}%</Descriptions.Item>
                <Descriptions.Item label="Layer Height">{order.three_d_specs.layer_height}mm</Descriptions.Item>
                <Descriptions.Item label="Supports">{order.three_d_specs.supports ? "Yes" : "No"}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>

        {/* Price Breakdown */}
        <Card title="Price Breakdown">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Subtotal">{formatCurrency(order.total_price)}</Descriptions.Item>
            <Descriptions.Item label="Delivery Fee">{formatCurrency(order.delivery_fee)}</Descriptions.Item>
            <Descriptions.Item label="Total">{formatCurrency(order.total_price + order.delivery_fee)}</Descriptions.Item>
            <Descriptions.Item label="Payment Method"><span style={{ textTransform: "uppercase" }}>{order.payment_method}</span></Descriptions.Item>
            <Descriptions.Item label="Payment Status"><span style={{ textTransform: "capitalize" }}>{order.payment_status}</span></Descriptions.Item>
            <Descriptions.Item label="Delivery">{order.delivery_option === "delivery" ? "Delivery" : "Pickup"}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Admin Notes */}
        <Card title="Admin Notes">
          <TextArea
            rows={3}
            defaultValue={order.admin_notes ?? ""}
            placeholder="Internal notes (not visible to customer)..."
            onBlur={(e) => {
              if (e.target.value !== (order.admin_notes ?? "")) {
                message.success("Notes saved");
              }
            }}
          />
        </Card>

        {/* Status History */}
        <Card title="Status History">
          {history.length === 0 ? (
            <Text type="secondary">No status changes recorded yet.</Text>
          ) : (
            <Timeline
              items={history.map((h) => ({
                children: (
                  <div>
                    <Text strong>{statusLabel(h.from_status as OrderStatus)}</Text>
                    {" → "}
                    <Text strong>{statusLabel(h.to_status as OrderStatus)}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(h.created_at)}
                      {h.notes && ` — ${h.notes}`}
                    </Text>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </Space>

      {/* Driver Assignment Modal */}
      <Modal
        title="Assign Driver"
        open={driverModalOpen}
        onCancel={() => setDriverModalOpen(false)}
        footer={null}
      >
        <Table
          dataSource={availableDrivers}
          rowKey="id"
          pagination={false}
          size="small"
        >
          <Table.Column dataIndex="full_name" title="Name" />
          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            render={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <Table.Column dataIndex="plate_number" title="Plate" />
          <Table.Column
            title=""
            render={(_: unknown, record: { id: string }) => (
              <Button
                type="primary"
                size="small"
                onClick={() => handleAssignDriver(record.id)}
              >
                Assign
              </Button>
            )}
          />
        </Table>
      </Modal>

      {/* Decline Modal */}
      <Modal
        title="Decline Order"
        open={declineModalOpen}
        onOk={handleDecline}
        onCancel={() => {
          setDeclineModalOpen(false);
          setDeclineReason("");
        }}
        okText="Decline Order"
        okButtonProps={{ danger: true }}
      >
        <p>Provide a reason for declining this order. The customer will be notified.</p>
        <TextArea
          rows={3}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Reason for declining..."
        />
      </Modal>
    </Show>
  );
}
