# GRID Admin Dashboard — Phase 1 Design Spec

## Overview

A web-based admin dashboard for the GRID printing service, built with Refine + Ant Design + Vite. Phase 1 covers project scaffolding, authentication, dashboard KPIs, and full orders management. Lives at `./admin` as a sibling to the Flutter mobile app.

## Scope

**In scope (Phase 1):**
- Project scaffolding (Vite + React 18 + TypeScript + Refine + Ant Design 5)
- GRID dark theme with brand tokens
- JWT authentication with admin-only role guard
- Dashboard page with 5 KPI cards + 2 charts
- Orders list with filtered tabs, search, server-side pagination
- Order detail with status updates, driver assignment, decline, ETA, admin notes, audit trail
- TypeScript interfaces matching all Dart models

**Out of scope (Phase 2+):**
- Driver management CRUD
- Product/service management and pricing configuration
- Analytics deep-dive pages
- Payment transaction history
- User management
- Notification management
- Audit log browsing page

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Build tool | Vite | ^6.x |
| Framework | React | ^18.x |
| Language | TypeScript | ^5.x |
| Admin framework | Refine | ^4.x |
| UI library | Ant Design | ^5.x |
| Refine UI integration | @refinedev/antd | ^5.x |
| Data provider | @refinedev/nestjsx-crud | ^5.x |
| Charts | @ant-design/charts | ^2.x |
| Routing | React Router v6 (via @refinedev/react-router) | ^6.x |
| Font | Satoshi (via @fontsource/satoshi or @font-face) | — |

## Project Structure

```
admin/
├── src/
│   ├── App.tsx                    # Refine app shell, routes, providers
│   ├── main.tsx                   # Vite entry point
│   ├── config/
│   │   ├── theme.ts               # Ant Design 5 GRID theme tokens
│   │   └── constants.ts           # API_URL, pagination defaults
│   ├── providers/
│   │   ├── auth-provider.ts       # JWT auth provider for Refine
│   │   └── data-provider.ts       # NestJSX CRUD data provider config
│   ├── types/
│   │   ├── order.ts               # Order, PaperSpecs, ThreeDSpecs interfaces
│   │   ├── user.ts                # User interface
│   │   ├── driver.ts              # DriverProfile interface
│   │   ├── delivery.ts            # DeliveryAssignment, LocationUpdate
│   │   ├── payment.ts             # PaymentTransaction interface
│   │   ├── notification.ts        # AppNotification interface
│   │   ├── address.ts             # Address interface
│   │   └── enums.ts               # All enum union types
│   ├── components/
│   │   ├── layout/
│   │   │   ├── grid-logo.tsx      # 3x3 dot logo SVG component
│   │   │   ├── sidebar.tsx        # Custom sidebar with GRID branding
│   │   │   └── header.tsx         # Top header with admin name + logout
│   │   ├── status-badge.tsx       # Order status color-coded badge
│   │   └── kpi-card.tsx           # Dashboard KPI card component
│   ├── pages/
│   │   ├── login/
│   │   │   └── index.tsx          # Login page with GRID branding
│   │   ├── dashboard/
│   │   │   ├── index.tsx          # Dashboard page with KPIs + charts
│   │   │   ├── sales-chart.tsx    # 6-month sales trend line chart
│   │   │   └── volume-chart.tsx   # 6-month order volume bar chart
│   │   └── orders/
│   │       ├── list.tsx           # Orders table with tabs, search, pagination
│   │       ├── show.tsx           # Order detail view
│   │       ├── status-picker.tsx  # Status update dropdown + confirm
│   │       ├── driver-assign-modal.tsx  # Driver selection modal
│   │       └── status-history.tsx # Audit trail table
│   └── utils/
│       └── format.ts              # Currency (PHP), date, status label formatters
├── public/
│   └── favicon.svg                # GRID 3x3 dot logo
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Theme & Branding

Ant Design 5 ConfigProvider theme — dark mode only:

```typescript
const gridTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#FFDE58',
    colorBgBase: '#000000',
    colorBgContainer: '#141414',
    colorBgElevated: '#1E1E1E',
    colorText: '#F0F0F0',
    colorTextSecondary: '#808080',
    colorBorder: '#2E2E2E',
    colorSuccess: '#66BB6A',
    colorError: '#EF5350',
    colorWarning: '#FFCA28',
    colorInfo: '#42A5F5',
    fontFamily: 'Satoshi, sans-serif',
    borderRadius: 8,
  },
};
```

- Dark mode only (matches GRID black brand)
- 3x3 dot logo in sidebar header with "GRID Admin" wordmark
- Satoshi font loaded via `@font-face` from local assets or Fontsource
- Yellow (`#FFDE58`) as the primary action color (buttons, links, active states)
- Status badge colors: same semantic tokens (success/error/warning/info) as the Flutter app

## Authentication

