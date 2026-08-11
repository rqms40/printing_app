import { Refine, Authenticated, useGetIdentity } from "@refinedev/core";
import {
  ThemedLayoutV2,
  useNotificationProvider,
  ErrorComponent,
} from "@refinedev/antd";
import routerProvider, {
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
} from "react-router-dom";
import { ConfigProvider, App as AntdApp, Spin } from "antd";
import {
  ShoppingCartOutlined,
  DashboardOutlined,
  CarOutlined,
  TruckOutlined,
  TeamOutlined,
  ShoppingOutlined,
  BellOutlined,
  AppstoreOutlined,
  MessageOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  FundOutlined,
  BankOutlined,
  ControlOutlined,
  DollarOutlined,
  CheckSquareOutlined,
  MoreOutlined,
  TrophyOutlined,
  CustomerServiceOutlined,
} from "@ant-design/icons";

import { gridTheme } from "@/config/theme";
import { authProvider } from "@/providers/auth-provider";
import { gridDataProvider } from "@/providers/data-provider";
import { GridLogo } from "@/components/grid-logo";
import { CustomHeader } from "@/components/header";
import { GridSider } from "@/components/grid-sider";
import { NotificationsProvider } from "@/context/notifications-context";
import { isSupplierRole } from "@/types/enums";
import type { AdminIdentity } from "@/utils/api-normalizers";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrderList } from "@/pages/orders/list";
import { OrderShow } from "@/pages/orders/show";
import { RiderList } from "@/pages/riders/list";
import { UserList } from "@/pages/users/list";
import { UserShow } from "@/pages/users/show";
import { ProductList } from "@/pages/products/list";
import { ProductOptionsPage } from "@/pages/products/options";
import { AddonList } from "@/pages/products-addons/list";
import { CreditRequestsPage } from "@/pages/credit-requests";
import { QrPaymentsPage } from "@/pages/qr-payments";
import { NotificationsPage } from "@/pages/notifications";
import { TamSurveyList } from "@/pages/tam-surveys/list";
import { TamSurveyShow } from "@/pages/tam-surveys/show";
import { DailyGridList } from "@/pages/daily-grid/list";
import { HomeFeedPage } from "@/pages/home-feed";
import { BetaModePage } from '@/pages/beta-mode';
import { ChatInboxPage } from "@/pages/chat";
import { DeliverySlotsTodayPage } from '@/pages/delivery-slots/today';
import { DeliverySlotTemplatesPage } from '@/pages/delivery-slots/templates';
import { ExternalDeliveriesPage } from '@/pages/external-deliveries';
import { DeliverySettingsPage } from '@/pages/admin-settings/delivery';
import { PrinterProfilePage } from '@/pages/admin-settings/printer';
import { QaQueuePage } from '@/pages/qa/queue';
import { QaWorkspacePage } from '@/pages/qa/workspace';
import { SupplierJobsListPage } from '@/pages/supplier/jobs-list';
import { SupplierJobShowPage } from '@/pages/supplier/job-show';
import { SupplierPayoutsListPage } from '@/pages/supplier/payouts-list';
import { SupplierSupportPage } from '@/pages/supplier/support';
import { SuperVerificationPage } from '@/pages/super/verification';
import { SuperZonesPage } from '@/pages/super/zones';
import { SuperAuditPage } from '@/pages/super/audit';
import { SuperFinancePage } from '@/pages/super/finance';
import { OpsClaimsPage } from '@/pages/ops/claims';
import { SupplierProfilesListPage } from '@/pages/suppliers/list';
import { SupplierProfileShowPage } from '@/pages/suppliers/show';
import { SupplierLeaderboardPage } from '@/pages/suppliers/leaderboard';

/** Home: ops dashboard or supplier jobs inbox. */
function RoleHomeRedirect() {
  const { data: identity, isLoading } = useGetIdentity<AdminIdentity>();
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (isSupplierRole(identity?.role)) {
    return <Navigate to="/supplier/jobs" replace />;
  }
  return <DashboardPage />;
}

