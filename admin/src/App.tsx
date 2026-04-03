import { Refine, Authenticated } from "@refinedev/core";
import {
  ThemedLayoutV2,
  ThemedSiderV2,
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
  CarOutlined,
  TeamOutlined,
  ShoppingOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import { gridTheme } from "@/config/theme";
import { authProvider } from "@/providers/auth-provider";
import { gridDataProvider } from "@/providers/data-provider";
import { GridLogo } from "@/components/grid-logo";
import { CustomHeader } from "@/components/header";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrderList } from "@/pages/orders/list";
import { OrderShow } from "@/pages/orders/show";
import { DriverList } from "@/pages/drivers/list";
import { UserList } from "@/pages/users/list";
import { ProductList } from "@/pages/products/list";
import { ProductOptionsPage } from "@/pages/products/options";
import { AddonList } from "@/pages/products-addons/list";
import { CreditRequestsPage } from "@/pages/credit-requests";

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
              {
                name: "drivers",
                list: "/drivers",
                meta: {
                  label: "Drivers",
                  icon: <CarOutlined />,
                },
              },
              {
                name: "users",
                list: "/users",
                meta: {
                  label: "Users",
                  icon: <TeamOutlined />,
                },
              },
              {
                name: "credit-requests",
                list: "/credit-requests",
                meta: {
                  label: "Top-Up Requests",
                  icon: <WalletOutlined />,
                },
              },
              // "products" is a collapsible group only — no list route
              {
                name: "products",
                meta: {
                  label: "Products",
                  icon: <ShoppingOutlined />,
                },
              },
              // Children — no icons so ThemedSiderV2 won't render them
              {
                name: "products-categories",
                list: "/products",
                meta: {
                  label: "Categories",
                  parent: "products",
                },
              },
              {
                name: "products-addons",
                list: "/products-addons",
                meta: {
                  label: "Addons",
                  parent: "products",
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
                      Header={() => <CustomHeader />}
                      Sider={() => (
                        <ThemedSiderV2
                          fixed
                          Title={({ collapsed }) => (
                            <ThemedTitleV2
                              collapsed={collapsed}
                              text="GRID Admin"
                              icon={<GridLogo size={collapsed ? 28 : 24} />}
                            />
                          )}
                          render={({ items }) => <>{items}</>}
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
                <Route path="/drivers" element={<DriverList />} />
                <Route path="/users" element={<UserList />} />
                <Route path="/products">
                  <Route index element={<ProductList />} />
                  <Route path=":id/options" element={<ProductOptionsPage />} />
                </Route>
                <Route path="/products-addons" element={<AddonList />} />
                <Route path="/credit-requests" element={<CreditRequestsPage />} />
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
