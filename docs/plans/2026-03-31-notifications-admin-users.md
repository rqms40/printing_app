# Notifications And Admin Users Data Integrity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the mobile notifications read flow so real backend notifications parse and mutate correctly, and make the admin users page render only NestJS/database data with explicit failure handling.

**Architecture:** Keep the backend as the source of truth, but separate read-only fallback behavior from backend mutation behavior on mobile. On the admin side, remove silent mock fallback entirely and funnel user loading through a small testable loader that returns success or error state for the page.

**Tech Stack:** Flutter, Riverpod, Dio, Flutter widget/unit tests, React, Vite, Vitest, Axios, NestJS-backed REST APIs

---

### Task 1: Make notification data parsing and mutation routing testable

**Files:**
- Create: `apps/mobile/lib/features/customer/notifications/providers/notifications_api.dart`
- Modify: `apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart`
- Test: `apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart`

**Step 1: Write the failing tests**

Add tests that prove:
- numeric API payloads become string IDs in state
- fallback-backed notifications do not call the network when marked read
- `markAllAsRead` clears the inbox list

Example test shape:

```dart
class FakeNotificationsApi implements NotificationsApi {
  FakeNotificationsApi({
    this.fetchResult = const [],
    this.fetchError,
  });

  final List<Map<String, dynamic>> fetchResult;
  final Object? fetchError;
  int markAsReadCalls = 0;
  int markAllAsReadCalls = 0;

  @override
  Future<List<Map<String, dynamic>>> fetchNotifications() async {
    if (fetchError != null) throw fetchError!;
    return fetchResult;
  }

  @override
  Future<void> markAsRead(String id) async {
    markAsReadCalls += 1;
  }

  @override
  Future<void> markAllAsRead() async {
    markAllAsReadCalls += 1;
  }
}

test('parses numeric API notification payloads into string model IDs', () async {
  final api = FakeNotificationsApi(
    fetchResult: [
      {
        'id': 14,
        'userId': 1,
        'orderRef': 'ORD-10001',
        'title': 'Order Placed',
        'message': 'Placed',
        'type': 'order_update',
        'isRead': false,
        'createdAt': '2026-03-31T10:00:00.000Z',
      },
    ],
  );

  final notifier = NotificationsNotifier(api: api);
  await Future<void>.delayed(const Duration(milliseconds: 50));

  expect(notifier.state.single.id, '14');
  expect(notifier.state.single.userId, '1');
});

test('markAsRead skips PATCH when current notifications are fallback-backed', () async {
  final api = FakeNotificationsApi(fetchError: Exception('offline'));
  final notifier = NotificationsNotifier(api: api);
  await Future<void>.delayed(const Duration(milliseconds: 50));

  final id = notifier.state.first.id;
  await notifier.markAsRead(id);

  expect(api.markAsReadCalls, 0);
  expect(notifier.state.any((n) => n.id == id), false);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/notifications/providers/notifications_provider_test.dart
```

Expected: FAIL because `NotificationsNotifier` does not yet accept an injected API and still assumes string-only payload fields.

**Step 3: Write minimal implementation**

Create a tiny provider-facing API abstraction and update the notifier to use it:

```dart
abstract class NotificationsApi {
  Future<List<Map<String, dynamic>>> fetchNotifications();
  Future<void> markAsRead(String id);
  Future<void> markAllAsRead();
}

class HttpNotificationsApi implements NotificationsApi {
  @override
  Future<List<Map<String, dynamic>>> fetchNotifications() async {
    final response = await ApiClient.instance.get('/notifications');
    return (response.data as List<dynamic>)
        .cast<Map<String, dynamic>>();
  }

  @override
  Future<void> markAsRead(String id) =>
      ApiClient.instance.patch('/notifications/$id/read');

  @override
  Future<void> markAllAsRead() =>
      ApiClient.instance.patch('/notifications/read-all');
}
```

Then in `notifications_provider.dart`:

