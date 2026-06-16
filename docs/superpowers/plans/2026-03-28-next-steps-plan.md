# GRIDGO — Next Steps Implementation Plan (v2)

**Date:** 2026-03-28
**Status:** Phase 1-2 Complete (frontend demo), Phase 3+ Not Started
**Backend Readiness Score:** 3.5/10 (models ready, zero server code)

---

## Current State

| Metric | Value |
|--------|-------|
| Dart files | 136 |
| Lines of code | 19,333 |
| Screens | 34 (11 customer, 5 rider, 5 admin, 4 auth, 9 order flow) |
| Tests | 73 passing (12 test files, ~5% coverage) |
| Providers | 13 Riverpod StateNotifiers (all mock data) |
| Models | 13 data classes (99% aligned with PRD schema) |
| Backend | 0% — no server directory exists |

---

## Phase 2 Completion — Quick Wins (1-2 days, no backend)

### 2A. Hive Draft Order Persistence (4 hours)

**Use Hive CE (Community Edition)** — actively maintained fork with `@GenerateAdapters`.

```yaml
# Replace hive dependencies in pubspec.yaml:
dependencies:
  hive_ce: ^2.6.0
  hive_ce_flutter: ^2.2.0
dev_dependencies:
  hive_ce_generator: ^1.7.0
  build_runner: ^2.4.0
```

**Work:**
1. Initialize Hive in `main.dart`: `await Hive.initFlutter();`
2. Create type adapter for `DraftOrder` with `@GenerateAdapters`
3. Run `dart run build_runner build` to generate adapters
4. Create `DraftOrderProvider` that reads/writes Hive box
5. Auto-save `orderFlowProvider` state to Hive on every change
6. On app launch, check for saved draft and offer to resume
7. Clear draft after successful order submission

### 2B. Dark Mode Persistence (1 hour)

**Work:**
1. Add `SharedPreferences` load/save to `ThemeNotifier`
2. Load saved preference in `initState` (default: system theme)
3. Save on toggle: `prefs.setString('themeMode', mode.name)`
4. Add "Follow System" option alongside Light/Dark

### 2C. Connectivity Listener (2 hours)

**Work:**
1. Create `ConnectivityProvider` using `connectivity_plus` (already in deps)
2. Listen for network state changes
3. Show `OfflineBanner` (already built) when offline
4. Disable submit buttons when offline, show toast

---

## Phase 3: Serverpod Backend (2-3 weeks)

### 3A. Scaffold & Database (Days 1-2)

```bash
# Install Serverpod CLI
dart pub global activate serverpod_cli

# Create project (generates _server, _client, _flutter packages)
serverpod create grid_print

# Start PostgreSQL
cd grid_print_server
docker compose up -d

# Apply initial migrations
dart run bin/main.dart --apply-migrations
```

**Database config** (`config/development.yaml`):
```yaml
database:
  host: localhost
  port: 5432
  name: grid_print
  user: postgres
  requireSsl: false
```

**Define all 13 models as `.spy.yaml` files** in `lib/src/models/`:

```yaml
# Example: order.spy.yaml
class: Order
table: orders
fields:
  orderId: String
  userId: int
  category: String
  fileUrl: String?
  fileName: String?
  quantity: int
  totalPrice: double
  deliveryFee: double
  paymentMethod: String
  paymentStatus: String, default="'pending'"
  orderStatus: String, default="'order_placed'"
  declineReason: String?
  cancellationReason: String?
  cancelledAt: DateTime?
  deliveryOption: String, default="'pickup'"
  deliveryAddressId: int?
  assignedRiderId: int?
  estimatedCompletionAt: DateTime?
  adminNotes: String?
  trackingLink: String?
  createdAt: DateTime, default=now
  updatedAt: DateTime, default=now

indexes:
  idx_orders_user_id:
    fields: userId
  idx_orders_status:
    fields: orderStatus
  idx_orders_user_status:
    fields: userId, orderStatus
  idx_orders_created:
    fields: createdAt
    type: btree
```

After defining all models: `serverpod generate && serverpod create-migration`

### 3B. Auth Endpoints (Days 3-4)

Use `serverpod_auth` module for email/password:

