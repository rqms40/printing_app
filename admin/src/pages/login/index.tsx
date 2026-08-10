import { useLogin } from "@refinedev/core";
import { Button, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useState } from "react";
import { GridLogo } from "@/components/grid-logo";
import "./index.css";

const { Text } = Typography;

export function LoginPage() {
  const { mutate: login, isLoading } = useLogin();
  const [error, setError] = useState<string | null>(null);

  const onFinish = (values: { email: string; password: string }) => {
    setError(null);
    login(values, {
      // Refine may resolve success:false without calling onError — surface both.
      onSuccess: (data) => {
        if (data && typeof data === "object" && "success" in data && !data.success) {
          const err = (data as { error?: { message?: string } }).error;
          setError(err?.message ?? "Login failed");
        }
      },
      onError: (err) => {
        setError(err?.message ?? "Login failed");
      },
    });
  };

  return (
    <main className="admin-login-page">
      {/* Left panel — branding */}
      <section className="admin-login-brand-panel" aria-label="GRIDGO Admin">
        <div className="admin-login-logo">
          <GridLogo size={64} />
        </div>
        <Text
          className="admin-login-brand-name"
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
          className="admin-login-brand-subtitle"
          style={{
            color: "#A0A0A0",
            fontSize: 13,
            marginTop: 8,
            letterSpacing: 1,
          }}
        >
          Printing Services
        </Text>
      </section>

      {/* Right panel — form */}
      <section className="admin-login-form-panel">
        <div className="admin-login-form-container">
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
              color: "#A0A0A0",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            Ops / Super Admin / Supplier only. Clients and riders use the mobile
            app.
          </Text>
          {/* <Text
            style={{
              display: "block",
              color: "#808080",
              fontSize: 12,
              marginBottom: 32,
            }}
          >
            Pilot: admin@ / superadmin@ / supplier@ gridgo.ph (seed password from
            server/.env)
          </Text> */}

          <Form
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label={<Text style={{ color: "#808080", fontSize: 12 }}>Email</Text>}
              rules={[{ required: true, message: "Email is required" }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#555" }} />}
                placeholder="admin@gridgo.ph"
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
      </section>
    </main>
  );
}