```dart
String _stringValue(Object? value) => value?.toString() ?? '';

String? _optionalStringValue(Object? value) {
  final normalized = value?.toString();
  return (normalized == null || normalized.isEmpty) ? null : normalized;
}

AppNotification _parseNotification(Map<String, dynamic> json) {
  return AppNotification(
    id: _stringValue(json['id'] ?? json['_id']),
    userId: _stringValue(json['userId'] ?? json['user_id']),
    orderId: _optionalStringValue(
      json['orderId'] ?? json['orderRef'] ?? json['order_ref'],
    ),
    title: _stringValue(json['title']),
    message: _stringValue(json['message']),
    type: _stringValue(json['type']).isEmpty ? 'info' : _stringValue(json['type']),
    isRead: json['isRead'] as bool? ?? false,
    createdAt: DateTime.parse(_stringValue(json['createdAt'] ?? json['created_at'])),
  );
}
```

Track fallback mode with a private boolean and remove items from state when read:

```dart
class NotificationsNotifier extends StateNotifier<List<AppNotification>> {
  NotificationsNotifier({NotificationsApi? api})
      : _api = api ?? HttpNotificationsApi(),
        super([]) {
    _fetchNotifications();
  }

  final NotificationsApi _api;
  bool _usingFallbackData = false;

  Future<void> _fetchNotifications() async {
    try {
      final data = await _api.fetchNotifications();
      _usingFallbackData = false;
      state = data.map(_parseNotification).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {
      _usingFallbackData = true;
      state = MockData.notifications
          .where((n) => n.userId == 'usr_001')
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
  }

  Future<void> markAsRead(String id) async {
    if (!_usingFallbackData) {
      try {
        await _api.markAsRead(id);
      } catch (_) {}
    }
    state = [for (final n in state) if (n.id != id) n];
  }

  Future<void> markAllAsRead() async {
    if (!_usingFallbackData) {
      try {
        await _api.markAllAsRead();
      } catch (_) {}
    }
    state = [];
  }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/notifications/providers/notifications_provider_test.dart
```

Expected: PASS with new coverage for numeric payload normalization, fallback mutation gating, and inbox-clearing behavior.

**Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/notifications/providers/notifications_api.dart \
        apps/mobile/lib/features/customer/notifications/providers/notifications_provider.dart \
        apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart
git commit -m "fix(mobile): normalize notification payloads and guard fallback mutations"
```

### Task 2: Make the notifications screen remove read items from the tree

**Files:**
- Modify: `apps/mobile/lib/features/customer/notifications/screens/notifications_screen.dart`
- Test: `apps/mobile/test/features/customer/notifications/screens/notifications_screen_test.dart`

**Step 1: Write the failing widget tests**

Add one widget test for swipe removal and one for mark-all clearing the inbox:

```dart
testWidgets('swiping a notification removes it from the list', (tester) async {
  await tester.pumpWidget(_wrap(const NotificationsScreen()));
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(milliseconds: 500));

  expect(find.text('Order Placed'), findsOneWidget);

  await tester.drag(find.text('Order Placed'), const Offset(-600, 0));
  await tester.pumpAndSettle();

  expect(find.text('Order Placed'), findsNothing);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/notifications/screens/notifications_screen_test.dart
```

Expected: FAIL with the existing `Dismissible` error or with the row still present after dismissal.

**Step 3: Write minimal implementation**

Keep the list UI simple and align all read actions with inbox semantics:

```dart
onDismissed: (_) {
  ref.read(notificationsProvider.notifier).markAsRead(notification.id);
},

onTap: () {
  ref.read(notificationsProvider.notifier).markAsRead(notification.id);
},
```

Because the provider now removes the item from state, the dismissed widget will leave the tree correctly. `markAllAsRead` should also lead to the existing empty state because the provider empties the list.

**Step 4: Run test to verify it passes**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/notifications/screens/notifications_screen_test.dart
```

Expected: PASS with no `Dismissible` exception and the empty state appearing after all items are cleared.

**Step 5: Commit**

```bash
git add apps/mobile/lib/features/customer/notifications/screens/notifications_screen.dart \
        apps/mobile/test/features/customer/notifications/screens/notifications_screen_test.dart
git commit -m "fix(mobile): treat notifications screen as unread inbox"
```

### Task 3: Remove admin users mock fallback and add explicit backend-only load state

**Files:**
- Create: `admin/src/pages/users/data.ts`
- Test: `admin/src/pages/users/data.test.ts`
- Modify: `admin/src/pages/users/list.tsx`

**Step 1: Write the failing tests**

Add a small pure loader with tests first so the page behavior is easy to verify without DOM tooling:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadAdminUsers } from "./data";

