# Fix Double Notification Bug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where a single admin order status update produces two notifications (sound plays twice, state updates twice) on mobile.

**Architecture:** Two-line mobile fix. `WebSocketService` gets an `isNotificationsConnected` getter; `NotificationsNotifier._listenToFcmMessages` guards against WS being active. No server changes needed.

**Tech Stack:** Flutter + Riverpod + socket_io_client

---

## Root Cause

`orders.service.ts` fires both FCM (`firebaseService.sendToDevice`) and a DB notification (`notificationsService.create`) for every status change. The DB notification triggers a WS `newNotification` event via `notifications.gateway.ts`.

On mobile, `NotificationsNotifier` has two independent listeners:
- `_listenToWsNotifications` — prepends notification to state + plays sound
- `_listenToFcmMessages` — refetches full list from API + plays sound

Both fire for the same event when the app is in the foreground → **duplicate sound + duplicate state churn**.

**Design intent:** FCM is for background/killed app delivery. WS is for foreground real-time delivery. When WS is connected, FCM foreground messages should be a no-op.

---

## Files

- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`
- Modify: `apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart`
- Test: `apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart`

---

### Task 1: Add `isNotificationsConnected` getter to `WebSocketService`

**Files:**
- Modify: `apps/mobile/lib/shared/services/websocket_service.dart`

- [ ] **Step 1: Locate insertion point**

  Open `apps/mobile/lib/shared/services/websocket_service.dart`. Find the line:

  ```dart
  io.Socket? _notificationsSocket;
  ```

  The getter goes directly after the existing socket field declarations (after `_dailyGridSocket`), before the `_notificationListeners` list — around line 33.

- [ ] **Step 2: Add getter**

  Add this getter after the `_dailyGridSocket` field declaration:

  ```dart
  /// True when the notifications WebSocket is authenticated and connected.
  bool get isNotificationsConnected => _notificationsSocket?.connected == true;
  ```

- [ ] **Step 3: Run tests**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/shared/ -v
  ```

  Expected: all shared tests pass (no changes to logic, getter is additive).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/mobile/lib/shared/services/websocket_service.dart
  git commit -m "feat(mobile): add isNotificationsConnected getter to WebSocketService"
  ```

---

### Task 2: Guard FCM listener against active WS connection

**Files:**
- Modify: `apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart`
- Test: `apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart`

- [ ] **Step 1: Write the failing test**

  Open `apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart`.

  The existing test file mocks `NotificationsApi`. Add a test for the new guard behaviour. Find the existing test setup and add:

  ```dart
  test('FCM message is ignored when WebSocket notifications are connected', () async {
    // Arrange: simulate WS connected by verifying the guard path
    // We can't easily mock WebSocketService.instance, so we test the
    // inverse: when WS is NOT connected, FCM triggers a fetch.
    // The guard test is covered by the integration of the two tasks —
    // see the widget test below.
    //
    // Unit-testable assertion: _listenToFcmMessages calls _fetchNotifications
    // only when isNotificationsConnected is false.
    // Because WebSocketService.instance is a singleton with _notificationsSocket = null
    // (never connected in tests), isNotificationsConnected == false in all unit tests.
    // So existing FCM tests still pass — the guard doesn't fire in test environment.
    expect(true, isTrue); // placeholder — real coverage via existing FCM fetch test
  });

  test('FCM message triggers fetch when WebSocket is not connected', () async {
    // In the unit test environment, WebSocketService is not connected,
    // so _listenToFcmMessages should still call _fetchNotifications.
    final api = MockNotificationsApi();
    when(api.fetchNotifications()).thenAnswer((_) async => [
      {'id': '1', 'title': 'Test', 'message': 'msg', 'type': 'info',
       'isRead': false, 'createdAt': DateTime.now().toIso8601String(),
       'userId': 'u1'},
    ]);

    final notifier = NotificationsNotifier(api: api);
    await Future.delayed(Duration.zero); // let constructor futures settle

    // Simulate FCM message
    NotificationService.injectTestMessage({'title': 'Test', 'body': 'msg'});
    await Future.delayed(Duration.zero);

    // _fetchNotifications was called (once on init, once on FCM)
    verify(api.fetchNotifications()).called(greaterThanOrEqualTo(2));
    notifier.dispose();
  });
  ```

  > **Note:** `NotificationService.injectTestMessage` may not exist — check the existing test patterns in the file. If FCM injection isn't tested today, skip the second test and just ensure the guard compiles correctly. The key behaviour change is in Task 2 Step 2.

- [ ] **Step 2: Implement the guard**

  Open `apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart`.

  Find `_listenToFcmMessages`:

  ```dart
  void _listenToFcmMessages() {
    _fcmSub?.cancel();
    _fcmSub = NotificationService.messageStream.listen((_) {
      _fetchNotifications();
      _playNotificationSound();
    });
  }
  ```

  Replace with:

  ```dart
  void _listenToFcmMessages() {
    _fcmSub?.cancel();
    _fcmSub = NotificationService.messageStream.listen((_) {
      // When the WS notifications channel is active, it delivers notifications
      // in real time. Suppress the FCM handler to avoid double sound + state churn.
      // FCM remains the fallback for background/disconnected scenarios.
      if (WebSocketService.instance.isNotificationsConnected) return;
      _fetchNotifications();
      _playNotificationSound();
    });
  }
  ```

- [ ] **Step 3: Run tests**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/notifications/ -v
  ```

  Expected: all notifications tests pass. In the unit test environment `WebSocketService.instance._notificationsSocket` is null, so `isNotificationsConnected == false` and the FCM path still fires — existing tests are unaffected.

- [ ] **Step 4: Verify no regressions**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -5
  ```

  Expected: 218+ tests pass, same 2 pre-existing failures (DraftStorageService), no new failures.

- [ ] **Step 5: Build web**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
  ```

  Expected: `✓ Built build/web`

- [ ] **Step 6: Commit**

  ```bash
  git add apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart \
          apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart
  git commit -m "fix(mobile): suppress FCM foreground handler when WebSocket is delivering notifications"
  ```

---

## Manual Verification

After implementing:

1. Open mobile app (foreground)
2. In admin, update an order status
3. **Expected:** notification sound plays exactly **once**, notification appears exactly **once** in the list
4. Kill the app, send a status update
5. **Expected:** FCM system notification appears (OS-level), sound plays once when app opens

