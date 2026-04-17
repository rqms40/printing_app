import { Refine, Authenticated } from "@refinedev/core";
import {
  ThemedLayoutV2,
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
  CarOutlined,
  TeamOutlined,
  ShoppingOutlined,
  WalletOutlined,
  BellOutlined,
} from "@ant-design/icons";

import { gridTheme } from "@/config/theme";
import { authProvider } from "@/providers/auth-provider";
import { gridDataProvider } from "@/providers/data-provider";
import { GridLogo } from "@/components/grid-logo";
import { CustomHeader } from "@/components/header";
import { GridSider } from "@/components/grid-sider";
import { NotificationsProvider } from "@/context/notifications-context";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrderList } from "@/pages/orders/list";
import { OrderShow } from "@/pages/orders/show";
import { DriverList } from "@/pages/drivers/list";
import { UserList } from "@/pages/users/list";
import { UserShow } from "@/pages/users/show";
import { ProductList } from "@/pages/products/list";
import { ProductOptionsPage } from "@/pages/products/options";
import { AddonList } from "@/pages/products-addons/list";
import { CreditRequestsPage } from "@/pages/credit-requests";
import { NotificationsPage } from "@/pages/notifications";

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
                meta: { label: "Dashboard", icon: <DashboardOutlined /> },
              },
              {
                name: "admin/orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: { label: "Orders", icon: <ShoppingCartOutlined /> },
              },
              {
                name: "drivers",
                list: "/drivers",
                meta: { label: "Drivers", icon: <CarOutlined /> },
              },
              {
                name: "users",
                list: "/users",
                show: "/users/show/:id",
                meta: { label: "Users", icon: <TeamOutlined /> },
              },
              {
                name: "credit-requests",
                list: "/credit-requests",
                meta: { label: "Top-Up Requests", icon: <WalletOutlined /> },
              },
              {
                name: "products",
                meta: { label: "Products", icon: <ShoppingOutlined /> },
              },
              {
                name: "products-categories",
                list: "/products",
                meta: { label: "Categories", parent: "products" },
              },
              {
                name: "products-addons",
                list: "/products-addons",
                meta: { label: "Addons", parent: "products" },
              },
              {
                name: "notifications",
                list: "/notifications",
                meta: { label: "Notifications", icon: <BellOutlined /> },
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
                    <NotificationsProvider>
                      <ThemedLayoutV2
                        Header={() => <CustomHeader />}
                        Sider={() => <GridSider />}
                      >
                        <Outlet />
                      </ThemedLayoutV2>
                    </NotificationsProvider>
                  </Authenticated>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="/orders">
                  <Route index element={<OrderList />} />
                  <Route path="show/:id" element={<OrderShow />} />
                </Route>
                <Route path="/drivers" element={<DriverList />} />
                <Route path="/users">
                  <Route index element={<UserList />} />
                  <Route path="show/:id" element={<UserShow />} />
                </Route>
                <Route path="/products">
                  <Route index element={<ProductList />} />
                  <Route path=":id/options" element={<ProductOptionsPage />} />
                </Route>
                <Route path="/products-addons" element={<AddonList />} />
                <Route path="/credit-requests" element={<CreditRequestsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
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
