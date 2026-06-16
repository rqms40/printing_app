import { useLogin } from "@refinedev/core";
import { Button, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useState } from "react";
import { GridLogo } from "@/components/grid-logo";

const { Text } = Typography;

export function LoginPage() {
  const { mutate: login, isLoading } = useLogin();
  const [error, setError] = useState<string | null>(null);

  const onFinish = (values: { email: string; password: string }) => {
    setError(null);
    login(values, {
      onError: (err) => {
        setError(err?.message ?? "Login failed");
      },
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#000000",
      }}
    >
      {/* Left panel — branding */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0A0A0A",
          borderRight: "1px solid #1E1E1E",
          padding: 40,
        }}
      >
        <GridLogo size={64} />
        <Text
          style={{
            color: "#F0F0F0",
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: 8,
            marginTop: 20,
          }}
        >
          GRIDGO
        </Text>
        <Text
          style={{
            color: "#555",
            fontSize: 13,
            marginTop: 8,
            letterSpacing: 1,
          }}
        >
          Printing Services
        </Text>
      </div>

      {/* Right panel — form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <div style={{ width: "100%", maxWidth: 340 }}>
          <Text
            style={{
              display: "block",
              color: "#F0F0F0",
              fontWeight: 600,
              fontSize: 20,
              marginBottom: 4,
            }}
          >
            Admin Sign In
          </Text>
          <Text
            style={{
              display: "block",
              color: "#666",
              fontSize: 13,
              marginBottom: 32,
            }}
          >
            Enter your credentials to continue
          </Text>

          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              email: "admin@gridgoprint.ph",
              password: "password123",
            }}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label={<Text style={{ color: "#808080", fontSize: 12 }}>Email</Text>}
              rules={[{ required: true, message: "Email is required" }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#555" }} />}
                placeholder="admin@gridgoprint.ph"
                style={{
                  background: "#141414",
                  border: "1px solid #2E2E2E",
                  borderRadius: 8,
                  color: "#F0F0F0",
                  height: 44,
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<Text style={{ color: "#808080", fontSize: 12 }}>Password</Text>}
              rules={[{ required: true, message: "Password is required" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#555" }} />}
                placeholder="Enter password"
                style={{
                  background: "#141414",
                  border: "1px solid #2E2E2E",
                  borderRadius: 8,
                  color: "#F0F0F0",
                  height: 44,
                }}
              />
            </Form.Item>

            {error && (
              <Text
                style={{
                  display: "block",
                  color: "#EF5350",
                  fontSize: 13,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
            )}

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                style={{
                  height: 44,
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  background: "#FFDE58",
                  color: "#000",
                  border: "none",
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
