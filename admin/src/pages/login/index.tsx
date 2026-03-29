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
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Subtle grid pattern background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #1A1A1A 1px, transparent 0)",
          backgroundSize: "40px 40px",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          padding: "0 24px",
        }}
      >
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <GridLogo size={56} />
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, #333)",
              }}
            />
            <span
              style={{
                color: "#F0F0F0",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 6,
                textTransform: "uppercase",
              }}
            >
              Admin
            </span>
            <div
              style={{
                width: 32,
                height: 1,
                background:
                  "linear-gradient(90deg, #333, transparent)",
              }}
            />
          </div>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: "#0A0A0A",
            border: "1px solid #1E1E1E",
            borderRadius: 16,
            padding: "40px 32px 32px",
          }}
        >
          <Text
            style={{
              display: "block",
              color: "#808080",
              fontSize: 13,
              marginBottom: 24,
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            Sign in to manage orders and operations
          </Text>

          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              email: "admin@grid.ph",
              password: "admin123",
            }}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              rules={[{ required: true, message: "Email is required" }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#555" }} />}
                placeholder="Email"
                size="large"
                style={{
                  background: "#141414",
                  border: "1px solid #2E2E2E",
                  borderRadius: 10,
                  color: "#F0F0F0",
                  height: 48,
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "Password is required" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#555" }} />}
                placeholder="Password"
                size="large"
                style={{
                  background: "#141414",
                  border: "1px solid #2E2E2E",
                  borderRadius: 10,
                  color: "#F0F0F0",
                  height: 48,
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
                size="large"
                style={{
                  height: 48,
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 1,
                  background: "#FFDE58",
                  color: "#000000",
                  border: "none",
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* Footer */}
        <Text
          style={{
            display: "block",
            textAlign: "center",
            color: "#333",
            fontSize: 11,
            marginTop: 32,
            letterSpacing: 0.5,
          }}
        >
          GRID Printing Services &middot; Admin Dashboard
        </Text>
      </div>
    </div>
  );
}