```dart
class AuthEndpoint extends Endpoint {
  Future<UserInfo> register(Session session, String email, String password) async {
    // Hash password with bcrypt
    // Insert user into DB
    // Create session token
  }

  Future<AuthResponse> login(Session session, String email, String password) async {
    // Verify credentials
    // Create session
    // Return token + user info
  }

  Future<void> logout(Session session) async {
    await session.close();
  }
}
```

**Wire to Flutter:** Replace `authProvider` mock login with Serverpod client call.

### 3C. Order Endpoints (Days 5-7)

```dart
class OrderEndpoint extends Endpoint {
  Future<Order> createOrder(Session session, CreateOrderPayload payload) async { ... }
  Future<List<Order>> getUserOrders(Session session, {String? statusFilter}) async { ... }
  Future<Order> cancelOrder(Session session, String orderId, {String? reason}) async { ... }
  Future<List<OrderStatusHistory>> getOrderHistory(Session session, String orderId) async { ... }
  Stream<Order> streamOrderUpdates(Session session, String orderId) async* { ... }
}
```

### 3D. Address, Admin, File Endpoints (Days 8-9)

- Address CRUD with max 5 per user constraint
- Admin dashboard aggregation queries
- Rider assignment logic
- File upload to Serverpod Storage (S3-compatible)

### 3E. Rider & Location Endpoints (Days 10-11)

```dart
class RiderEndpoint extends Endpoint {
  Future<DeliveryAssignment> acceptAssignment(Session session, int id) async { ... }
  Future<DeliveryAssignment> updateDeliveryStatus(Session session, int id, String status) async { ... }
  Stream<DeliveryAssignment> streamActiveDelivery(Session session) async* { ... }
}

class LocationEndpoint extends Endpoint {
  Future<void> updateLocation(Session session, double lat, double lng) async { ... }
  Stream<LocationUpdate> streamRiderLocation(Session session, int assignmentId) async* { ... }
}
```

### 3F. Notification & Payment Endpoints (Days 12-14)

**FCM Setup:**
```yaml
# pubspec.yaml additions (Flutter app)
dependencies:
  firebase_core: ^3.12.0
  firebase_messaging: ^15.2.0
  flutter_local_notifications: ^18.0.0
```

```bash
# Configure Firebase
dart pub global activate flutterfire_cli
flutterfire configure
```

**Payment: PayMongo (recommended for PH)**

Why PayMongo:
- Philippines-native, best GCash/Maya support
- 2.0% per e-wallet transaction, no monthly fees
- Simple Payment Intent API
- Webhook support for server verification

```dart
// Server-side PayMongo integration
class PaymentEndpoint extends Endpoint {
  Future<Map<String, String>> createPaymentIntent(
    Session session, int orderId, double amount,
  ) async {
    final response = await http.post(
      Uri.parse('https://api.paymongo.com/v1/payment_intents'),
      headers: {
        'Authorization': 'Basic ${base64Encode(utf8.encode('$apiKey:'))}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'data': { 'attributes': {
          'amount': (amount * 100).toInt(), // centavos
          'currency': 'PHP',
          'payment_method_allowed': ['gcash', 'maya', 'card'],
        }}
      }),
    );
    // Return client key for Flutter to complete payment
  }
}
```

---

## Phase 4: Client-Server Integration (1-2 weeks)

### 4A. Replace Mock Data with API Calls

For each of the 13 providers:
1. Add `serverpod_client` calls
2. Convert `StateNotifier` → `AsyncNotifier` for server-synced state
3. Add loading/error states
4. Implement retry logic

### 4B. Real-Time Streams

```dart
// Customer: watch order status
final stream = client.order.streamOrderUpdates(orderId);
await for (final order in stream) {
  // Update UI with new status
}

// Rider: GPS location streaming
final locationStream = client.location.streamRiderLocation(assignmentId);
```

### 4C. Offline Queue

1. Queue order submissions when offline (Hive)
2. Sync on reconnection (connectivity_plus listener)
3. Conflict resolution: last-write-wins for drafts

---

## Phase 5: Production Readiness (1 week)

