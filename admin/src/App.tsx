import { Refine, Authenticated } from "@refinedev/core";
import {
  ThemedLayoutV2,
  ThemedTitleV2,
  useNotificationProvider,
  ErrorComponent,
} from "@refinedev/antd";
import routerProvider, {
  CatchAllNavigate,
  NavigateToResource,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import {
  ShoppingCartOutlined,
  DashboardOutlined,
} from "@ant-design/icons";

import { gridTheme } from "@/config/theme";
import { authProvider } from "@/providers/auth-provider";
import { gridDataProvider } from "@/providers/data-provider";
import { GridLogo } from "@/components/grid-logo";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrderList } from "@/pages/orders/list";
import { OrderShow } from "@/pages/orders/show";

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={gridTheme}>
        <AntdApp>
          <Refine
            dataProvider={gridDataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: {
                  label: "Dashboard",
                  icon: <DashboardOutlined />,
                },
              },
              {
                name: "admin/orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: {
                  label: "Orders",
                  icon: <ShoppingCartOutlined />,
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              title: {
                text: "GRID Admin",
                icon: <GridLogo size={24} />,
              },
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="auth-layout"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <ThemedLayoutV2
                      Title={({ collapsed }) => (
                        <ThemedTitleV2
                          collapsed={collapsed}
                          text="GRID Admin"
                          icon={<GridLogo size={collapsed ? 28 : 24} />}
                        />
                      )}
                    >
                      <Outlet />
                    </ThemedLayoutV2>
                  </Authenticated>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/orders">
                  <Route index element={<OrderList />} />
                  <Route path="show/:id" element={<OrderShow />} />
                </Route>
              </Route>

              <Route
                element={
                  <Authenticated
                    key="auth-login"
                    fallback={<Outlet />}
                  >
                    <NavigateToResource resource="dashboard" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="*" element={<ErrorComponent />} />
            </Routes>

            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
