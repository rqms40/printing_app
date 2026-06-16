# Admin Notification System — Design Spec

**Date:** 2026-04-10  
**Status:** Approved  
**Stack:** NestJS 11 / TypeORM (server) · React / Refine / Ant Design 5 (admin)

---

## 1. Overview

Add a persistent, real-time notification system to the GRIDGO admin dashboard. Every admin user (role = `admin`) receives in-app notifications for key business events. Notifications survive page refresh, are stored per-admin in the database, and are delivered instantly via WebSocket. Sidebar menu items show live counts of unactioned work items.

---

## 2. Scope

### In scope
- Bell icon in header with unread badge + dropdown panel (last 10)
- Full `/notifications` page with filter tabs and mark-as-read
- Sidebar live count pills: `Orders (N)` and `Top-Up Requests (N)`
- Server: `NotificationsGateway` (`/ws/notifications`) with JWT auth
- Server: `createForAllAdmins()` wired into orders, credits, auth services
- Server: `GET /admin/badge-counts` endpoint
- Fix existing gap: `rejectTopUp()` missing customer notification
- Notification `metadata` JSON column on existing `notifications` table

### Out of scope
- Email / SMS notifications
- Mobile push to admins (FCM to admin devices)
- Notification preferences / mute settings
- Pagination on `/notifications` page (50-item limit is sufficient now)
- Admin-to-admin messaging

---

## 3. UI Layout

### Header
```
┌─────────────────────────────────────────────────────────────────┐
│  GRIDGO Admin                              🔔³  [A] Admin User ▾  │
└─────────────────────────────────────────────────────────────────┘
```
Bell sits LEFT of the Avatar+Name dropdown. Badge shows count (red); shows dot when > 99.

### Bell Dropdown Panel
```
                    ┌────────────────────────────────┐
                    │ Notifications        Mark all ✓│
                    ├────────────────────────────────┤
                    │ 🛒 New order placed            │  ← unread (accent border + bg)
                    │    ORD-10042 · just now        │
                    ├────────────────────────────────┤
                    │ 💳 Top-up request received     │  ← unread
                    │    ₱500 · 2 min ago            │
                    ├────────────────────────────────┤
                    │   Order delivered              │  ← read (plain)
                    │   ORD-10039 · 1 hr ago         │
                    ├────────────────────────────────┤
                    │     View all notifications →   │
                    └────────────────────────────────┘
```
Shows last 10 notifications from the in-memory list (context holds 50). Empty state: bell icon + "You're all caught up".

### Sidebar
```
┌──────────────────────────┐
│  ■  Dashboard            │
│  🛒 Orders           ③   │  ← brand-yellow pill, hidden when 0
│  🚗 Riders              │
│  👥 Users                │
│  💳 Top-Up Requests  ①   │  ← hidden when 0
│  📦 Products             │
│  🔔 Notifications        │  ← new nav item
│                          │
│  [collapse ◀]            │
└──────────────────────────┘
```
Badges hidden when sidebar is collapsed.

### `/notifications` Page
```
┌─────────────────────────────────────────────────────────────────┐
│  Notifications                        [Mark all as read]        │
├─────────────────────────────────────────────────────────────────┤
│  [All] [Unread ③] [Orders] [Credits] [Users]                    │
├─────────────────────────────────────────────────────────────────┤
│ ▌ 🛒  New Order Placed                              just now    │
│ ▌     ORD-10042 — Tarp printing, ₱450                          │
├─────────────────────────────────────────────────────────────────┤
│ ▌ 💳  Top-Up Request Received                       2 min ago  │
│ ▌     user@email.com requested ₱500                            │
├─────────────────────────────────────────────────────────────────┤
│   ✅  Order Delivered                               1 hr ago   │
│       ORD-10039 completed delivery                              │
└─────────────────────────────────────────────────────────────────┘
```
Clicking a notification with `orderRef` → `/orders/show/:id`. Clicking a credit notification → `/credit-requests`. Marks item read on click. Visiting page marks all read after 1s.

---

## 4. Data Model

### Existing `notifications` table — one new column

| Column       | Type            | Notes                                      |
|-------------|----------------|--------------------------------------------|
| id          | PK int          | existing                                   |
| user_id     | FK → users      | existing — admin OR customer               |
| title       | varchar(255)    | existing                                   |
| message     | text            | existing                                   |
| type        | varchar(30)     | existing — see NotificationType below      |
| order_ref   | varchar(20) ?   | existing — e.g. "ORD-10042"                |
| is_read     | boolean         | existing, default false                    |
| created_at  | timestamp       | existing                                   |
| **metadata**| **jsonb ?**     | **NEW** — contextual payload per type      |

