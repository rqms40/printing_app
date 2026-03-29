# GRID Admin Dashboard Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Refine + Ant Design admin dashboard in `./admin` with JWT auth, dashboard KPIs, and full orders management.

**Architecture:** Vite + React 18 + TypeScript project using Refine's `@refinedev/antd` for UI and `@refinedev/simple-rest` for data provider (mock-ready, swappable to `@refinedev/nestjsx-crud` when backend is built). Ant Design 5 themed with GRID dark palette. Auth via JWT with admin-only role guard.

**Tech Stack:** Vite, React 18, TypeScript, Refine 4, Ant Design 5, @ant-design/charts, React Router 6

**Spec:** `docs/superpowers/specs/2026-03-30-refine-admin-phase1-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `admin/package.json` | Create | Dependencies and scripts |
| `admin/tsconfig.json` | Create | TypeScript config |
| `admin/vite.config.ts` | Create | Vite config |
| `admin/index.html` | Create | HTML entry point with GRID favicon |
| `admin/public/favicon.svg` | Copy | GRID 3x3 dot logo |
| `admin/src/main.tsx` | Create | Vite entry, render App |
| `admin/src/App.tsx` | Create | Refine shell with routes, providers, theme |
| `admin/src/config/theme.ts` | Create | Ant Design 5 GRID dark theme tokens |
| `admin/src/config/constants.ts` | Create | API_URL, pagination defaults |
| `admin/src/types/enums.ts` | Create | All enum union types |
| `admin/src/types/order.ts` | Create | Order, PaperSpecs, ThreeDSpecs, OrderStatusHistory |
| `admin/src/types/user.ts` | Create | User interface |
| `admin/src/types/driver.ts` | Create | DriverProfile interface |
| `admin/src/types/dashboard.ts` | Create | KPI, sales, volume response types |
| `admin/src/providers/auth-provider.ts` | Create | Refine AuthProvider (JWT) |
| `admin/src/providers/data-provider.ts` | Create | Data provider config + mock interceptor |
| `admin/src/providers/mock-data.ts` | Create | Mock responses for development |
| `admin/src/components/grid-logo.tsx` | Create | 3x3 dot SVG logo component |
| `admin/src/components/status-badge.tsx` | Create | Order status color-coded badge |
| `admin/src/components/kpi-card.tsx` | Create | Dashboard KPI card |
| `admin/src/pages/login/index.tsx` | Create | Login page |
| `admin/src/pages/dashboard/index.tsx` | Create | Dashboard with KPIs + charts |
| `admin/src/pages/orders/list.tsx` | Create | Orders table with tabs/search/pagination |
| `admin/src/pages/orders/show.tsx` | Create | Order detail with status/driver/audit |
| `admin/src/utils/format.ts` | Create | Currency, date, status label formatters |
| `admin/src/styles/global.css` | Create | Font imports + global resets |

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `admin/package.json`
- Create: `admin/tsconfig.json`
- Create: `admin/vite.config.ts`
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/styles/global.css`
- Copy: `admin/public/favicon.svg`

- [ ] **Step 1: Create `admin/package.json`**

```json
{
  "name": "grid-admin",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ant-design/charts": "^2.2.0",
    "@refinedev/antd": "^5.43.0",
    "@refinedev/core": "^4.54.0",
    "@refinedev/react-router": "^6.12.0",
    "@refinedev/simple-rest": "^5.0.8",
    "antd": "^5.22.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `admin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `admin/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
```

- [ ] **Step 4: Create `admin/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GRID Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `admin/src/styles/global.css`**

```css
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

body {
  margin: 0;
  background: #000000;
  font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
}

#root {
  min-height: 100vh;
}
```

- [ ] **Step 6: Create `admin/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "@refinedev/antd/dist/reset.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Copy favicon and create font placeholder**

```bash
cp web/favicon.svg admin/public/favicon.svg
mkdir -p admin/public/fonts
# Note: Satoshi font files (.woff2) need to be downloaded from https://www.fontshare.com/fonts/satoshi
# For now the CSS falls back to system fonts
```

- [ ] **Step 8: Install dependencies**

```bash
cd admin && npm install
```

- [ ] **Step 9: Commit**

```bash
git add admin/
git commit -m "feat(admin): scaffold Vite + React + TypeScript project"
```

---

### Task 2: Create TypeScript types and utility formatters

**Files:**
- Create: `admin/src/types/enums.ts`
- Create: `admin/src/types/order.ts`
- Create: `admin/src/types/user.ts`
- Create: `admin/src/types/driver.ts`
- Create: `admin/src/types/dashboard.ts`
- Create: `admin/src/utils/format.ts`

- [ ] **Step 1: Create `admin/src/types/enums.ts`**

