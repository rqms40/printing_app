import {
  List,
  useTable,
  DateField,
  NumberField,
} from "@refinedev/antd";
import { Table, Button, Space, Image, Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useApiUrl, useCustomMutation, useNotification } from "@refinedev/core";
import { useNotificationsContext } from "@/context/notifications-context";

const { Text } = Typography;

export const CreditRequestsList = () => {
  const apiUrl = useApiUrl();
  const { open } = useNotification();
  const { refreshBadges } = useNotificationsContext();

  // Custom fetch to hit the NestJS custom routes for credit approvals
  const { tableProps, tableQueryResult } = useTable({
    resource: "credits/requests/pending",
    syncWithLocation: false,
    pagination: { mode: "off" }
  });

  const { mutate } = useCustomMutation();

  const handleApprove = (id: number) => {
    mutate({
      url: `${apiUrl}/credits/approve/${id}`,
      method: "post",
      values: {},
    }, {
      onSuccess: () => {
        open?.({
          type: "success",
          message: "Top-Up Approved",
          description: "The credits have been successfully added to the user.",
        });
        tableQueryResult.refetch();
        refreshBadges();
      },
      onError: (error) => {
        open?.({
          type: "error",
          message: "Approval Failed",
          description: error?.message || "An error occurred.",
        });
      }
    });
  };

  const handleReject = (id: number) => {
    mutate({
      url: `${apiUrl}/credits/reject/${id}`,
      method: "post",
      values: {},
    }, {
      onSuccess: () => {
        open?.({
          type: "success",
          message: "Top-Up Rejected",
          description: "The top-up request has been rejected.",
        });
        tableQueryResult.refetch();
        refreshBadges();
      },
    });
  };

  return (
    <List title="Legacy Top-Up Requests (deprecated)">
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        Client top-up is disabled. Use Grant Pilot Credits above. This queue only
        remains for any historical pending requests.
      </Text>
      <Table {...tableProps} rowKey="id">
        <Table.Column 
          dataIndex="id" 
          title="ID" 
          render={(val) => <Text strong>#{val}</Text>}
        />
        <Table.Column 
          dataIndex={["user", "email"]} 
          title="User" 
        />
        <Table.Column 
          dataIndex="amountPhp" 
          title="Requested (PHP)" 
          render={(value) => (
            <NumberField
              value={value}
              options={{ style: "currency", currency: "PHP" }}
            />
          )}
        />
        <Table.Column 
          dataIndex="amountCredits" 
          title="Equivalent Pilot Credits" 
          render={(val) => <Text strong>{val} Pilot Credits</Text>}
        />
        <Table.Column
          dataIndex="proofOfPaymentUrl"
          title="Proof of Payment"
          render={(url) => (
            url ? (
              <Image 
                src={`${apiUrl.replace('/api', '')}${url}`} 
                alt="Proof" 
                style={{ maxWidth: 100, maxHeight: 100, objectFit: "cover" }}
                fallback="https://via.placeholder.com/100?text=No+Image"
              />
            ) : <Text type="secondary">No Proof</Text>
          )}
        />
        <Table.Column 
          dataIndex="createdAt" 
          title="Date Requested" 
          render={(value) => <DateField value={value} format="YYYY-MM-DD HH:mm:ss" />}
        />
        <Table.Column
          title="Actions"
          dataIndex="actions"
          render={(_, record: any) => (
            <Space>
              <Button 
                type="primary" 
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                Approve
              </Button>
              <Button 
                danger 
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record.id)}
              >
                Reject
              </Button>
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
