import { useMemo, useState } from "react";
import { useGetIdentity, useMenu, useNavigation } from "@refinedev/core";
import type { ITreeMenu } from "@refinedev/core";
import { Button, ConfigProvider, Layout, Menu, Tag, theme } from "antd";
import type { MenuProps } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useNotificationsContext } from "@/context/notifications-context";
import { GridLogo } from "@/components/grid-logo";
import type { BadgeCounts } from "@/types/notification";
import { isSupplierRole, isSuperAdminRole } from "@/types/enums";
import type { AdminIdentity } from "@/utils/api-normalizers";

const BADGE_MAP: Partial<Record<string, keyof BadgeCounts>> = {
  "admin/orders": "newOrders",
  "credit-requests": "pendingTopUps",
  "qr-payments": "pendingQrPayments",
};

/** Resources exclusive to the supplier portal (not shown to ops). */
const SUPPLIER_PORTAL_RESOURCES = new Set([
  "supplier-jobs",
  "supplier-payouts",
  "supplier-support",
]);

/** Super Admin–only governance resources (hidden from ops_admin). */
const SUPER_ONLY_RESOURCES = new Set([
  "super-verification",
  "super-zones",
  "super-audit",
  "super-finance",
  "super-admin",
]);

interface GridSiderProps {
  initialCollapsed?: boolean;
}

type MenuRoleMode = "unknown" | "supplier" | "ops" | "super";

/**
 * Role-filter the Refine menu.
 * - unknown: default-deny — hide ops and supplier items until identity loads
 *   (avoids flashing full ops nav for suppliers during getIdentity).
 * - supplier: only supplier portal resources
 * - ops: non-supplier, non-super-only resources
 * - super: ops resources + super governance pages
 */
function filterMenuForRole(
  items: ITreeMenu[],
  mode: MenuRoleMode,
): ITreeMenu[] {
  if (mode === "unknown") return [];

  return items
    .map((item) => {
      const isSupplierRes = SUPPLIER_PORTAL_RESOURCES.has(item.name);
      const isSuperRes = SUPER_ONLY_RESOURCES.has(item.name);
      if (mode === "supplier") {
        if (isSupplierRes) return item;
        if (item.children?.length) {
          const children = filterMenuForRole(item.children, mode);
          if (children.length === 0) return null;
          return { ...item, children };
        }
        return null;
      }
      // Ops + Super: hide supplier portal
      if (isSupplierRes) return null;
      // Ops only: hide super-only resources
      if (mode === "ops" && isSuperRes) return null;
      if (item.children?.length) {
        const children = filterMenuForRole(item.children, mode);
        if (children.length === 0 && !item.list) return null;
        return { ...item, children };
      }
      return item;
    })
    .filter((item): item is ITreeMenu => item != null);
}

export function GridSider({ initialCollapsed = false }: GridSiderProps) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const { menuItems, selectedKey } = useMenu();
  const { push } = useNavigation();
  const { badgeCounts } = useNotificationsContext();
  const { data: identity, isLoading: identityLoading } =
    useGetIdentity<AdminIdentity>();
  const roleKnown = !identityLoading && identity?.role != null;
  const supplier = isSupplierRole(identity?.role);
  const superAdmin = isSuperAdminRole(identity?.role);
  const menuMode: MenuRoleMode = !roleKnown
    ? "unknown"
    : supplier
      ? "supplier"
      : superAdmin
        ? "super"
        : "ops";

  const visibleMenuItems = useMemo(
    () => filterMenuForRole(menuItems, menuMode),
    [menuItems, menuMode],
  );

  const defaultOpenKeys = visibleMenuItems
    .filter((item) => item.children?.some((child) => child.key === selectedKey))
    .map((item) => item.key)
    .filter((key): key is string => typeof key === "string");

  const brandLabel = !roleKnown
    ? "GRIDGO"
    : supplier
      ? "GRIDGO Supplier"
      : superAdmin
        ? "GRIDGO Super"
        : "GRIDGO Admin";

  function buildItems(items: ITreeMenu[]): MenuProps["items"] {
    return items.map((item) => {
      const badgeKey = BADGE_MAP[item.name];
      const count = badgeKey ? (badgeCounts[badgeKey] ?? 0) : 0;
      const isActive = item.key === selectedKey;

      const labelNode =
        !collapsed && count > 0 ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{item.label}</span>
            <Tag
              style={{
                // Invert when active so the pill stays visible on yellow bg
                backgroundColor: isActive ? "#141414" : "#FFDE58",
                color: isActive ? "#FFDE58" : "#141414",
                border: "none",
                marginLeft: 8,
                fontSize: 11,
                padding: "0 6px",
                lineHeight: "18px",
                minWidth: 22,
                textAlign: "center",
                borderRadius: 9,
              }}
            >
              {count}
            </Tag>
          </span>
        ) : (
          item.label
        );

      if (item.children && item.children.length > 0) {
        return {
          key: item.key,
          icon: item.icon,
          label: item.label,
          children: item.children.map((child) => ({
            key: child.key,
            icon: child.icon,
            label: child.label,
            onClick: () => push((child.list as string) ?? "/"),
          })),
        };
      }

      return {
        key: item.key,
        icon: item.icon,
        label: labelNode,
        onClick: () => push((item.list as string) ?? "/"),
      };
    }) as MenuProps["items"];
  }

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemSelectedBg: "#FFDE58",
            itemSelectedColor: "#141414",
            itemActiveBg: "#FFDE5833",
          },
        },
      }}
    >
      <Layout.Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        collapsedWidth={80}
        style={{
          background: token.colorBgElevated,
          borderRight: `1px solid ${token.colorBorder}`,
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Inner flex column so the trigger pins to the bottom */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Logo — custom title so text fades smoothly instead of blinking */}
          <div
            onClick={() => push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "18px 16px",
              flexShrink: 0,
              overflow: "hidden",
              cursor: "pointer",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <GridLogo size={24} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.02em",
                color: token.colorText,
                whiteSpace: "nowrap",
                overflow: "hidden",
                // Collapse: fade out immediately, then shrink
                // Expand: wait 0.12s for sider width to open, then fade in
                opacity: collapsed ? 0 : 1,
                maxWidth: collapsed ? 0 : 160,
                transition: collapsed
                  ? "opacity 0.1s, max-width 0.2s"
                  : "opacity 0.15s 0.12s, max-width 0.2s",
              }}
            >
              {brandLabel}
            </span>
          </div>

          {/* Scrollable menu area */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <Menu
              selectedKeys={[selectedKey]}
              defaultOpenKeys={defaultOpenKeys}
              mode="inline"
              items={buildItems(visibleMenuItems)}
              style={{ background: "transparent", border: "none" }}
            />
          </div>

          {/* Custom collapse trigger — bordered separator, no default blue */}
          <div
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${token.colorBorder}`,
            }}
          >
            <Button
              type="text"
              icon={
                collapsed ? (
                  <MenuUnfoldOutlined style={{ color: token.colorTextSecondary }} />
                ) : (
                  <MenuFoldOutlined style={{ color: token.colorTextSecondary }} />
                )
              }
              onClick={() => setCollapsed((c) => !c)}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 0,
              }}
            />
          </div>
        </div>
      </Layout.Sider>
    </ConfigProvider>
  );
}