```typescript
export type UserRole = "customer" | "driver" | "admin";

export type OrderStatus =
  | "order_placed"
  | "file_verified"
  | "file_declined"
  | "printing_in_progress"
  | "finishing_mounting"
  | "quality_checked"
  | "ready_for_dispatch"
  | "driver_assigned"
  | "picked_up"
  | "on_the_way"
  | "arrived_at_destination"
  | "delivered"
  | "completed_pickup"
  | "cancelled";

export type DeliveryStatus =
  | "assigned"
  | "accepted"
  | "declined"
  | "picked_up"
  | "on_the_way"
  | "arrived"
  | "delivered";

export type PaymentMethod = "gcash" | "maya" | "cod";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type VehicleType = "motorcycle" | "bicycle" | "car";

export type PaperSize =
  | "a1" | "a2" | "a3" | "a4" | "a5"
  | "twenty_by_thirty" | "custom";
export type ColorMode = "black_and_white" | "full_color";
export type MediaType = "glossy" | "matte";
export type PrintSides = "front_only" | "back_to_back";
export type Binding = "none" | "spiral" | "staple" | "premium";
export type Material3D = "pla" | "abs" | "petg";
export type FileFormat3D = "stl" | "obj" | "three_mf";

/** Valid next statuses for the order state machine */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  order_placed: ["file_verified", "file_declined", "cancelled"],
  file_verified: ["printing_in_progress", "cancelled"],
  file_declined: [],
  printing_in_progress: ["finishing_mounting"],
  finishing_mounting: ["quality_checked"],
  quality_checked: ["ready_for_dispatch"],
  ready_for_dispatch: ["driver_assigned", "completed_pickup"],
  driver_assigned: ["picked_up"],
  picked_up: ["on_the_way"],
  on_the_way: ["arrived_at_destination"],
  arrived_at_destination: ["delivered"],
  delivered: [],
  completed_pickup: [],
  cancelled: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_placed: "Order Placed",
  file_verified: "File Verified",
  file_declined: "File Declined",
  printing_in_progress: "Printing",
  finishing_mounting: "Finishing",
  quality_checked: "Quality Checked",
  ready_for_dispatch: "Ready for Dispatch",
  driver_assigned: "Driver Assigned",
  picked_up: "Picked Up",
  on_the_way: "On the Way",
  arrived_at_destination: "Arrived",
  delivered: "Delivered",
  completed_pickup: "Picked Up (Customer)",
  cancelled: "Cancelled",
};
```

- [ ] **Step 2: Create `admin/src/types/order.ts`**

```typescript
import type {
  OrderStatus, PaymentMethod, PaymentStatus,
  PaperSize, ColorMode, MediaType, PrintSides, Binding,
  FileFormat3D, Material3D,
} from "./enums";

export interface PaperSpecs {
  paper_size: PaperSize;
  color_mode: ColorMode;
  media_type: MediaType;
  print_sides: PrintSides;
  binding: Binding;
}

export interface ThreeDSpecs {
  file_format: FileFormat3D;
  material: Material3D;
  color: string;
  infill_percentage: number;
  layer_height: number;
  supports: boolean;
  notes?: string;
}

export interface Order {
  id: string;
  order_id: string;
  user_id: string;
  category: "paper" | "3d";
  file_url?: string;
  file_name?: string;
  paper_specs?: PaperSpecs;
  three_d_specs?: ThreeDSpecs;
  quantity: number;
  total_price: number;
  delivery_fee: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  decline_reason?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  delivery_option: "pickup" | "delivery";
  delivery_address_id?: string;
  assigned_driver_id?: string;
  estimated_completion_at?: string;
  admin_notes?: string;
  tracking_link?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  changed_by_user_id?: string;
  notes?: string;
  created_at: string;
}
```

- [ ] **Step 3: Create `admin/src/types/user.ts`**

```typescript
import type { UserRole } from "./enums";

export interface User {
  id: string;
  uid: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  gender?: string;
  date_of_birth?: string;
  role: UserRole;
  is_profile_complete: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Create `admin/src/types/driver.ts`**

```typescript
import type { VehicleType } from "./enums";