/** Authenticated users hitting /login land on role home. */
function AuthenticatedHomeRedirect() {
  const { data: identity, isLoading } = useGetIdentity<AdminIdentity>();
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (isSupplierRole(identity?.role)) {
    return <Navigate to="/supplier/jobs" replace />;
  }
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
                name: "supplier-jobs",
                list: "/supplier/jobs",
                show: "/supplier/jobs/:id",
                meta: {
                  label: "Jobs",
                  icon: <ShopOutlined />,
                  /** Shown only for supplier role (filtered in GridSider). */
                  portal: "supplier",
                },
              },
              {
                name: "supplier-payouts",
                list: "/supplier/payouts",
                meta: {
                  label: "Payouts",
                  icon: <DollarOutlined />,
                  portal: "supplier",
                },
              },
              {
                name: "supplier-support",
                list: "/supplier/support",
                meta: {
                  label: "Support",
                  icon: <CustomerServiceOutlined />,
                  portal: "supplier",
                },
              },
              {
                name: "admin/orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: { label: "Orders", icon: <ShoppingCartOutlined /> },
              },
              {
                name: "checking",
                meta: { label: "Checking", icon: <CheckSquareOutlined /> },
              },
              {
                name: "ops-qa",
                list: "/qa",
                show: "/qa/workspace/:id",
                meta: { label: "QA Queue", parent: "checking" },
              },
              {
                name: "ops-claims",
                list: "/ops/claims",
                meta: { label: "Claims", parent: "checking" },
              },
              {
                name: "riders",
                list: "/riders",
                meta: { label: "Riders", icon: <CarOutlined /> },
              },
              {
                name: "suppliers-ops",
                meta: { label: "Suppliers", icon: <ShopOutlined /> },
              },
              {
                name: "supplier-profiles",
                list: "/suppliers",
                show: "/suppliers/show/:id",
                meta: {
                  label: "Profiles",
                  parent: "suppliers-ops",
                },
              },
              {
                name: "supplier-leaderboard",
                list: "/suppliers/leaderboard",
                meta: {
                  label: "Leaderboards",
                  icon: <TrophyOutlined />,
                  parent: "suppliers-ops",
                },
              },
              {
                name: 'delivery-slots',
                meta: { label: 'Delivery', icon: <TruckOutlined /> },
              },
              {
                name: 'delivery-slots-today',
                list: '/delivery-slots/today',
                meta: { label: "Today's Slots", parent: 'delivery-slots' },
              },
              {
                name: 'delivery-slots-templates',
                list: '/delivery-slots/templates',
                meta: { label: 'Slot Templates', parent: 'delivery-slots' },
              },
              {
                name: 'external-deliveries',
                list: '/external-deliveries',
                meta: { label: 'External Deliveries', parent: 'delivery-slots' },
              },
              {
                name: 'delivery-settings',
                list: '/settings/delivery',
                meta: { label: 'Delivery Settings', parent: 'delivery-slots' },
              },
              {
                name: "users",
                list: "/users",
                show: "/users/show/:id",
                meta: { label: "Users", icon: <TeamOutlined /> },
              },
              {
                name: "others",
                meta: { label: "Others", icon: <MoreOutlined /> },
              },
              {
                name: "credit-requests",
                list: "/credit-requests",
                meta: { label: "Pilot Credits", parent: "others" },
              },
              {
                name: "qr-payments",
                list: "/qr-payments",
                meta: {
                  label: "QR Payments",
                  parent: "others",
                  icon: <DollarOutlined />,
                },
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
              {
                name: "tam-surveys",
                list: "/tam-surveys",
                show: "/tam-surveys/show/:id",
                meta: { label: "Surveys", parent: "others" },
              },
              {
                name: "home-content",
                meta: { label: "Home Screen", icon: <AppstoreOutlined /> },
              },
              {
                name: "daily-grid",
                list: "/daily-grid",
                meta: { label: "Daily Grid", parent: "home-content" },
              },
              {
                name: "home-feed",
                list: "/home-feed",
                meta: { label: "Home Feed", parent: "home-content" },
              },
              {
                name: 'beta-mode',
                list: '/beta-mode',
                meta: { label: 'Beta Mode', parent: "others" },
              },
              {
                name: "chat",
                list: "/chat",
                meta: { label: "Support", icon: <MessageOutlined /> },
              },
              {
                name: "support-tickets",
              },
              {
                name: 'printer-profile',
                list: '/settings/printer',
                meta: { label: 'Printer Profile', parent: "others" },
              },
              {
                name: "super-admin",
                meta: {
                  label: "Super Admin",
                  icon: <ControlOutlined />,
                },
              },
              {
                name: "super-verification",
                list: "/super/verification",
                meta: {
                  label: "Verification",
                  icon: <SafetyCertificateOutlined />,
                  parent: "super-admin",
                },
              },
              {
                name: "super-zones",
                list: "/super/zones",
                meta: {
                  label: "Zones & Fees",
                  icon: <EnvironmentOutlined />,
                  parent: "super-admin",
                },
              },
              {
                name: "super-audit",
                list: "/super/audit",
                meta: {
                  label: "Health & Audit",
                  icon: <FundOutlined />,
                  parent: "super-admin",
                },
              },
              {
                name: "super-finance",
                list: "/super/finance",
                meta: {
                  label: "COD & Payouts",
                  icon: <BankOutlined />,
                  parent: "super-admin",
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              title: {
                text: "GRIDGO Admin",
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
                <Route index element={<RoleHomeRedirect />} />
                <Route path="/supplier/jobs">
                  <Route index element={<SupplierJobsListPage />} />
                  <Route path=":id" element={<SupplierJobShowPage />} />
                </Route>
                <Route path="/supplier/payouts" element={<SupplierPayoutsListPage />} />
                <Route path="/supplier/support" element={<SupplierSupportPage />} />
                <Route path="/orders">
                  <Route index element={<OrderList />} />
                  <Route path="show/:id" element={<OrderShow />} />
                </Route>
                <Route path="/qa">
                  <Route index element={<QaQueuePage />} />
                  <Route path="workspace/:id" element={<QaWorkspacePage />} />
                </Route>
                <Route path="/ops/claims" element={<OpsClaimsPage />} />
                <Route path="/riders" element={<RiderList />} />
                <Route path="/suppliers">
                  <Route index element={<SupplierProfilesListPage />} />
                  <Route path="leaderboard" element={<SupplierLeaderboardPage />} />
                  <Route path="show/:id" element={<SupplierProfileShowPage />} />
                </Route>
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
                <Route path="/qr-payments" element={<QrPaymentsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/tam-surveys">
                  <Route index element={<TamSurveyList />} />
                  <Route path="show/:id" element={<TamSurveyShow />} />
                </Route>
                <Route path="/daily-grid" element={<DailyGridList />} />
                <Route path="/home-feed" element={<HomeFeedPage />} />
                <Route path="/beta-mode" element={<BetaModePage />} />
                <Route path="/chat" element={<ChatInboxPage />} />
                <Route path="/delivery-slots/today" element={<DeliverySlotsTodayPage />} />
                <Route path="/delivery-slots/templates" element={<DeliverySlotTemplatesPage />} />
                <Route path="/external-deliveries" element={<ExternalDeliveriesPage />} />
                <Route path="/settings/delivery" element={<DeliverySettingsPage />} />
                <Route path="/settings/printer" element={<PrinterProfilePage />} />
                <Route path="/super/verification" element={<SuperVerificationPage />} />
                <Route path="/super/zones" element={<SuperZonesPage />} />
                <Route path="/super/audit" element={<SuperAuditPage />} />
                <Route path="/super/finance" element={<SuperFinancePage />} />
              </Route>

              <Route
                element={
                  <Authenticated
                    key="auth-login"
                    fallback={<Outlet />}
                  >
                    <AuthenticatedHomeRedirect />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="*" element={<ErrorComponent />} />
            </Routes>

            <UnsavedChangesNotifier />
            <DocumentTitleHandler handler={() => "GRIDGO Admin"} />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
