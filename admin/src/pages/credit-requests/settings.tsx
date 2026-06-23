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
    <Card title="Credit System Settings" style={{ marginBottom: 24 }}>
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
          label="Conversion Rate (1 PHP = X Credits)"
          rules={[{ required: true }]}
          extra="Change this during promos. (e.g. 1.2 means 1 PHP gives 1.2 credits)"
        >
          <InputNumber step="0.1" min="0.1" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          name="creditsOnlyMode"
          label="Restrict Cash on Delivery during beta"
          valuePropName="checked"
          extra="If enabled, Cash on Delivery is temporarily disabled in the mobile app while GCash, Maya, and GRIDGO Credits remain available."
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