export interface DriverProfile {
  id: string;
  user_id: string;
  full_name?: string;
  vehicle_type: VehicleType;
  plate_number?: string;
  license_number?: string;
  is_available: boolean;
  last_latitude?: number;
  last_longitude?: number;
  last_location_update?: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 5: Create `admin/src/types/dashboard.ts`**

```typescript
export interface DashboardKPIs {
  new_orders_count: number;
  in_production_count: number;
  ready_for_pickup_count: number;
  delivered_count: number;
  monthly_revenue: number;
}

export interface ChartDataPoint {
  month: string;
  value: number;
}
```

- [ ] **Step 6: Create `admin/src/utils/format.ts`**

```typescript
import type { OrderStatus } from "@/types/enums";
import { ORDER_STATUS_LABELS } from "@/types/enums";

export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}
```

- [ ] **Step 7: Commit**

```bash
git add admin/src/types/ admin/src/utils/
git commit -m "feat(admin): add TypeScript types and utility formatters"
```

---

### Task 3: Create theme config and shared components

**Files:**
- Create: `admin/src/config/theme.ts`
- Create: `admin/src/config/constants.ts`
- Create: `admin/src/components/grid-logo.tsx`
- Create: `admin/src/components/status-badge.tsx`
- Create: `admin/src/components/kpi-card.tsx`

- [ ] **Step 1: Create `admin/src/config/theme.ts`**

```typescript
import { theme } from "antd";
import type { ThemeConfig } from "antd";

export const gridTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#FFDE58",
    colorBgBase: "#000000",
    colorBgContainer: "#141414",
    colorBgElevated: "#1E1E1E",
    colorText: "#F0F0F0",
    colorTextSecondary: "#808080",
    colorBorder: "#2E2E2E",
    colorSuccess: "#66BB6A",
    colorError: "#EF5350",
    colorWarning: "#FFCA28",
    colorInfo: "#42A5F5",
    fontFamily: "'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 8,
  },
  components: {
    Layout: {
      siderBg: "#0A0A0A",
      headerBg: "#0A0A0A",
      bodyBg: "#000000",
    },
    Menu: {
      darkItemBg: "#0A0A0A",
      darkItemSelectedBg: "#1E1E1E",
      darkItemSelectedColor: "#FFDE58",
    },
    Table: {
      headerBg: "#0A0A0A",
      rowHoverBg: "#1A1A1A",
    },
    Card: {
      colorBgContainer: "#141414",
    },
  },
};
```

- [ ] **Step 2: Create `admin/src/config/constants.ts`**

```typescript
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
export const PAGE_SIZE = 20;
```

- [ ] **Step 3: Create `admin/src/components/grid-logo.tsx`**

```tsx
interface GridLogoProps {
  size?: number;
}

export function GridLogo({ size = 32 }: GridLogoProps) {
  const dot = size / 4.8;
  const gap = size / 6;
  const offset = (i: number) => dot / 2 + i * (dot + gap);

  const colors = [
    ["#F0F0F0", "#F0F0F0", "#FFDE58"],
    ["#F0F0F0", "#F0F0F0", "#F0F0F0"],
    ["#F0F0F0", "#F0F0F0", "#5B5B5B"],
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {colors.map((row, r) =>
        row.map((fill, c) => (
          <circle
            key={`${r}-${c}`}
            cx={offset(c)}
            cy={offset(r)}
            r={dot / 2}
            fill={fill}
          />
        )),
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Create `admin/src/components/status-badge.tsx`**

```tsx
import { Tag } from "antd";
import type { OrderStatus } from "@/types/enums";
import { statusLabel } from "@/utils/format";

const STATUS_COLORS: Record<OrderStatus, string> = {
  order_placed: "blue",
  file_verified: "blue",
  file_declined: "red",
  printing_in_progress: "orange",
  finishing_mounting: "orange",
  quality_checked: "orange",
  ready_for_dispatch: "cyan",
  driver_assigned: "cyan",
  picked_up: "gold",
  on_the_way: "gold",
  arrived_at_destination: "gold",
  delivered: "green",
  completed_pickup: "green",
  cancelled: "red",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Tag color={STATUS_COLORS[status]}>{statusLabel(status)}</Tag>;
}
```

- [ ] **Step 5: Create `admin/src/components/kpi-card.tsx`**

```tsx
import { Card, Statistic } from "antd";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  color?: string;
}