### Login Page
- Centered card on black background
- GRID 3x3 dot logo + "GRID Admin" title
- Email + password fields
- "Sign In" button (yellow primary)
- Error message display for invalid credentials

### Auth Provider (Refine `AuthProvider`)

```typescript
{
  login: async ({ email, password }) => {
    // POST /api/auth/login → { accessToken, user }
    // Store token in localStorage
    // Return success or error
  },
  logout: async () => {
    // Clear localStorage token
    // Redirect to /login
  },
  check: async () => {
    // GET /api/auth/me with Bearer token
    // If 401 or no token → redirect to /login
    // If user.role !== 'admin' → return error "Access Denied"
  },
  getIdentity: async () => {
    // GET /api/auth/me → return { name, email, avatar }
    // Used by Refine to show admin name in header
  },
}
```

- JWT stored in `localStorage` as `grid_admin_token`
- Sent via `Authorization: Bearer <token>` header on all API requests
- Role guard: only `role === 'admin'` passes `check()`

## Dashboard Page

### KPI Cards Row (5 cards)

| Card | Value Source | Color |
|------|-------------|-------|
| New Orders | `GET /api/admin/dashboard → newOrdersCount` | info |
| In Production | `→ inProductionCount` | warning |
| Ready for Pickup | `→ readyForPickupCount` | success |
| Delivered | `→ deliveredCount` | success |
| Monthly Revenue | `→ monthlyRevenue` (formatted as ₱XX,XXX) | brand yellow |

Each card: icon, label, large number, subtle background matching its color at 10% opacity.

### Charts Row (2 charts side by side)

**Sales Trend** (line chart):
- Source: `GET /api/admin/dashboard/sales → [{ month, value }]`
- 6-month PHP values
- Yellow line on dark background
- Using `@ant-design/charts` Line component

**Order Volume** (bar chart):
- Source: `GET /api/admin/dashboard/volume → [{ month, value }]`
- 6-month order counts
- Grey bars with yellow highlight on current month
- Using `@ant-design/charts` Column component

### Refresh
- Manual refresh button in page header
- Auto-refresh every 30 seconds via `setInterval` + React Query refetch

## Orders Resource

### Orders List Page (`/orders`)

**Table columns:**

| Column | Field | Render |
|--------|-------|--------|
| Order ID | `order_id` | Text, monospace |
| Category | `category` | "Paper" or "3D" tag |
| Status | `order_status` | Color-coded `<StatusBadge>` |
| Customer | `user_id` → related User `full_name` | Text |
| Price | `total_price` | ₱XX.XX formatted |
| Payment | `payment_status` | Badge |
| Date | `created_at` | Relative ("2h ago") or date |

**Filters:**
- Pill-style tab buttons above the table: New / Production / Done / All
  - New: `order_status IN (order_placed, file_verified)`
  - Production: `order_status IN (printing_in_progress, finishing_mounting, quality_checked)`
  - Done: `order_status IN (delivered, completed_pickup)`
  - All: no filter
- Search input: filters by `order_id` (contains)
- Each tab shows count badge

**Behavior:**
- Server-side pagination (20 per page)
- Server-side sorting by `created_at` (default desc), `total_price`
- Row click → navigate to `/orders/show/:id`
- Refine's `useTable` hook with `@refinedev/antd`

### Order Detail Page (`/orders/show/:id`)

**Layout:** Single-column, card-based sections

**Section 1: Header**
- Order ID (large), current status badge, category tag
- Action buttons row: "Update Status" (dropdown), "Assign Driver" (if applicable), "Decline" (danger)

**Section 2: Status Update**
- Ant Design Select dropdown with all valid next statuses (based on state machine)
- Confirmation modal before applying
- Calls `PATCH /api/admin/orders/:id/status` with `{ status: 'snake_case' }`

**Section 3: ETA**
- DatePicker for `estimated_completion_at`
- Saves on change

**Section 4: Driver Assignment**
- Button visible when status is `ready_for_dispatch` or `driver_assigned`
- Opens modal with table of available drivers (`is_available: true`)
  - Columns: Name, Vehicle Type, Plate Number
  - "Assign" button per row
- Calls `POST /api/admin/orders/:id/assign` with `{ driverId }`

**Section 5: Decline Order**
- Danger button, opens modal
- Required textarea for decline reason
- Sets status to `file_declined` with reason

**Section 6: Info Cards** (Ant Design Descriptions)
- Customer info: name, email, phone
- File info: file name, download link (if `file_url` exists)
- Specifications: PaperSpecs or ThreeDSpecs fields rendered as key-value pairs
- Price breakdown: subtotal, delivery fee, total, payment method, payment status
- Admin notes: editable TextArea, auto-saves on blur

**Section 7: Status History**
- Ant Design Timeline or Table
- Source: `GET /api/orders/:id/history`
- Columns: From Status → To Status, Changed By, Notes, Timestamp
- Chronological, newest first

