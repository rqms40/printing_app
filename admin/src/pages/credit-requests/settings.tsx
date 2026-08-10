import {
  Card,
  InputNumber,
  Button,
  Form,
  Skeleton,
  Switch
} from "antd";
import { useApiUrl, useCustom, useCustomMutation, useNotification } from "@refinedev/core";


export const CreditSettingsCard = () => {
  const apiUrl = useApiUrl();
  const { open } = useNotification();
  const [form] = Form.useForm();
  
  const { data, isLoading, refetch } = useCustom({
    url: `${apiUrl}/credits/settings`,
    method: "get",
  });

  const { mutate, isLoading: isUpdating } = useCustomMutation();

  const onFinish = (values: any) => {
    mutate({
      url: `${apiUrl}/credits/settings`,
      method: "put",
      values: {
        ...values,
        conversionRate: Number(values.conversionRate),
      },
    }, {
      onSuccess: () => {
        open?.({
          type: "success",
          message: "Settings Updated",
          description: "Credit conversion rate has been updated globally.",
        });
        refetch();
      }
    });
  };

  if (isLoading) return <Skeleton active />;

  return (
    <Card title="Pilot Credits Settings" style={{ marginBottom: 24 }}>
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={onFinish}
        initialValues={{ 
          conversionRate: data?.data?.conversionRate || 1,
          creditsOnlyMode: data?.data?.creditsOnlyMode || false
        }}
      >
        <Form.Item 
          name="conversionRate" 
          label="Legacy conversion rate (1 PHP = X credits)"
          rules={[{ required: true }]}
          extra="Retained for historical top-up rows only. Pilot Credits are grant-only and do not use purchase conversion."
        >
          <InputNumber step="0.1" min="0.1" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="creditsOnlyMode"
          label="Require Pilot Credits at checkout"
          valuePropName="checked"
          extra="If enabled, checkout disables GCash, Maya, and Cash on Delivery so customers can pay only with Pilot Credits / Test Credits."
        >
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={isUpdating}>
          Save Settings
        </Button>
      </Form>
    </Card>
  );
};