export function KpiCard({ title, value, prefix, color }: KpiCardProps) {
  return (
    <Card
      style={{
        borderLeft: `3px solid ${color ?? "#FFDE58"}`,
        background: "#141414",
      }}
    >
      <Statistic
        title={<span style={{ color: "#808080" }}>{title}</span>}
        value={value}
        prefix={prefix}
        valueStyle={{ color: "#F0F0F0", fontFamily: "Satoshi" }}
      />
    </Card>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add admin/src/config/ admin/src/components/
git commit -m "feat(admin): add GRID theme, logo, status badge, KPI card"
```

---

### Task 4: Create auth provider and mock data

**Files:**
- Create: `admin/src/providers/auth-provider.ts`
- Create: `admin/src/providers/data-provider.ts`
- Create: `admin/src/providers/mock-data.ts`

- [ ] **Step 1: Create `admin/src/providers/auth-provider.ts`**

```typescript
import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "@/config/constants";

const TOKEN_KEY = "grid_admin_token";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: { name: "Login Failed", message: "Invalid email or password" },
        };
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      return { success: true, redirectTo: "/" };
    } catch {
      // Dev mode: allow mock login
      if (email === "admin@grid.ph" && password === "admin123") {
        localStorage.setItem(TOKEN_KEY, "mock-jwt-token");
        return { success: true, redirectTo: "/" };
      }
      return {
        success: false,
        error: { name: "Login Failed", message: "Cannot reach server" },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }

    // Dev mode: accept mock token
    if (token === "mock-jwt-token") {
      return { authenticated: true };
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        return { authenticated: false, redirectTo: "/login" };
      }

      const user = await response.json();
      if (user.role !== "admin") {
        localStorage.removeItem(TOKEN_KEY);
        return {
          authenticated: false,
          redirectTo: "/login",
          error: { name: "Forbidden", message: "Admin access only" },
        };
      }

      return { authenticated: true };
    } catch {
      return { authenticated: true }; // offline tolerance for dev
    }
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Dev mode mock
    if (token === "mock-jwt-token") {
      return { id: "1", name: "Admin User", email: "admin@grid.ph" };
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return { id: "1", name: "Admin User", email: "admin@grid.ph" };
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true };
    }
    return { error };
  },
};
```

- [ ] **Step 2: Create `admin/src/providers/mock-data.ts`**

```typescript
import type { DashboardKPIs, ChartDataPoint } from "@/types/dashboard";
import type { Order } from "@/types/order";
import type { DriverProfile } from "@/types/driver";

export const mockKPIs: DashboardKPIs = {
  new_orders_count: 5,
  in_production_count: 3,
  ready_for_pickup_count: 2,
  delivered_count: 128,
  monthly_revenue: 45200,
};

export const mockSalesData: ChartDataPoint[] = [
  { month: "Oct", value: 32000 },
  { month: "Nov", value: 38500 },
  { month: "Dec", value: 41000 },
  { month: "Jan", value: 35200 },
  { month: "Feb", value: 42800 },
  { month: "Mar", value: 45200 },
];

export const mockVolumeData: ChartDataPoint[] = [
  { month: "Oct", value: 85 },
  { month: "Nov", value: 102 },
  { month: "Dec", value: 115 },
  { month: "Jan", value: 94 },
  { month: "Feb", value: 110 },
  { month: "Mar", value: 128 },
];

export const mockOrders: Order[] = [
  {
    id: "1",
    order_id: "ORD-00147",
    user_id: "usr_001",
    category: "paper",
    file_name: "thesis_final.pdf",
    file_url: "https://storage.grid.ph/files/thesis_final.pdf",
    paper_specs: {
      paper_size: "a4",
      color_mode: "full_color",
      media_type: "matte",
      print_sides: "back_to_back",
      binding: "spiral",
    },
    quantity: 3,
    total_price: 450,
    delivery_fee: 50,
    payment_method: "gcash",
    payment_status: "paid",
    order_status: "printing_in_progress",
    delivery_option: "delivery",
    delivery_address_id: "addr_001",
    estimated_completion_at: "2026-03-31T14:00:00Z",
    admin_notes: "Rush order — customer needs by Friday",
    created_at: "2026-03-28T09:15:00Z",
    updated_at: "2026-03-29T11:30:00Z",
  },
  {
    id: "2",
    order_id: "ORD-00148",
    user_id: "usr_002",
    category: "3d",
    file_name: "figurine_v3.stl",
    three_d_specs: {
      file_format: "stl",
      material: "pla",
      color: "White",
      infill_percentage: 20,
      layer_height: 0.2,
      supports: true,
      notes: "Please orient upright",
    },
    quantity: 1,
    total_price: 1200,
    delivery_fee: 0,
    payment_method: "cod",
    payment_status: "pending",
    order_status: "order_placed",
    delivery_option: "pickup",
    created_at: "2026-03-29T15:45:00Z",
    updated_at: "2026-03-29T15:45:00Z",
  },
  {
    id: "3",
    order_id: "ORD-00149",
    user_id: "usr_003",
    category: "paper",
    file_name: "poster_design.pdf",
    paper_specs: {
      paper_size: "a1",
      color_mode: "full_color",
      media_type: "glossy",
      print_sides: "front_only",
      binding: "none",
    },
    quantity: 5,
    total_price: 2500,
    delivery_fee: 80,
    payment_method: "maya",
    payment_status: "paid",
    order_status: "ready_for_dispatch",
    delivery_option: "delivery",
    assigned_driver_id: null,
    created_at: "2026-03-27T08:00:00Z",
    updated_at: "2026-03-29T16:00:00Z",
  },
  {
    id: "4",
    order_id: "ORD-00150",
    user_id: "usr_001",
    category: "paper",
    file_name: "flyers_batch.pdf",
    paper_specs: {
      paper_size: "a5",
      color_mode: "full_color",
      media_type: "glossy",
      print_sides: "front_only",
      binding: "none",
    },
    quantity: 100,
    total_price: 3500,
    delivery_fee: 100,
    payment_method: "gcash",
    payment_status: "paid",
    order_status: "delivered",
    delivery_option: "delivery",
    assigned_driver_id: "drv_001",
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-25T14:00:00Z",
  },
  {
    id: "5",
    order_id: "ORD-00151",
    user_id: "usr_004",
    category: "paper",
    file_name: "business_cards.pdf",
    paper_specs: {
      paper_size: "custom",
      color_mode: "full_color",
      media_type: "matte",
      print_sides: "back_to_back",
      binding: "none",
    },
    quantity: 200,
    total_price: 1800,
    delivery_fee: 50,
    payment_method: "cod",
    payment_status: "pending",
    order_status: "file_verified",
    delivery_option: "delivery",
    created_at: "2026-03-29T18:00:00Z",
    updated_at: "2026-03-29T18:30:00Z",
  },
];

