# Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix 5 critical gaps where Flutter data never reaches the NestJS server — specs, payment, file upload, WebSocket, rider GPS.

**Architecture:** Each fix connects an existing Flutter provider to its corresponding NestJS endpoint. No new screens or backend modules needed — just wiring the last mile.

**Tech Stack:** dio (HTTP), socket_io_client (WebSocket), geolocator (GPS), existing NestJS API

---

## Task 1: Send order specs (paperSpecs/threeDSpecs) to server

**Files:**
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/dto/create-order.dto.ts`

**What's broken:** `addOrder()` sends category, quantity, price but NOT the print specifications. Server creates order without knowing paper size, color mode, material, etc.

- [ ] **Step 1:** Update `CreateOrderDto` on server to accept optional `paperSpecs` and `threeDSpecs` objects
- [ ] **Step 2:** Update `OrdersService.create()` to save specs to `paper_specs`/`three_d_specs` tables after creating the order
- [ ] **Step 3:** Update Flutter `addOrder()` to include specs in POST payload — serialize PaperSpecs/ThreeDSpecs to JSON maps
- [ ] **Step 4:** Verify: create order in app → check DB has specs in paper_specs/three_d_specs table
- [ ] **Step 5:** Commit: `fix: send order specs (paper/3D) to server on order creation`

---

## Task 2: Connect payment flow to real API

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/payment_screen.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`

**What's broken:** `_onPay()` does `await Future.delayed(1500ms)` then locally marks as success. Never calls `/api/payments/intent`.

- [ ] **Step 1:** Update `_onPay()` to call the real flow:
  1. Create order via `POST /orders` (already done by addOrder)
  2. Create payment intent via `POST /payments/intent` with orderId + amount + method
  3. For GCash/Maya: server returns checkout URL → open in browser (url_launcher)
  4. For COD: skip payment, just mark order as pending
  5. Show success animation after API confirms
- [ ] **Step 2:** Handle payment errors — show error message if API fails, don't show success
- [ ] **Step 3:** Fallback: if API unavailable, keep current mock behavior with a toast "Demo mode"
- [ ] **Step 4:** Commit: `fix: payment flow calls real API with fallback to demo mode`

---

## Task 3: Connect file upload to real API

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/providers/order_provider.dart`

**What's broken:** Upload screen picks a file (or uses mock) but never sends it to `/api/files/upload`. The file path stored in order state is a local path or `/mock/...`.

- [ ] **Step 1:** After file is picked and validated, upload it to server:
  ```dart
  final formData = FormData.fromMap({
    'file': await MultipartFile.fromFile(filePath, filename: fileName),
  });
  final response = await ApiClient.instance.post('/files/upload', data: formData);
  final fileUrl = response.data['url'];
  ```
- [ ] **Step 2:** Store the server-returned `fileUrl` in order flow state (not the local path)
- [ ] **Step 3:** Fallback: if upload fails, keep local path and show warning "File will upload when online"
- [ ] **Step 4:** Commit: `fix: upload files to server via /api/files/upload`

---

## Task 4: Connect WebSocket for real-time updates

**Files:**
- Modify: `apps/mobile/pubspec.yaml` (add socket_io_client)
- Create: `apps/mobile/lib/shared/services/websocket_service.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`
- Modify: `apps/mobile/lib/features/admin/queue/providers/queue_provider.dart`

**What's broken:** NestJS has WebSocket gateways (orders + location) but Flutter has no socket.io client. No real-time updates.

- [ ] **Step 1:** Add `socket_io_client: ^3.0.2` to pubspec.yaml, run pub get
- [ ] **Step 2:** Create `WebSocketService` singleton:
  ```dart
  import 'package:socket_io_client/socket_io_client.dart' as io;

  class WebSocketService {
    static final instance = WebSocketService._();
    WebSocketService._();

    io.Socket? _ordersSocket;

    void connectOrders({required Function(dynamic) onOrderUpdate}) {
      _ordersSocket = io.io('http://localhost:3000/ws/orders',
        io.OptionBuilder().setTransports(['websocket']).build());
      _ordersSocket!.on('orderUpdate', onOrderUpdate);
    }

    void subscribeToOrder(String orderId) {
      _ordersSocket?.emit('subscribe', orderId);
    }

    void disconnect() {
      _ordersSocket?.disconnect();
    }
  }
  ```
- [ ] **Step 3:** In OrdersNotifier, connect to WebSocket on init and update state when `orderUpdate` event fires
- [ ] **Step 4:** In QueueNotifier (admin), same pattern — listen for queue changes
- [ ] **Step 5:** Fallback: if WebSocket connection fails, polling every 30 seconds as backup
- [ ] **Step 6:** Commit: `feat: WebSocket real-time order updates via socket.io`

---

## Task 5: Connect rider GPS to real API

**Files:**
- Modify: `apps/mobile/lib/features/rider/active_delivery/providers/location_provider.dart`
- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`

**What's broken:** LocationProvider emits mock GPS from MockData every 2 seconds. Never uses geolocator or sends to server.

- [ ] **Step 1:** Update LocationProvider to use real geolocator (package already in pubspec):
  ```dart
  import 'package:geolocator/geolocator.dart';

  // Request permission
  final permission = await Geolocator.requestPermission();

  // Stream real GPS
  Geolocator.getPositionStream(
    locationSettings: LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
  ).listen((position) {
    // Update state with real coordinates
    // Send to server via WebSocket or REST
  });
  ```
- [ ] **Step 2:** Send location updates to server via WebSocket (location gateway) or REST fallback (`POST /riders/location`)
- [ ] **Step 3:** Fallback: if geolocator permission denied or unavailable (desktop/WSL2), use mock data
- [ ] **Step 4:** Commit: `feat: real GPS tracking via geolocator + server location updates`

---

## Task 6: Verify fonts are real (not placeholders)

**Files:**
- Check: `apps/mobile/assets/fonts/Satoshi/*.ttf`
- Check: `apps/mobile/assets/fonts/InstrumentSerif/*.ttf`
- Modify: `apps/mobile/pubspec.yaml` (remove TODO comment if fonts are real)

- [ ] **Step 1:** Check file sizes — if >10KB they're real fonts, if 0 bytes they're placeholders
- [ ] **Step 2:** If real: remove the TODO comment from pubspec.yaml
- [ ] **Step 3:** If fake: download real fonts (already done previously — verify)
- [ ] **Step 4:** Commit: `chore: verify font files are real, remove placeholder TODO`

---

## Verification

After all tasks:
1. Register → place order with paper specs → check DB has specs ✓
2. Payment → server receives payment intent ✓
3. Upload file → server receives file ✓
4. Change order status (admin) → customer sees update in real-time ✓
5. Rider starts delivery → customer sees GPS on map ✓
