import { useState } from "react";
import { Layout, Table, Button, Input, Form, Typography, Tag, Space, Drawer, message, Popconfirm, theme } from "antd";
import { useList, useUpdate, useDelete } from "@refinedev/core";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SupportTicket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  adminReply: string | null;
  createdAt: string;
}

export function TicketList() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const { data, isLoading } = useList<SupportTicket>({
    resource: "support-tickets",
    sorters: [{ field: "createdAt", order: "desc" }],
  });

  const { mutate: updateTicket, isLoading: isUpdating } = useUpdate();
  const { mutate: deleteTicket } = useDelete();

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    updateTicket(
      {
        resource: "support-tickets",
        id: selectedTicket.id + "/reply",
        values: {
          replyMessage,
        },
      },
      {
        onSuccess: () => {
          message.success("Reply sent successfully!");
          setReplyMessage("");
          setSelectedTicket(null);
        },
        onError: (error) => {
          message.error(error?.message || "Failed to send reply");
        },
      }
    );
  };

  const columns = [
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (val: string) => (
        <Tag color={val === "open" ? "warning" : "success"}>
          {val.toUpperCase()}
        </Tag>
      ),
      width: 100,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (val: string) => new Date(val).toLocaleString(),
      width: 150,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 150,
    },
    {
      title: "Subject",
      dataIndex: "subject",
      key: "subject",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record: SupportTicket) => (
        record.status === "closed" ? (
          <Popconfirm
            title="Delete the ticket"
            description="Are you sure to delete this ticket?"
            onConfirm={(e) => {
              e?.stopPropagation();
              deleteTicket({ resource: "support-tickets", id: record.id });
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button danger type="text" onClick={(e) => e.stopPropagation()}>
              Delete
            </Button>
          </Popconfirm>
        ) : null
      ),
      width: 100,
    },
  ];

  return (
    <div style={{ height: "100%", padding: 24, background: token.colorBgContainer, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => setSelectedTicket(record),
          style: { cursor: "pointer" },
        })}
        scroll={{ y: "calc(100vh - 250px)" }}
        pagination={false}
      />

      <Drawer
        title="Ticket Details"
        placement="right"
        width={500}
        onClose={() => setSelectedTicket(null)}
        open={!!selectedTicket}
      >
        {selectedTicket && (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <div>
              <Text type="secondary">From:</Text>
              <br />
              <Text strong>{selectedTicket.name} ({selectedTicket.email})</Text>
            </div>
            
            <div>
              <Text type="secondary">Subject:</Text>
              <br />
              <Text strong>{selectedTicket.subject}</Text>
            </div>

            <div>
              <Text type="secondary">Message:</Text>
              <div style={{ padding: 12, background: token.colorBgElevated, borderRadius: 8, marginTop: 4, border: `1px solid ${token.colorBorder}` }}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {selectedTicket.message}
                </Paragraph>
              </div>
            </div>

            {selectedTicket.status === "closed" ? (
              <div>
                <Text type="secondary">Admin Reply:</Text>
                <div style={{ padding: 12, background: token.colorBgElevated, borderRadius: 8, marginTop: 4, border: `1px solid ${token.colorBorder}` }}>
                  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {selectedTicket.adminReply}
                  </Paragraph>
                </div>
              </div>
            ) : (
              <div>
                <Text type="secondary" strong>Write a Reply:</Text>
                <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
                  <Form.Item required>
                    <TextArea
                      rows={6}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply here..."
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    onClick={handleReply}
                    loading={isUpdating}
                    disabled={!replyMessage.trim()}
                    style={{ width: "100%" }}
                  >
                    Send Reply
                  </Button>
                </Form>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
}
