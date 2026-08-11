import { useEffect, useState, useCallback } from "react";
import { Form, Input, Select, Button, App, Card, Row, Col, Typography } from "antd";
import { apiClient } from "@/providers/api-client";
import { SaveOutlined } from "@ant-design/icons";

const { Paragraph } = Typography;

export function AccountDetailsForm() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/users/profile");
      if (data) {
        form.setFieldsValue({
          fullName: data.fullName,
          nickname: data.nickname,
          phoneNumber: data.phoneNumber || data.phone, // server might return phone or phoneNumber
          gender: data.gender,
          ageRange: data.ageRange,
        });
      }
    } catch {
      void message.error("Could not load account details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      await apiClient.put("/users/profile", values);
      message.success("Account details updated successfully");
      void loadProfile();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Failed to update account details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Account Details</span>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <Paragraph style={{ marginBottom: 24, color: "#666" }}>
        Manage your personal account information. These details are private and separate from your public business storefront profile.
      </Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{}}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="fullName"
              label="Full Name"
              rules={[{ required: true, message: "Please enter your full name" }]}
            >
              <Input placeholder="John Doe" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="nickname" label="Nickname">
              <Input placeholder="Johnny" />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="phoneNumber"
              label="Phone Number"
            >
              <Input placeholder="+639171234567" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="gender" label="Gender">
              <Select placeholder="Select gender" allowClear>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
                <Select.Option value="other">Other</Select.Option>
                <Select.Option value="prefer_not_to_say">Prefer not to say</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="ageRange" label="Age Range">
              <Select placeholder="Select age range" allowClear>
                <Select.Option value="under_18">Under 18</Select.Option>
                <Select.Option value="18_24">18 - 24</Select.Option>
                <Select.Option value="25_34">25 - 34</Select.Option>
                <Select.Option value="35_44">35 - 44</Select.Option>
                <Select.Option value="45_plus">45+</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}