describe("loadAdminUsers", () => {
  it("returns normalized users from /admin/users", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{ id: 7, fullName: "Admin User", email: "admin@gridgo.ph", role: "admin" }],
      }),
    };

    await expect(loadAdminUsers(client as never)).resolves.toEqual({
      status: "success",
      users: [
        expect.objectContaining({
          id: 7,
          full_name: "Admin User",
          email: "admin@gridgo.ph",
        }),
      ],
    });
  });

  it("returns an explicit error state when /admin/users fails", async () => {
    const client = { get: vi.fn().mockRejectedValue(new Error("boom")) };

    await expect(loadAdminUsers(client as never)).resolves.toEqual({
      status: "error",
      message: "Unable to load users from the server.",
      users: [],
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd admin
npm test -- src/pages/users/data.test.ts
```

Expected: FAIL because `loadAdminUsers` does not exist yet.

**Step 3: Write minimal implementation**

Create `data.ts`:

```ts
import { apiClient } from "@/providers/api-client";
import { normalizeAdminUsers, type AdminUserRecord } from "@/utils/api-normalizers";

type ApiLike = Pick<typeof apiClient, "get">;

export type UsersLoadResult =
  | { status: "success"; users: AdminUserRecord[] }
  | { status: "error"; users: []; message: string };

export async function loadAdminUsers(client: ApiLike = apiClient): Promise<UsersLoadResult> {
  try {
    const response = await client.get("/admin/users");
    return { status: "success", users: normalizeAdminUsers(response.data) };
  } catch {
    return {
      status: "error",
      users: [],
      message: "Unable to load users from the server.",
    };
  }
}
```

Then update `list.tsx`:

```tsx
const [users, setUsers] = useState<AdminUserRecord[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

async function fetchUsers() {
  setLoading(true);
  const result = await loadAdminUsers();
  if (result.status == "success") {
    setUsers(result.users);
    setError(null);
  } else {
    setUsers([]);
    setError(result.message);
  }
  setLoading(false);
}

useEffect(() => {
  void fetchUsers();
}, []);
```

Render an explicit failure state instead of mock rows:

```tsx
if (error) {
  return (
    <List title="Users">
      <Result
        status="error"
        title="Unable to load users"
        subTitle={error}
        extra={<Button onClick={() => void fetchUsers()}>Retry</Button>}
      />
    </List>
  );
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd admin
npm test -- src/pages/users/data.test.ts src/utils/api-normalizers.test.ts
```

Expected: PASS with backend-only loader coverage and existing normalizer coverage still green.

**Step 5: Commit**

```bash
git add admin/src/pages/users/data.ts \
        admin/src/pages/users/data.test.ts \
        admin/src/pages/users/list.tsx
git commit -m "fix(admin): make users page backend-only"
```

### Task 4: Run focused verification before merge

**Files:**
- Modify if needed: `apps/mobile/test/features/customer/notifications/providers/notifications_provider_test.dart`
- Modify if needed: `apps/mobile/test/features/customer/notifications/screens/notifications_screen_test.dart`
- Modify if needed: `admin/src/pages/users/data.test.ts`

**Step 1: Run the mobile notification test slice**

Run:

```bash
cd apps/mobile
flutter test test/features/customer/notifications/providers/notifications_provider_test.dart \
             test/features/customer/notifications/screens/notifications_screen_test.dart
```

Expected: PASS

**Step 2: Run the admin test slice**

Run:

```bash
cd admin
npm test -- src/pages/users/data.test.ts src/utils/api-normalizers.test.ts
```

Expected: PASS

**Step 3: Run a lightweight admin build check**

Run:

```bash
cd admin
npm run build
```

Expected: successful Vite production build

**Step 4: Run a lightweight server test smoke check**

No server code is planned, so this is optional unless mobile/API contract assumptions change during implementation:

```bash
cd server
npm test -- notifications.service.spec.ts
```

Expected: PASS or skip if no server files changed

**Step 5: Commit any last verification-driven fixes**

```bash
git status --short
```

Expected: clean working tree, or a small final follow-up commit if verification exposed one last issue
