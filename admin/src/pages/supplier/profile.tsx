import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, Row, Select, Spin, Typography, Space, List as AntList, Modal, Upload, Avatar, Tabs } from "antd";
import { UserOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { List } from "@refinedev/antd";
import { apiClient } from "@/providers/api-client";
import { loadMySupplierProfile, updateMySupplierProfile, addMySupplierCapability, removeMySupplierCapability, type SupplierDirectoryRow } from "@/services/suppliersAdminApi";
import { AccountDetailsForm } from "./components/AccountDetailsForm";

const { Title, Paragraph } = Typography;

export function SupplierProfilePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SupplierDirectoryRow | null>(null);
  
  // Modals state
  const [capModalVisible, setCapModalVisible] = useState(false);
  const [capForm] = Form.useForm();
  const [addingCap, setAddingCap] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadMySupplierProfile();
      if (data) {
        setProfile(data);
        form.setFieldsValue({
          businessName: data.businessName,
          description: data.description,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          address: data.address,
          serviceZones: data.serviceZones,
          // Convert record attributes to array for Form.List
          attributesList: Object.entries(data.attributes || {}).map(([key, value]) => ({ keyName: key, value })),
        });
      }
    } catch {
      void message.error("Could not load profile. Please try again.");
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
      const { attributesList, ...rest } = values;
      
      // Reconstruct attributes object
      const attributes: Record<string, string> = {};
      if (attributesList) {
        attributesList.forEach((attr: { keyName: string; value: string }) => {
          if (attr && attr.keyName) {
            attributes[attr.keyName] = attr.value || "";
          }
        });
      }

      await updateMySupplierProfile({ ...rest, attributes });
      message.success("Profile updated successfully");
      void loadProfile();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCapability = async (values: any) => {
    setAddingCap(true);
    try {
      const materials = values.materials ? values.materials.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      await addMySupplierCapability(values.productFamily, materials);
      message.success("Capability added!");
      setCapModalVisible(false);
      capForm.resetFields();
      void loadProfile();
    } catch (e: any) {
      message.error("Failed to add capability");
    } finally {
      setAddingCap(false);
    }
  };

  const handleRemoveCapability = async (capId: number) => {
    try {
      await removeMySupplierCapability(capId);
      message.success("Capability removed");
      void loadProfile();
    } catch {
      message.error("Failed to remove capability");
    }
  };

  const uploadLogo = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Save logoFileId directly to supplier profile
      await updateMySupplierProfile({ logoFileId: res.data.id });
      message.success("Logo uploaded successfully");
      onSuccess("ok");
      void loadProfile();
    } catch (err: any) {
      message.error("Logo upload failed");
      onError({ err });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <List
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UserOutlined />
          My Shop Profile
        </span>
      }
    >
      {loading || !profile ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: "1",
              label: "Business Profile",
              children: (
                <Space direction="vertical" size="large" style={{ display: "flex" }}>
                  <Card>
            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 24 }}>
              <Upload
                customRequest={uploadLogo}
                showUploadList={false}
                accept="image/*"
              >
                <div style={{ cursor: "pointer", textAlign: "center" }}>
                  <Avatar 
                    size={96} 
                    src={profile?.logoUrl} 
                    style={{ backgroundColor: "#f0f0f0", color: "#999", fontSize: 32, marginBottom: 8 }}
                  >
                    {!profile?.logoUrl && profile.businessName ? profile.businessName.charAt(0).toUpperCase() : "S"}
                  </Avatar>
                  <div style={{ color: "#1890ff" }}>
                    {uploadingLogo ? <Spin size="small" /> : <><UploadOutlined /> Change Logo</>}
                  </div>
                </div>
              </Upload>
              <div>
                <Title level={4}>Shop Details</Title>
                <Paragraph type="secondary">
                  Update your shop information. These details will be visible to clients during ordering.
                </Paragraph>
              </div>
            </div>
            
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              initialValues={{ serviceZones: [] }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="businessName"
                    label="Business Name"
                    rules={[{ required: true, message: "Please enter your business name" }]}
                  >
                    <Input placeholder="e.g. Davao Print Co" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item
                    name="contactPhone"
                    label="Contact Phone"
                    rules={[{ required: true, message: "Please enter contact phone" }]}
                  >
                    <Input placeholder="e.g. +639171234567" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="contactEmail"
                    label="Contact Email"
                    rules={[
                      { type: "email", message: "Please enter a valid email" }
                    ]}
                  >
                    <Input placeholder="e.g. hello@printco.ph" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item
                    name="serviceZones"
                    label="Service Zones"
                  >
                    <Select
                      mode="tags"
                      placeholder="Enter service zones (e.g. Davao City, Toril)"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="address"
                    label="Physical Address"
                    rules={[{ required: true, message: "Please enter your address" }]}
                  >
                    <Input placeholder="e.g. 123 Quimpo Blvd, Davao City" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="description"
                    label="Shop Description"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Describe your printing services, capabilities, and business."
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Title level={5} style={{ marginTop: 16 }}>Attributes</Title>
              <Paragraph type="secondary">Free-form details shown on your shop profile (equipment, finishes, languages, etc.).</Paragraph>
              
              <Form.List name="attributesList">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Row key={key} gutter={16} style={{ marginBottom: 8 }} align="middle">
                        <Col span={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'keyName']}
                            style={{ marginBottom: 0 }}
                            rules={[{ required: true, message: 'Missing name' }]}
                          >
                            <Input placeholder="Name (e.g. Equipment)" />
                          </Form.Item>
                        </Col>
                        <Col span={14}>
                          <Form.Item
                            {...restField}
                            name={[name, 'value']}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="Value (e.g. HP Latex)" />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                        </Col>
                      </Row>
                    ))}
                    <Form.Item style={{ marginTop: 8 }}>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        Add Attribute
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              <Form.Item style={{ marginTop: 24, textAlign: "right" }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  Save Profile Details
                </Button>
              </Form.Item>
            </Form>
          </Card>
          <Card
                    title={
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Printing Capabilities</span>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCapModalVisible(true)}>
                          Add Capability
                        </Button>
                      </div>
                    }
                  >
                    <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                      Define which products you print and what materials you stock. This matches client orders to your shop.
                    </Paragraph>
                    <AntList
                      dataSource={profile?.capabilities || []}
                      renderItem={cap => (
                        <AntList.Item
                          actions={[
                            <Button key="del" danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveCapability(cap.id)}>
                              Remove
                            </Button>
                          ]}
                        >
                          <AntList.Item.Meta
                            title={cap.productFamily}
                            description={`Materials: ${cap.materials?.join(", ") || "Any"}`}
                          />
                        </AntList.Item>
                      )}
                      locale={{ emptyText: "No specific capabilities listed." }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: "2",
              label: "Account Details",
              children: <AccountDetailsForm />,
            },
          ]}
        />
      )}

      <Modal
        title="Add Capability"
        open={capModalVisible}
        onCancel={() => setCapModalVisible(false)}
        onOk={() => capForm.submit()}
        confirmLoading={addingCap}
        okText="Add"
      >
        <Form form={capForm} layout="vertical" onFinish={handleAddCapability}>
          <Form.Item name="productFamily" label="Product Family" rules={[{ required: true }]}>
            <Input placeholder="e.g. flyer, tarp, document" />
          </Form.Item>
          <Form.Item name="materials" label="Materials (comma-separated)">
            <Input placeholder="e.g. glossy, matte" />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
}