### Security
- Rate limiting: 5 auth attempts/min/IP
- PayMongo webhook HMAC signature verification
- Role-based endpoint guards (customer ≠ admin ≠ rider)
- File upload: MIME whitelist, 50MB paper / 200MB 3D limits
- Session tokens in `flutter_secure_storage`
- RA 10173 compliance (Philippine Data Privacy Act)

### Testing (target: 5% → 60%+ coverage)
- Unit tests for all Serverpod endpoints
- Widget tests for remaining 22 untested screens
- Integration tests for order flow end-to-end
- Provider tests for all 13 state managers

### Deployment
- SSL/TLS via nginx + Let's Encrypt
- PostgreSQL daily backups (30-day retention)
- Sentry error tracking (Flutter + Serverpod)
- Health check endpoint (`/health`)
- CI/CD: GitHub Actions (lint → test → build → deploy)
- Docker Compose for one-command server setup

### App Distribution
- Android: Google Play Store
- iOS: App Store (requires macOS build machine)
- PWA: Web deployment with service worker
- App icon: GRIDGO 3×3 dot logo

---

## Phase 6: Post-MVP Enhancements

| Feature | Priority | Effort |
|---------|----------|--------|
| Auto-rider assignment (nearest) | High | 3 days |
| Distance-based delivery pricing | High | 2 days |
| Customer ratings for riders | Medium | 2 days |
| In-app chat (customer ↔ rider) | Medium | 4 days |
| Receipt/invoice PDF generation | Medium | 2 days |
| Multi-language (Filipino/English) | Low | 3 days |
| Loyalty points / referral codes | Low | 3 days |
| Web admin panel | Low | 1 week |

---

## Priority Matrix

| Priority | Task | Effort | Impact | Blocks |
|----------|------|--------|--------|--------|
| 🔴 **Now** | Hive draft persistence | 4h | High | Nothing |
| 🔴 **Now** | Dark mode persistence | 1h | Medium | Nothing |
| 🟡 **Next** | Serverpod scaffold + DB | 2 days | Critical | All backend |
| 🟡 **Next** | Auth endpoints | 2 days | Critical | User management |
| 🟡 **Next** | Order endpoints | 3 days | Critical | Core business |
| 🟡 **Next** | File upload endpoint | 1 day | High | Order creation |
| 🟠 **Soon** | Rider/Location endpoints | 2 days | High | Delivery tracking |
| 🟠 **Soon** | PayMongo integration | 2 days | High | Revenue |
| 🟠 **Soon** | FCM push notifications | 2 days | Medium | Engagement |
| 🟢 **Later** | Test coverage (60%+) | 3 days | Medium | Quality |
| 🟢 **Later** | CI/CD pipeline | 1 day | Medium | Dev velocity |
| 🟢 **Later** | Production deployment | 2 days | Critical | Launch |

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: UI Shell | 3 days | ✅ COMPLETE (2026-03-27) |
| Phase 2: Local Logic | 2 days | ✅ 95% (Hive + dark persistence remaining) |
| Phase 3: Backend | 2-3 weeks | ❌ NOT STARTED |
| Phase 4: Integration | 1-2 weeks | ❌ NOT STARTED |
| Phase 5: Production | 1 week | ❌ NOT STARTED |
| **Total to MVP** | **5-7 weeks** | **Frontend demo ready** |

---

## Tech Stack Summary

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Flutter 3.41.6 + Dart 3.11.4 | ✅ Complete |
| **State** | Riverpod 2.6.1 | ✅ Complete (mock) |
| **Navigation** | GoRouter 14.8.1 | ✅ Complete |
| **Maps** | flutter_map + OpenStreetMap + OSRM | ✅ Complete (free) |
| **Icons** | HugeIcons 1.1.5 + Material Icons | ✅ Complete |
| **Local Storage** | Hive CE 2.6.0 | ⚠️ Dependency ready, not integrated |
| **Backend** | Serverpod (latest) | ❌ Not started |
| **Database** | PostgreSQL 15+ | ❌ Not started |
| **Auth** | Serverpod Auth Module | ❌ Not started |
| **Payments** | PayMongo (GCash/Maya/Card) | ❌ Not started |
| **Push** | Firebase Cloud Messaging | ❌ Not started |
| **Deployment** | Docker + nginx + Let's Encrypt | ❌ Not started |
