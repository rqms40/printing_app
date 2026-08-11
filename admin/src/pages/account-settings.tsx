import { useState, useEffect, useCallback } from "react";
import { Form, Input, Button, Card, Select, message, Spin, Typography } from "antd";
import { apiClient } from "@/providers/api-client";


const { Title, Text } = Typography;

export function AccountSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/users/profile");
      if (res.data) {
        form.setFieldsValue({
          fullName: res.data.fullName,
          nickname: res.data.nickname,
          phoneNumber: res.data.phoneNumber,
          gender: res.data.gender,
          ageRange: res.data.ageRange,
          course: res.data.course,
          organization: res.data.organization,
        });
      }
    } catch (error) {
      console.error(error);
      message.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      await apiClient.put("/users/profile", values);
      message.success("Account settings updated successfully!");
    } catch (error) {
      console.error(error);
      message.error("Failed to update account settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <Title level={3}>Account Settings</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Manage your personal account details.
      </Text>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            label="Nickname"
            name="nickname"
            rules={[{ required: true, message: "Please enter your nickname" }]}
          >
            <Input placeholder="E.g. Kai" />
          </Form.Item>

          <Form.Item
            label="Full Name"
            name="fullName"
            rules={[{ required: true, message: "Please enter your full name" }]}
          >
            <Input placeholder="Enter your full name" />
          </Form.Item>

          <Form.Item
            label="Phone Number"
            name="phoneNumber"
          >
            <Input placeholder="+63..." />
          </Form.Item>

          <Form.Item
            label="Gender Identity"
            name="gender"
          >
            <Select placeholder="Select gender" allowClear>
              <Select.Option value="male">Male</Select.Option>
              <Select.Option value="female">Female</Select.Option>
              <Select.Option value="non-binary">Non-binary</Select.Option>
              <Select.Option value="prefer-not-to-say">Prefer not to say</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Age Range"
            name="ageRange"
          >
            <Select placeholder="Select age range" allowClear>
              <Select.Option value="under-18">Under 18</Select.Option>
              <Select.Option value="18-24">18-24</Select.Option>
              <Select.Option value="25-34">25-34</Select.Option>
              <Select.Option value="35-44">35-44</Select.Option>
              <Select.Option value="45-54">45-54</Select.Option>
              <Select.Option value="55-plus">55+</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Course"
            name="course"
          >
            <Input placeholder="E.g. BS Architecture" />
          </Form.Item>

          <Form.Item
            label="Organization"
            name="organization"
          >
            <Input placeholder="E.g. Mapua University" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