Migration: `ALTER TABLE notifications ADD COLUMN metadata jsonb NULL` — non-breaking.

### NotificationType constants
```
"order_placed"     "order_cancelled"   "order_declined"
"topup_request"    "topup_approved"    "topup_rejected"
"new_user"         "status_change"
```

### Metadata shape by type
```
order_placed   → { orderId, amount, category }
topup_request  → { transactionId, amountPhp, userEmail }
status_change  → { orderId, fromStatus, toStatus }
new_user       → { userId, email }
topup_rejected → { transactionId, amountCredits }
```

### Event → Notification mapping
| Event | Type | Recipients |
|-------|------|-----------|
| `OrdersService.create()` | `order_placed` | all admins |
| `OrdersService.updateStatus()` → `cancelled` | `order_cancelled` | all admins |
| `OrdersService.updateStatus()` → `file_declined` | `order_declined` | all admins |
| `CreditsService.requestTopUp()` | `topup_request` | all admins |
| `CreditsService.approveTopUp()` | `topup_approved` | customer ✅ (already done) |
| `CreditsService.rejectTopUp()` | `topup_rejected` | customer (fix gap) |
| `AuthService.register()` | `new_user` | all admins |

---

## 5. Server Architecture

### New / modified files
| File | Change |
|------|--------|
| `notifications/entities/notification.entity.ts` | Add `metadata` column |
| `notifications/notifications.service.ts` | Add `createForAllAdmins()` |
| `notifications/notifications.gateway.ts` | NEW — `/ws/notifications` WS gateway |
| `notifications/notifications.module.ts` | Add gateway, JwtModule, UsersModule |
| `admin/admin.controller.ts` | Add `GET /admin/badge-counts` |
| `admin/admin.module.ts` | Import CreditsModule for pendingTopUps count |
| `orders/orders.service.ts` | Wire `createForAllAdmins` on create/cancel/decline |
| `orders/orders.module.ts` | Import NotificationsModule |
| `credits/credits.service.ts` | Wire `topup_request` + fix `rejectTopUp` gap |
| `auth/auth.service.ts` | Wire `new_user` on register |
| `auth/auth.module.ts` | Import NotificationsModule |

### `NotificationsGateway` (`/ws/notifications`)
- Same JWT handshake pattern as `OrdersGateway`
- Admin connects → `client.join('admin_notifications')`
- Non-admin valid token → stays connected but does NOT join `admin_notifications` room (reserved for future customer mobile WS use)
- Invalid / missing token → `client.disconnect()`
- Method: `broadcastToAdmins(notif)` → `server.to('admin_notifications').emit('newNotification', notif)`

### `createForAllAdmins()` contract
```typescript
async createForAllAdmins(data: {
  title: string;
  message: string;
  type: string;
  orderRef?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```
- Fetches all `role = 'admin'` users
- Batch-inserts via `notifRepo.save([...rows])` — single query
- Calls `gateway.broadcastToAdmins(firstRow)` — sends one WS event (not N)
- Returns `void` — callers wrap in `try/catch`, errors logged not thrown

### `GET /admin/badge-counts`
```typescript
// Response shape
{ newOrders: number, pendingTopUps: number }

// newOrders: orders WHERE status IN ('order_placed', 'file_verified')
// pendingTopUps: credit_transactions WHERE status = 'PENDING'
// Guard: JwtAuthGuard + RolesGuard @Roles('admin')
```

### Error safety
Every `createForAllAdmins()` call is wrapped `try/catch` in the calling service. Notification failure logs a warning but never throws — order/payment flows must never break.

---

## 6. Admin Frontend Architecture

### New / modified files
| File | Change |
|------|--------|
| `types/notification.ts` | NEW — `Notification` interface + `NotificationType` |
| `providers/notification-ws.ts` | NEW — socket.io singleton `/ws/notifications` |
| `providers/auth-provider.ts` | Add `disconnectNotifications()` on logout |
| `context/notifications-context.tsx` | NEW — state, REST+WS integration, actions |
| `components/notification-bell.tsx` | NEW — bell + badge + dropdown |
| `components/header.tsx` | Add `NotificationBell` left of avatar |
| `components/grid-sider.tsx` | NEW — custom sider with live badge counts |
| `pages/notifications/index.tsx` | NEW — full notifications page |
| `App.tsx` | `NotificationsProvider` wrap, `GridSider`, new route + resource |

### State flow
```
NotificationsContext
  ├── notifications[]     ← REST: GET /notifications (50 max)
  ├── unreadCount         ← REST: GET /notifications/unread-count
  ├── badgeCounts         ← REST: GET /admin/badge-counts
  └── WS: newNotification → prepend + unreadCount++ + refreshBadges()

Actions:
  markRead(id)   → PATCH /notifications/:id/read   → update local state
  markAllRead()  → PATCH /notifications/read-all   → unreadCount = 0
  refreshBadges()→ GET /admin/badge-counts          → update badgeCounts
```

