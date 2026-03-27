# GRID — Next Steps Implementation Plan

**Date:** 2026-03-28
**Status:** Phase 1-2 Complete (frontend demo), Phase 3+ Not Started

---

## Current State Summary

- **136 Dart files**, 19K+ lines of code, 34 screens, 73 passing tests
- **3 roles fully built:** Customer (11 screens), Driver (5), Admin (5), Auth (4)
- **Design system:** Greyscale-dominant with GRID yellow brand accent, light/dark mode
- **Maps:** OpenStreetMap + OSRM real road routing (free, no API key)
- **All data is mock** — zero backend, zero persistence, zero real auth

---

## Phase 2 Completion (Quick Wins — 1-2 days)

These can be done NOW without any backend.

### 2A. Hive Draft Order Persistence
**Goal:** Save in-progress orders locally so they survive app restart.
**Files:** `main.dart`, new `draft_order_provider.dart`, update `order_provider.dart`
**Work:**
1. Initialize Hive in `main.dart`
2. Create a Hive type adapter for `DraftOrder` model
3. Auto-save `orderFlowProvider` state to Hive on every change
4. Resume draft on app launch if one exists
5. Clear draft after successful order submission

### 2B. Dark Mode Persistence
**Goal:** Remember user's theme preference across app restarts.
**Files:** `theme_provider.dart`, `main.dart`
**Work:**
1. Use `SharedPreferences` (already in deps) to save theme mode
2. Load saved preference on app startup in `ThemeNotifier`
3. Add "Follow System" option alongside Light/Dark

### 2C. Connectivity Listener
**Goal:** Show offline banner when network is unavailable.
**Files:** New `connectivity_provider.dart`, update screens
**Work:**
1. Use `connectivity_plus` (already in deps) to listen for network changes
2. Show `OfflineBanner` widget (already built) at top of screens when offline
3. Queue draft orders for submission when back online

---

## Phase 3: Serverpod Backend (2-3 weeks)

### 3A. Scaffold Serverpod Project (Day 1)
**Commands:**
```bash
serverpod create printing_app
# Creates: printing_app_server/, printing_app_client/, printing_app_flutter/
```
**Work:**
1. Configure PostgreSQL connection in `config/development.yaml`
2. Set up Docker Compose for local PostgreSQL
3. Define all 13 data models as Serverpod protocol files (`.spy.yaml`)
4. Run `serverpod generate` to create client library
5. Add `printing_app_client` as dependency in Flutter app's `pubspec.yaml`

### 3B. Database Schema (Day 2)
**Work:**
1. Apply PRD Section 13 schema as Serverpod migrations
2. All 11 tables: users, addresses, orders, paper_specs, three_d_specs, driver_profiles, delivery_assignments, location_updates, order_status_history, payment_transactions, notifications
3. All 17 indexes from PRD
4. `updated_at` trigger function
5. Seed data for development

### 3C. Auth Endpoints (Days 3-4)
**Endpoints:** `AuthEndpoint`, `UserEndpoint`
**Work:**
1. Register with email/password (bcrypt hashing)
2. Login with session token management
3. Profile CRUD (getProfile, updateProfile, isProfileComplete)
4. Role-based access control middleware
5. Connect `authProvider` to real endpoints (replace mock)

### 3D. Order Endpoints (Days 5-7)
**Endpoints:** `OrderEndpoint`, `FileEndpoint`
**Work:**
1. Create order with payload validation
2. Get user orders (with status filtering)
3. Cancel order (with policy enforcement)
4. Order status history logging
5. File upload to Serverpod Storage (S3-compatible)
6. WebSocket stream for real-time order updates
7. Connect `ordersProvider` and `orderFlowProvider` to real endpoints

### 3E. Address & Admin Endpoints (Days 8-9)
**Endpoints:** `AddressEndpoint`, `AdminEndpoint`
**Work:**
1. Address CRUD with max 5 per user
2. Dashboard KPI aggregation queries
3. Sales/volume analytics (date-range queries)
4. Order queue with status filtering
5. Status update with audit trail logging
6. Driver assignment

### 3F. Driver & Location Endpoints (Days 10-11)
**Endpoints:** `DriverEndpoint`, `LocationEndpoint`
**Work:**
1. Driver profile management
2. Delivery assignment lifecycle (accept/decline/checkpoint updates)
3. GPS location streaming via WebSocket
4. Earnings calculation
5. Auto-timeout for unaccepted assignments (10 min)