## TypeScript Interfaces

All interfaces use snake_case field names (matching NestJS API JSON). One file per resource in `src/types/`.

### `src/types/enums.ts`

```typescript
export type UserRole = 'customer' | 'driver' | 'admin';

export type OrderStatus =
  | 'order_placed' | 'file_verified' | 'file_declined'
  | 'printing_in_progress' | 'finishing_mounting' | 'quality_checked'
  | 'ready_for_dispatch' | 'driver_assigned'
  | 'picked_up' | 'on_the_way' | 'arrived_at_destination'
  | 'delivered' | 'completed_pickup' | 'cancelled';

export type DeliveryStatus =
  | 'assigned' | 'accepted' | 'declined'
  | 'picked_up' | 'on_the_way' | 'arrived' | 'delivered';

export type PaymentMethod = 'gcash' | 'maya' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type VehicleType = 'motorcycle' | 'bicycle' | 'car';

export type PaperSize = 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'twenty_by_thirty' | 'custom';
export type ColorMode = 'black_and_white' | 'full_color';
export type MediaType = 'glossy' | 'matte';
export type PrintSides = 'front_only' | 'back_to_back';
export type Binding = 'none' | 'spiral' | 'staple' | 'premium';
export type Material3D = 'pla' | 'abs' | 'petg';
export type FileFormat3D = 'stl' | 'obj' | 'three_mf';
```

### `src/types/order.ts`

```typescript
import { OrderStatus, PaymentMethod, PaymentStatus } from './enums';

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
  category: 'paper' | '3d';
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
  delivery_option: 'pickup' | 'delivery';
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

### `src/types/user.ts`

```typescript
import { UserRole } from './enums';

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

### `src/types/driver.ts`

```typescript
import { VehicleType } from './enums';

export interface DriverProfile {
  id: string;
  user_id: string;
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

### Other types (`payment.ts`, `address.ts`, `notification.ts`, `delivery.ts`)

Follow the same pattern — mirror the Dart model fields in snake_case. Defined in Phase 1 for type completeness but used actively in Phases 2-3.

## API Endpoints (Phase 1)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Login, returns JWT + user |
| GET | `/api/auth/me` | Verify token, get current user |
| GET | `/api/admin/dashboard` | KPI stats |
| GET | `/api/admin/dashboard/sales` | 6-month sales trend data |
| GET | `/api/admin/dashboard/volume` | 6-month order volume data |
| GET | `/api/admin/orders` | List orders (filter, sort, paginate) |
| GET | `/api/admin/orders/:id` | Single order detail |
| PATCH | `/api/admin/orders/:id/status` | Update order status |
| PATCH | `/api/admin/orders/:id` | Update ETA, admin notes |
| POST | `/api/admin/orders/:id/assign` | Assign driver |
| GET | `/api/admin/drivers` | List drivers (for assignment modal) |
| GET | `/api/orders/:id/history` | Order status audit trail |

## Status Badge Colors

| Status Group | Statuses | Color |
|-------------|----------|-------|
| New | `order_placed`, `file_verified` | `info` (blue) |
| Declined | `file_declined` | `error` (red) |
| Production | `printing_in_progress`, `finishing_mounting`, `quality_checked` | `warning` (amber) |
| Dispatch | `ready_for_dispatch`, `driver_assigned` | `info` (blue) |
| In Transit | `picked_up`, `on_the_way`, `arrived_at_destination` | `brand` (yellow) |
| Complete | `delivered`, `completed_pickup` | `success` (green) |
| Cancelled | `cancelled` | `error` (red) |

## Order Status State Machine (valid transitions)

The status picker dropdown on order detail should only show valid next statuses:

```
order_placed       → file_verified, file_declined, cancelled
file_verified      → printing_in_progress, cancelled
printing_in_progress → finishing_mounting
finishing_mounting  → quality_checked
quality_checked    → ready_for_dispatch
ready_for_dispatch → driver_assigned (via assign action)
driver_assigned    → picked_up
picked_up          → on_the_way
on_the_way         → arrived_at_destination
arrived_at_destination → delivered
```

Alternative: `ready_for_dispatch` → `completed_pickup` (customer picks up, no driver)

## Backend Dependency Note

The NestJS backend is not built yet. Phase 1 scaffolds the admin dashboard with:
- Data provider configured to point at `http://localhost:3000/api` (ready for when NestJS is built)
- Mock data via Refine's `dataProvider` wrapper or a local JSON server for development
- All API endpoint paths and request/response shapes locked in per this spec so the NestJS backend can be built to match

When the NestJS backend is ready, the only change needed is removing the mock layer — the data provider, types, and UI are already wired correctly.

## Future Phases (out of scope for Phase 1)

**Phase 2:** Drivers management CRUD, product/service management, pricing configuration
**Phase 3:** Analytics charts page, payment transaction history, user management, notification management, audit log browsing