export const mockDrivers: DriverProfile[] = [
  {
    id: "drv_001",
    user_id: "usr_010",
    full_name: "Juan Reyes",
    vehicle_type: "motorcycle",
    plate_number: "ABC-1234",
    is_available: true,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-03-29T10:00:00Z",
  },
  {
    id: "drv_002",
    user_id: "usr_011",
    full_name: "Marco dela Cruz",
    vehicle_type: "motorcycle",
    plate_number: "XYZ-5678",
    is_available: true,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-03-29T09:00:00Z",
  },
  {
    id: "drv_003",
    user_id: "usr_012",
    full_name: "Carlos Santos",
    vehicle_type: "car",
    plate_number: "DEF-9012",
    is_available: false,
    created_at: "2026-02-20T00:00:00Z",
    updated_at: "2026-03-29T08:00:00Z",
  },
];

export const mockStatusHistory = [
  {
    id: "h1",
    order_id: "1",
    from_status: "order_placed",
    to_status: "file_verified",
    changed_by_user_id: "admin_001",
    notes: "File looks good",
    created_at: "2026-03-28T10:00:00Z",
  },
  {
    id: "h2",
    order_id: "1",
    from_status: "file_verified",
    to_status: "printing_in_progress",
    changed_by_user_id: "admin_001",
    created_at: "2026-03-29T11:30:00Z",
  },
];
```

- [ ] **Step 3: Create `admin/src/providers/data-provider.ts`**

```typescript
import dataProvider from "@refinedev/simple-rest";
import { API_URL } from "@/config/constants";

const TOKEN_KEY = "grid_admin_token";

// Custom fetch that injects the JWT token
const httpClient = (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...options, headers });
};

// For now, use simple-rest provider pointing at API_URL.
// When NestJS backend is ready, swap to:
//   import nestjsDataProvider from "@refinedev/nestjsx-crud";
//   export const gridDataProvider = nestjsDataProvider(API_URL, httpClient);
export const gridDataProvider = dataProvider(API_URL, httpClient);
```

- [ ] **Step 4: Commit**

```bash
git add admin/src/providers/
git commit -m "feat(admin): add auth provider, data provider, mock data"
```

---

### Task 5: Create login page

**Files:**
- Create: `admin/src/pages/login/index.tsx`

- [ ] **Step 1: Create `admin/src/pages/login/index.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/login/
git commit -m "feat(admin): add login page with GRID branding"
```

---

### Task 6: Create dashboard page with KPIs and charts

**Files:**
- Create: `admin/src/pages/dashboard/index.tsx`

- [ ] **Step 1: Create `admin/src/pages/dashboard/index.tsx`**

```tsx
import { Row, Col, Card, Typography } from "antd";
import {
  ShoppingCartOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CarOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency } from "@/utils/format";
import { mockKPIs, mockSalesData, mockVolumeData } from "@/providers/mock-data";
import { Line, Column } from "@ant-design/charts";

const { Title } = Typography;