### 3G. Notification & Payment Endpoints (Days 12-14)
**Endpoints:** `NotificationEndpoint`, `PaymentEndpoint`
**Work:**
1. Create notifications on status changes (server-triggered)
2. FCM push notification integration
3. In-app notification streaming via WebSocket
4. Payment method handling (GCash/Maya deep links, COD flag)
5. Payment webhook endpoint with HMAC verification
6. Refund initiation for cancelled orders

---

## Phase 4: Client-Server Integration (1-2 weeks)

### 4A. Replace Mock Data with API Calls
**Work for each provider:**
1. Replace `MockData.xxx` with Serverpod client calls
2. Convert `StateNotifier` to `AsyncNotifier` for server-synced state
3. Add loading/error states to all data screens
4. Implement retry logic for failed requests

### 4B. Real-Time Streams
**Work:**
1. WebSocket stream for order status updates (customer)
2. WebSocket stream for order queue changes (admin)
3. WebSocket stream for delivery assignments (driver)
4. GPS location streaming (driver → customer)

### 4C. File Upload Integration
**Work:**
1. Upload files to Serverpod Storage on order creation
2. Progress tracking during upload
3. File preview/download for admin

### 4D. Offline Queue
**Work:**
1. Queue order submissions when offline
2. Sync queue when connectivity restored
3. Conflict resolution (last-write-wins for drafts)

---

## Phase 5: Production Readiness (1 week)

### 5A. Security
- Rate limiting on auth endpoints (5/min/IP)
- Payment webhook HMAC verification
- Role-based endpoint guards
- File upload MIME validation
- Session token in flutter_secure_storage
- RA 10173 (Philippine Data Privacy Act) compliance

### 5B. Testing
- Unit tests for all Serverpod endpoints
- Widget tests for all 34 screens (currently 12/34)
- Integration tests for order flow end-to-end
- Load testing for concurrent orders

### 5C. Deployment
- SSL/TLS via nginx reverse proxy
- PostgreSQL automated backups (daily, 30-day retention)
- Sentry error tracking (Flutter + server)
- Health check endpoint (/health)
- CI/CD pipeline (GitHub Actions: lint, test, build, deploy)
- Docker Compose for one-command server setup

### 5D. App Store
- App icon (GRID 3×3 dot logo)
- Splash screen (already done — animated dot reveal)
- Android: Google Play Store listing
- iOS: App Store listing (requires macOS for build)
- PWA: Web deployment with service worker

---

## Phase 6: Post-MVP Enhancements

### 6A. Payment Gateway (PayMongo recommended for PH)
- GCash checkout via PayMongo API
- Maya checkout via PayMongo API
- Webhook verification
- Refund processing

### 6B. Push Notifications (Firebase)
- FCM setup for Android/iOS/web
- Notification permission handling
- Background/foreground message handling
- Topic-based subscriptions (per order)

### 6C. Advanced Features
- Auto-driver assignment (nearest available)
- Distance-based delivery pricing
- Customer ratings for drivers
- In-app chat (customer ↔ driver)
- Receipt/invoice PDF generation
- Multi-language support (Filipino/English)

---

## Priority Matrix

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 Now | Hive draft persistence | 4 hours | High — prevents data loss |
| 🔴 Now | Dark mode persistence | 1 hour | Medium — UX polish |
| 🟡 Next | Serverpod scaffold | 1 day | Blocker for all backend work |
| 🟡 Next | Auth endpoints | 2 days | Blocker for user management |
| 🟡 Next | Order endpoints | 3 days | Core business logic |
| 🟢 Later | Payment gateway | 2 days | Revenue enablement |
| 🟢 Later | Push notifications | 2 days | Engagement |
| 🟢 Later | CI/CD pipeline | 1 day | Dev productivity |

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: UI Shell | 3 days | ✅ COMPLETE |
| Phase 2: Local Logic | 2 days | ✅ 95% (Hive + dark mode persistence remaining) |
| Phase 3: Backend | 2-3 weeks | ❌ NOT STARTED |
| Phase 4: Integration | 1-2 weeks | ❌ NOT STARTED |
| Phase 5: Production | 1 week | ❌ NOT STARTED |
| **Total to MVP** | **5-7 weeks** | **Frontend demo ready** |
