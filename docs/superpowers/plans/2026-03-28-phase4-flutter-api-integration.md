# Phase 4: Flutter ↔ NestJS API Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock data in the Flutter app with real NestJS API calls, enabling end-to-end functionality from mobile to database.

**Architecture:** Create a shared API client layer (`ApiClient` using `dio`) that all providers call instead of `MockData`. JWT tokens stored in `flutter_secure_storage`, auto-attached to requests via dio interceptor. Providers convert from `StateNotifier` (sync mock) to async patterns with loading/error states.

**Tech Stack:** dio (HTTP client), flutter_secure_storage (token persistence), flutter_riverpod (state), existing NestJS API at `http://localhost:3000/api`

---

## Task 1: API Client + Token Storage Foundation

**Files:**
- Create: `apps/mobile/lib/shared/services/api_client.dart`
- Create: `apps/mobile/lib/shared/services/token_storage.dart`
- Modify: `apps/mobile/pubspec.yaml` (add dio)
- Modify: `apps/mobile/lib/main.dart`

- [ ] **Step 1:** Add `dio: ^5.7.0` to pubspec.yaml dependencies and run `fvm flutter pub get`

- [ ] **Step 2:** Create `token_storage.dart` — wraps `flutter_secure_storage` for JWT read/write/delete

- [ ] **Step 3:** Create `api_client.dart` — singleton dio instance with:
  - Base URL from env or default `http://10.0.2.2:3000/api` (Android emulator) / `http://localhost:3000/api` (web/desktop)
  - Interceptor that reads token from `TokenStorage` and attaches `Authorization: Bearer <token>` header
  - Response error handling (401 → clear token, redirect to login)
  - JSON content-type headers

- [ ] **Step 4:** Update `main.dart` to initialize `TokenStorage` on startup

- [ ] **Step 5:** Commit: `feat: API client foundation with dio + secure token storage`

---

## Task 2: Auth Provider → Real API

**Files:**
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`

- [ ] **Step 1:** Update `AuthNotifier.login()`:
  - Call `POST /api/auth/login` with email/password via `ApiClient`
  - Parse response: `{ user: {...}, access_token: "..." }`
  - Save token to `TokenStorage`
  - Map response user to `AuthUser`
  - Set state to authenticated
  - On error: set `errorMessage` in state

- [ ] **Step 2:** Update `AuthNotifier.register()`:
  - Call `POST /api/auth/register`
  - Save token
  - Set state to profileIncomplete

- [ ] **Step 3:** Update `AuthNotifier.completeProfile()`:
  - Call `PUT /api/users/profile` with fullName, phone, gender, dateOfBirth
  - Update state with returned user data

- [ ] **Step 4:** Update `AuthNotifier.logout()`:
  - Clear token from `TokenStorage`
  - Reset state to unauthenticated

- [ ] **Step 5:** Add `AuthNotifier.tryAutoLogin()`:
  - Check if token exists in `TokenStorage`
  - If yes, call `GET /api/users/profile` to validate token
  - If valid, set authenticated state
  - If 401, clear token
  - Called from `main.dart` on app startup

- [ ] **Step 6:** Keep `devBypass()` for development testing (still uses mock data)

- [ ] **Step 7:** Commit: `feat: auth provider connected to NestJS API`

---

## Task 3: Orders Provider → Real API

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`

- [ ] **Step 1:** Update `OrdersNotifier` constructor to fetch orders from API:
  - Call `GET /api/orders` on init
  - Parse response to `List<Order>`
  - Set state with real data
  - Fallback to MockData if API unavailable (offline mode)

- [ ] **Step 2:** Update `addOrder()`:
  - Call `POST /api/orders` with order data
  - Add returned order (with server-generated ID) to state

- [ ] **Step 3:** Update `cancelOrder()`:
  - Call `PATCH /api/orders/:id/status` with `{ status: "cancelled" }`
  - Update local state on success

- [ ] **Step 4:** Add `refreshOrders()` method:
  - Re-fetch from API, replace state
  - Used by pull-to-refresh

- [ ] **Step 5:** Update payment screen to send order to API instead of just adding to local state

- [ ] **Step 6:** Commit: `feat: orders provider connected to NestJS API`

---

