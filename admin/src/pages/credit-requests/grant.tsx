import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  DatePicker,
  Select,
  Skeleton,
  Typography,
} from "antd";
import {
  useApiUrl,
  useCustomMutation,
  useNotification,
} from "@refinedev/core";
import { useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import { loadAdminUsers } from "@/pages/users/data";
import type { AdminUserRecord } from "@/utils/api-normalizers";

const { Text } = Typography;

export const GrantPilotCreditsCard = () => {
  const apiUrl = useApiUrl();
  const { open } = useNotification();
  const [form] = Form.useForm();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const { mutate, isLoading: isGranting } = useCustomMutation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadAdminUsers();
        if (!cancelled) setUsers(list);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clientUsers = users.filter(
    (u) => !u.role || u.role === "client" || u.role === "customer",
  );

  const onFinish = (values: {
    userId: number;
    amount: number;
    reason: string;
    expiresAt?: Dayjs | null;
  }) => {
    mutate(
      {
        url: `${apiUrl}/credits/grant`,
        method: "post",
        values: {
          userId: Number(values.userId),
          amount: Number(values.amount),
          reason: values.reason,
          expiresAt: values.expiresAt
            ? values.expiresAt.toISOString()
            : undefined,
        },
      },
      {
        onSuccess: () => {
          open?.({
            type: "success",
            message: "Pilot Credits granted",
            description:
              "Test credits were added to the client ledger with the provided reason.",
          });
          form.resetFields(["amount", "reason", "expiresAt"]);
        },
        onError: (error) => {
          open?.({
            type: "error",
            message: "Grant failed",
            description: error?.message || "Could not grant Pilot Credits.",
          });
        },
      },
    );
  };

  if (loadingUsers) return <Skeleton active />;

  return (
    <Card title="Grant Pilot Credits" style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Pilot Credits (Test Credits) are a free test instrument — not purchasable,
        transferable, or withdrawable. Only Ops Admin / Super Admin may grant.
      </Text>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="userId"
          label="Client"
          rules={[{ required: true, message: "Select a client" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select client"
            options={clientUsers.map((u) => ({
              value: u.id,
              label: `${u.email}${u.full_name ? ` (${u.full_name})` : ""}`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="amount"
          label="Amount (Pilot Credits)"
          rules={[{ required: true, message: "Enter amount" }]}
        >
          <InputNumber min={0.01} step={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Reason"
          rules={[{ required: true, message: "Reason is required for audit" }]}
        >
          <Input.TextArea
            rows={2}
            maxLength={500}
            placeholder="e.g. Pilot cohort onboarding pack"
          />
        </Form.Item>
        <Form.Item
          name="expiresAt"
          label="Optional expiry"
          extra="Leave empty for no expiry. Expired credits can be swept later."
        >
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={isGranting}>
          Grant Pilot Credits
        </Button>
      </Form>
    </Card>
  );
};