export function DashboardPage() {
  // TODO: Replace with useCustom() when backend is ready
  const kpis = mockKPIs;
  const salesData = mockSalesData;
  const volumeData = mockVolumeData;

  const lineConfig = {
    data: salesData,
    xField: "month",
    yField: "value",
    color: "#FFDE58",
    smooth: true,
    height: 300,
    theme: "classicDark",
    axis: {
      y: { labelFormatter: (v: number) => `₱${(v / 1000).toFixed(0)}k` },
    },
  };

  const barConfig = {
    data: volumeData,
    xField: "month",
    yField: "value",
    color: "#5B5B5B",
    height: 300,
    theme: "classicDark",
    style: {
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
  };

  return (
    <div>
      <Title level={3} style={{ color: "#F0F0F0", marginBottom: 24 }}>
        Dashboard
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <KpiCard
            title="New Orders"
            value={kpis.new_orders_count}
            prefix={<ShoppingCartOutlined />}
            color="#42A5F5"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="In Production"
            value={kpis.in_production_count}
            prefix={<ToolOutlined />}
            color="#FFCA28"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Ready for Pickup"
            value={kpis.ready_for_pickup_count}
            prefix={<CheckCircleOutlined />}
            color="#66BB6A"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Delivered"
            value={kpis.delivered_count}
            prefix={<CarOutlined />}
            color="#66BB6A"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Monthly Revenue"
            value={formatCurrency(kpis.monthly_revenue)}
            prefix={<DollarOutlined />}
            color="#FFDE58"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Sales Trend (6 months)" style={{ background: "#141414" }}>
            <Line {...lineConfig} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Order Volume (6 months)" style={{ background: "#141414" }}>
            <Column {...barConfig} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/dashboard/
git commit -m "feat(admin): add dashboard page with KPI cards and charts"
```

---

### Task 7: Create orders list page

**Files:**
- Create: `admin/src/pages/orders/list.tsx`

- [ ] **Step 1: Create `admin/src/pages/orders/list.tsx`**

```tsx
import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Input, Radio, Space, Badge } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { mockOrders } from "@/providers/mock-data";

type TabFilter = "new" | "production" | "done" | "all";

const TAB_STATUSES: Record<TabFilter, OrderStatus[] | null> = {
  new: ["order_placed", "file_verified"],
  production: ["printing_in_progress", "finishing_mounting", "quality_checked"],
  done: ["delivered", "completed_pickup"],
  all: null,
};

export function OrderList() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  // TODO: Replace with useTable when backend is ready
  // const { tableProps } = useTable<Order>({
  //   resource: "admin/orders",
  //   pagination: { pageSize: 20 },
  //   syncWithLocation: true,
  // });

  // Mock filtering
  let filtered = mockOrders;
  const tabStatuses = TAB_STATUSES[activeTab];
  if (tabStatuses) {
    filtered = filtered.filter((o) => tabStatuses.includes(o.order_status));
  }
  if (search) {
    filtered = filtered.filter((o) =>
      o.order_id.toLowerCase().includes(search.toLowerCase()),
    );
  }

  // Tab counts
  const counts = {
    new: mockOrders.filter((o) => TAB_STATUSES.new!.includes(o.order_status)).length,
    production: mockOrders.filter((o) => TAB_STATUSES.production!.includes(o.order_status)).length,
    done: mockOrders.filter((o) => TAB_STATUSES.done!.includes(o.order_status)).length,
    all: mockOrders.length,
  };

  return (
    <List title="Orders">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <Radio.Group
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="new">
              New <Badge count={counts.new} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="production">
              Production <Badge count={counts.production} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="done">
              Done <Badge count={counts.done} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="all">
              All <Badge count={counts.all} style={{ marginLeft: 4 }} />
            </Radio.Button>
          </Radio.Group>

          <Input
            placeholder="Search by Order ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: false }}
        >
          <Table.Column
            dataIndex="order_id"
            title="Order ID"
            render={(v: string) => (
              <span style={{ fontFamily: "monospace" }}>{v}</span>
            )}
          />
          <Table.Column
            dataIndex="category"
            title="Category"
            render={(v: string) => v === "paper" ? "Paper" : "3D"}
          />
          <Table.Column
            dataIndex="order_status"
            title="Status"
            render={(status: OrderStatus) => <StatusBadge status={status} />}
          />
          <Table.Column
            dataIndex="total_price"
            title="Price"
            render={(v: number) => formatCurrency(v)}
            sorter={(a: Order, b: Order) => a.total_price - b.total_price}
          />
          <Table.Column
            dataIndex="payment_status"
            title="Payment"
            render={(v: string) => (
              <span style={{ textTransform: "capitalize" }}>{v}</span>
            )}
          />
          <Table.Column
            dataIndex="created_at"
            title="Date"
            render={(v: string) => formatRelativeTime(v)}
            sorter={(a: Order, b: Order) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
          <Table.Column
            title="Actions"
            render={(_, record: Order) => (
              <ShowButton hideText size="small" recordItemId={record.id} />
            )}
          />
        </Table>
      </Space>
    </List>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/orders/list.tsx
git commit -m "feat(admin): add orders list page with tabs, search, table"
```

---

### Task 8: Create order detail (show) page

**Files:**
- Create: `admin/src/pages/orders/show.tsx`

- [ ] **Step 1: Create `admin/src/pages/orders/show.tsx`**

```tsx
import { Show } from "@refinedev/antd";
import {
  Card, Descriptions, Typography, Button, Select, Modal,
  Input, Table, Space, DatePicker, message, Row, Col, Timeline,
} from "antd";
import {
  ExclamationCircleOutlined,
  UserSwitchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router";
import { useState } from "react";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_LABELS,
} from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import {
  formatCurrency,
  formatDateTime,
  statusLabel,
} from "@/utils/format";
import {
  mockOrders,
  mockDrivers,
  mockStatusHistory,
} from "@/providers/mock-data";

const { Title, Text } = Typography;
const { TextArea } = Input;

export function OrderShow() {
  const { id } = useParams<{ id: string }>();
  const order = mockOrders.find((o) => o.id === id);
  const history = mockStatusHistory.filter((h) => h.order_id === id);
  const availableDrivers = mockDrivers.filter((d) => d.is_available);

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  if (!order) {
    return <Show title="Order Not Found"><Text>Order not found.</Text></Show>;
  }

  const validNextStatuses = ORDER_STATUS_TRANSITIONS[order.order_status];
  const canAssignDriver =
    order.order_status === "ready_for_dispatch" ||
    order.order_status === "driver_assigned";

  const handleStatusChange = (newStatus: OrderStatus) => {
    Modal.confirm({
      title: "Update Status",
      icon: <ExclamationCircleOutlined />,
      content: `Change status to "${statusLabel(newStatus)}"?`,
      onOk: () => {
        // TODO: PATCH /api/admin/orders/:id/status
        message.success(`Status updated to ${statusLabel(newStatus)}`);
      },
    });
  };

  const handleAssignDriver = (driverId: string) => {
    // TODO: POST /api/admin/orders/:id/assign
    message.success("Driver assigned");
    setDriverModalOpen(false);
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      message.error("Please provide a reason");
      return;
    }
    // TODO: PATCH /api/admin/orders/:id/status with file_declined + reason
    message.success("Order declined");
    setDeclineModalOpen(false);
    setDeclineReason("");
  };

  return (
    <Show title={`Order ${order.order_id}`}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <Card>
          <Row justify="space-between" align="middle">
            <Col>
              <Space size="middle">
                <StatusBadge status={order.order_status} />
                <Text style={{ textTransform: "capitalize" }}>
                  {order.category === "paper" ? "Paper Printing" : "3D Printing"}
                </Text>
              </Space>
            </Col>
            <Col>
              <Space>
                {validNextStatuses.length > 0 && (
                  <Select
                    placeholder="Update Status"
                    style={{ width: 200 }}
                    onChange={handleStatusChange}
                    options={validNextStatuses.map((s) => ({
                      label: ORDER_STATUS_LABELS[s],
                      value: s,
                    }))}
                  />
                )}
                {canAssignDriver && (
                  <Button
                    icon={<UserSwitchOutlined />}
                    onClick={() => setDriverModalOpen(true)}
                  >
                    Assign Driver
                  </Button>
                )}
                {order.order_status !== "cancelled" &&
                  order.order_status !== "delivered" &&
                  order.order_status !== "file_declined" && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setDeclineModalOpen(true)}
                    >
                      Decline
                    </Button>
                  )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Specs */}
        <Card title="Specifications">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="File">{order.file_name ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Quantity">{order.quantity}</Descriptions.Item>
            {order.paper_specs && (
              <>
                <Descriptions.Item label="Paper Size">{order.paper_specs.paper_size.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Color">{order.paper_specs.color_mode === "full_color" ? "Full Color" : "B&W"}</Descriptions.Item>
                <Descriptions.Item label="Media">{order.paper_specs.media_type}</Descriptions.Item>
                <Descriptions.Item label="Sides">{order.paper_specs.print_sides === "back_to_back" ? "Both Sides" : "Front Only"}</Descriptions.Item>
                <Descriptions.Item label="Binding">{order.paper_specs.binding}</Descriptions.Item>
              </>
            )}
            {order.three_d_specs && (
              <>
                <Descriptions.Item label="Format">{order.three_d_specs.file_format.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Material">{order.three_d_specs.material.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Color">{order.three_d_specs.color}</Descriptions.Item>
                <Descriptions.Item label="Infill">{order.three_d_specs.infill_percentage}%</Descriptions.Item>
                <Descriptions.Item label="Layer Height">{order.three_d_specs.layer_height}mm</Descriptions.Item>
                <Descriptions.Item label="Supports">{order.three_d_specs.supports ? "Yes" : "No"}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>

        {/* Price */}
        <Card title="Price Breakdown">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Subtotal">{formatCurrency(order.total_price)}</Descriptions.Item>
            <Descriptions.Item label="Delivery Fee">{formatCurrency(order.delivery_fee)}</Descriptions.Item>
            <Descriptions.Item label="Total">{formatCurrency(order.total_price + order.delivery_fee)}</Descriptions.Item>
            <Descriptions.Item label="Payment Method" style={{ textTransform: "uppercase" }}>{order.payment_method}</Descriptions.Item>
            <Descriptions.Item label="Payment Status" style={{ textTransform: "capitalize" }}>{order.payment_status}</Descriptions.Item>
            <Descriptions.Item label="Delivery">{order.delivery_option === "delivery" ? "Delivery" : "Pickup"}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Admin Notes */}
        <Card title="Admin Notes">
          <TextArea
            rows={3}
            defaultValue={order.admin_notes ?? ""}
            placeholder="Internal notes (not visible to customer)..."
            onBlur={(e) => {
              // TODO: PATCH /api/admin/orders/:id with admin_notes
              if (e.target.value !== (order.admin_notes ?? "")) {
                message.success("Notes saved");
              }
            }}
          />
        </Card>

        {/* Status History */}
        <Card title="Status History">
          {history.length === 0 ? (
            <Text type="secondary">No status changes recorded yet.</Text>
          ) : (
            <Timeline
              items={history.map((h) => ({
                children: (
                  <div>
                    <Text strong>{statusLabel(h.from_status as OrderStatus)}</Text>
                    {" → "}
                    <Text strong>{statusLabel(h.to_status as OrderStatus)}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(h.created_at)}
                      {h.notes && ` — ${h.notes}`}
                    </Text>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </Space>

      {/* Driver Assignment Modal */}
      <Modal
        title="Assign Driver"
        open={driverModalOpen}
        onCancel={() => setDriverModalOpen(false)}
        footer={null}
      >
        <Table
          dataSource={availableDrivers}
          rowKey="id"
          pagination={false}
          size="small"
        >
          <Table.Column dataIndex="full_name" title="Name" />
          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            render={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <Table.Column dataIndex="plate_number" title="Plate" />
          <Table.Column
            title=""
            render={(_, record: { id: string }) => (
              <Button
                type="primary"
                size="small"
                onClick={() => handleAssignDriver(record.id)}
              >
                Assign
              </Button>
            )}
          />
        </Table>
      </Modal>

      {/* Decline Modal */}
      <Modal
        title="Decline Order"
        open={declineModalOpen}
        onOk={handleDecline}
        onCancel={() => {
          setDeclineModalOpen(false);
          setDeclineReason("");
        }}
        okText="Decline Order"
        okButtonProps={{ danger: true }}
      >
        <p>Provide a reason for declining this order. The customer will be notified.</p>
        <TextArea
          rows={3}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Reason for declining..."
        />
      </Modal>
    </Show>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/orders/show.tsx
git commit -m "feat(admin): add order detail page with status, driver assign, audit trail"
```

---

### Task 9: Wire up App.tsx with Refine, routes, and layout

**Files:**
- Create: `admin/src/App.tsx`

- [ ] **Step 1: Create `admin/src/App.tsx`**

```tsx
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
} from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
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
              {/* Authenticated routes */}
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

              {/* Login route */}
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

              {/* Catch-all */}
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
```

- [ ] **Step 2: Verify the app runs**

```bash
cd admin && npm run dev
```

Expected: App starts on `http://localhost:5173`, shows login page, mock credentials `admin@grid.ph` / `admin123` should log in and show dashboard + orders.

- [ ] **Step 3: Commit**

```bash
git add admin/src/App.tsx
git commit -m "feat(admin): wire up Refine app shell with routes, auth, layout"
```

---

### Task 10: Verify and final cleanup

- [ ] **Step 1: Run TypeScript check**

```bash
cd admin && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run dev server and verify all pages**

```bash
cd admin && npm run dev
```

Verify:
- Login page renders with GRID logo
- Mock login works (admin@grid.ph / admin123)
- Dashboard shows 5 KPI cards + 2 charts
- Sidebar has Dashboard and Orders links
- Orders list shows mock data with tabs and search
- Clicking an order shows the detail page with specs, price, status history
- Status dropdown shows valid next statuses
- Assign Driver button opens modal with available drivers
- Decline button opens modal with reason field

- [ ] **Step 3: Test build**

```bash
cd admin && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A admin/
git commit -m "feat(admin): GRID admin dashboard Phase 1 complete"
```