### Two separate WS singletons
```
live-provider.ts       → /ws/orders        (order table + dashboard)
notification-ws.ts     → /ws/notifications  (bell + badge counts)
```
Separate so each reconnects independently and logout disconnects both.

### `GridSider` badge injection
```
BADGE_MAP = {
  'admin/orders':    'newOrders',
  'credit-requests': 'pendingTopUps',
}
Uses Refine useMenu() + antd Menu rendered manually.
Badge hidden when count = 0 or sidebar collapsed.
Brand-yellow Tag (#FFDE58 bg, #141414 text) matches GRIDGO design system.
```

### `NotificationsProvider` placement
Wraps only the authenticated layout block inside `<Authenticated>`. Mounts on login, unmounts on logout (cleans up WS + state).

---

## 7. Testing Strategy

### Server (Jest) — write tests first
```
notifications.gateway.spec.ts
  ✓ admin → joins admin_notifications room
  ✓ non-admin → no room join, no disconnect
  ✓ missing token → disconnect
  ✓ expired token → disconnect
  ✓ broadcastToAdmins() emits to admin_notifications room

notifications.service.spec.ts
  ✓ createForAllAdmins() batch-inserts one row per admin
  ✓ createForAllAdmins() calls broadcastToAdmins after insert
  ✓ createForAllAdmins() no-ops if no admin users exist
  ✓ getByUser() returns max 50, DESC order
  ✓ markAsRead() sets isRead=true, throws 404 if wrong user
  ✓ markAllAsRead() bulk-updates only that user's rows
  ✓ getUnreadCount() returns correct count

admin.controller.spec.ts (extend existing)
  ✓ badge-counts returns correct newOrders count
  ✓ badge-counts returns correct pendingTopUps count
```

### Admin (Vitest) — write tests first
```
notification-ws.test.ts
  ✓ connects to /ws/notifications with JWT
  ✓ no connect when no token
  ✓ callback fires on newNotification
  ✓ unsubscribe removes callback
  ✓ disconnect clears listeners
  ✓ no duplicate socket

notifications-context.test.tsx
  ✓ loads notifications + unreadCount on mount
  ✓ prepends + increments on WS event
  ✓ markRead updates local state
  ✓ markAllRead sets unreadCount=0
  ✓ badgeCounts refresh on WS event

notification-bell.test.tsx
  ✓ badge shows unreadCount
  ✓ dot when > 99
  ✓ empty state when no notifications
  ✓ click notification → markRead
  ✓ "Mark all" → markAllRead
  ✓ "View all" navigates to /notifications

grid-sider.test.tsx
  ✓ Orders badge shown when newOrders > 0
  ✓ Orders badge hidden when newOrders = 0
  ✓ badges hidden when collapsed
  ✓ Top-Up Requests badge correct
```

### TDD order
Server: gateway → service → controller  
Admin: notification-ws → context → bell → sider → page

---

## 8. File Change Summary (20 files)

**Server (11):**
1. `notifications/entities/notification.entity.ts`
2. `notifications/notifications.service.ts`
3. `notifications/notifications.gateway.ts` *(new)*
4. `notifications/notifications.module.ts`
5. `admin/admin.controller.ts`
6. `admin/admin.module.ts`
7. `orders/orders.service.ts`
8. `orders/orders.module.ts`
9. `credits/credits.service.ts`
10. `auth/auth.service.ts`
11. `auth/auth.module.ts`

**Admin (9):**
12. `types/notification.ts` *(new)*
13. `providers/notification-ws.ts` *(new)*
14. `providers/auth-provider.ts`
15. `context/notifications-context.tsx` *(new)*
16. `components/notification-bell.tsx` *(new)*
17. `components/header.tsx`
18. `components/grid-sider.tsx` *(new)*
19. `pages/notifications/index.tsx` *(new)*
20. `App.tsx`

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Notification failure breaks order flow | All `createForAllAdmins()` calls wrapped in `try/catch` |
| Many admins → large batch insert | Single `save([...rows])` query; acceptable at admin team scale |
| Sidebar badge polling drift | WS is primary; no polling needed — badge refetches on each WS event |
| `GridSider` loses Refine features | Uses `useMenu()` hook + antd `Menu` directly; handles active state + collapse |
| WS token expiry while connected | Gateway disconnects on verify failure; client reconnects on next login |
| Auth module circular import | NotificationsModule exports NotificationsService; no circular dependency |