## Task 4: Addresses Provider → Real API

**Files:**
- Modify: `apps/mobile/lib/features/customer/address/providers/address_provider.dart`

- [ ] **Step 1:** Update constructor to fetch addresses from `GET /api/addresses`

- [ ] **Step 2:** Update `addAddress()` → `POST /api/addresses`

- [ ] **Step 3:** Update `updateAddress()` → `PUT /api/addresses/:id`

- [ ] **Step 4:** Update `deleteAddress()` → `DELETE /api/addresses/:id`

- [ ] **Step 5:** Update `setDefault()` → `PATCH /api/addresses/:id/default`

- [ ] **Step 6:** Commit: `feat: addresses provider connected to NestJS API`

---

## Task 5: Notifications Provider → Real API

**Files:**
- Modify: `apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart`

- [ ] **Step 1:** Fetch notifications from `GET /api/notifications` on init

- [ ] **Step 2:** Update `markAsRead()` → `PATCH /api/notifications/:id/read`

- [ ] **Step 3:** Update `markAllAsRead()` → `PATCH /api/notifications/read-all`

- [ ] **Step 4:** Commit: `feat: notifications provider connected to NestJS API`

---

## Task 6: Rider Providers → Real API

**Files:**
- Modify: `apps/mobile/lib/features/rider/deliveries/providers/deliveries_provider.dart`
- Modify: `apps/mobile/lib/features/rider/history/providers/earnings_provider.dart`

- [ ] **Step 1:** Update `DeliveriesNotifier` to fetch from `GET /api/riders/assignments`

- [ ] **Step 2:** Update `acceptAssignment()` → `POST /api/riders/assignments/:id/accept`

- [ ] **Step 3:** Update `declineAssignment()` → `POST /api/riders/assignments/:id/decline`

- [ ] **Step 4:** Update `advanceCheckpoint()` → `PATCH /api/riders/assignments/:id/status`

- [ ] **Step 5:** Update `earningsProvider` to fetch from `GET /api/riders/earnings`

- [ ] **Step 6:** Commit: `feat: rider providers connected to NestJS API`

---

## Task 7: Admin Providers → Real API

**Files:**
- Modify: `apps/mobile/lib/features/admin/dashboard/providers/dashboard_provider.dart`
- Modify: `apps/mobile/lib/features/admin/queue/providers/queue_provider.dart`
- Modify: `apps/mobile/lib/features/admin/rider_management/providers/riders_provider.dart`

- [ ] **Step 1:** Update `dashboardKpisProvider` → `GET /api/admin/dashboard`

- [ ] **Step 2:** Update `salesDataProvider` and `volumeDataProvider` → `GET /api/admin/analytics`

- [ ] **Step 3:** Update `QueueNotifier` to fetch from `GET /api/admin/orders`

- [ ] **Step 4:** Update `updateOrderStatus()` → `PATCH /api/admin/orders/:id/status`

- [ ] **Step 5:** Update `RidersNotifier` to fetch from `GET /api/admin/riders`

- [ ] **Step 6:** Update `assignRider()` → `POST /api/admin/orders/:id/assign`

- [ ] **Step 7:** Commit: `feat: admin providers connected to NestJS API`

---

## Task 8: Offline Fallback + Error States

**Files:**
- Modify: All provider files (add try/catch with MockData fallback)
- Modify: Screen files that show data (add error/retry UI)

- [ ] **Step 1:** In every provider, wrap API calls in try/catch:
  - On success: use API data
  - On network error: fall back to MockData + show offline banner
  - On auth error (401): clear token, redirect to login

- [ ] **Step 2:** Add `isLoading` and `errorMessage` to provider states where missing

- [ ] **Step 3:** Commit: `feat: offline fallback to mock data when API unavailable`

---

## Verification

After all tasks:
1. Start PostgreSQL: `cd server && docker-compose up -d`
2. Start NestJS: `cd server && npm run start:dev`
3. Start Flutter: `cd apps/mobile && fvm flutter run`
4. Test flow:
   - Register new account → token saved
   - Close app, reopen → auto-login works
   - Place order → appears in orders list (from DB)
   - Add address → persisted across sessions
   - Switch to rider/admin → see real data
   - Turn off server → app falls back to mock data gracefully
