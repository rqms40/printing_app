import { AuthPage } from "@refinedev/antd";
import { GridLogo } from "@/components/grid-logo";

export function LoginPage() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#000000",
      }}
    >
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <GridLogo size={48} />
        <h1
          style={{
            color: "#F0F0F0",
            fontFamily: "Satoshi",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 4,
            marginTop: 12,
          }}
        >
          GRID ADMIN
        </h1>
      </div>
      <AuthPage
        type="login"
        formProps={{
          initialValues: {
            email: "admin@grid.ph",
            password: "admin123",
          },
        }}
        title={false}
        registerLink={false}
        forgotPasswordLink={false}
      />
    </div>
  );
}
