import {
  Card,
  InputNumber,
  Button,
  Form,
  Skeleton
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
      values,
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
        initialValues={{ conversionRate: data?.data?.conversionRate || 1 }}
      >
        <Form.Item 
          name="conversionRate" 
          label="Conversion Rate (1 PHP = X Credits)"
          rules={[{ required: true }]}
          extra="Change this during promos. (e.g. 1.2 means 1 PHP gives 1.2 credits)"
        >
          <InputNumber step="0.1" min="0.1" style={{ width: "100%" }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={isUpdating}>
          Save Settings
        </Button>
      </Form>
    </Card>
  );
};
