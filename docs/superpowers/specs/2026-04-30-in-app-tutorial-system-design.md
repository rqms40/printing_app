# In-App Tutorial & Feature Discovery System

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Customer-facing tutorial system — first-login gate, contextual coach marks, feature overlay cards, server-synced seen-state, and profile reset

---

## Goal

Teach new customers the key differentiating features of GRIDGO (multi-drop delivery, live tracking, GRIDGO Credits, GridBot) through contextual, in-app coach marks and feature explanation overlays — similar to GCash's feature discovery patterns. Track which tutorials each user has seen server-side so state survives reinstall and syncs across devices.

---

## Scope

- **Roles covered:** Customers only (riders and admins are power users).
- **Two UI components:** `FeatureOverlayCard` (bottom-sheet intro modal) + `CoachMarkSequence` (spotlight + arrow-bubble callouts via `tutorial_coach_mark` package).
- **4 tutorial keys covering 6 feature touchpoints:** `home` (welcome + Credits chip + GridBot FAB), `checkout` (intro + Multi-drop tab + Credits payment), `tracking` (live map), `onboarding` (first-login gate).
- **First-login gate:** Existing `OnboardingScreen` gated to first login only instead of every login.
- **Reset:** "Reset Tutorials" option under Profile → Preferences.

---

## Tutorial Keys

```dart
enum TutorialKey {
  onboarding,    // gates the full-screen role slides to first login only
  home,          // FeatureOverlayCard + coach marks on Credits + GridBot FAB
  checkout,      // FeatureOverlayCard + coach marks on Multi-drop tab + Credits payment
  tracking,      // coach mark on live map
}
```

The `checkout` key covers both the checkout intro overlay and all checkout coach marks (multi-drop + credits). The `home` key covers the welcome overlay and both home coach marks.

---

## Architecture

### Data Flow

```
LOGIN
  │
  ▼
AuthProvider.login()
  │── fetch user (already returns AuthUser)
  │── TutorialRepository.syncFromServer(user.tutorialSeenKeys)
  │       └─ writes to SharedPreferences cache
  ▼
Router redirect
  │── if TutorialKey.onboarding NOT in seen keys → /onboarding
  │── else → role home
  ▼
Screen initState / postFrameCallback
  │── check tutorialSeenProvider(TutorialKey.X)
  │── if false → show FeatureOverlayCard (if applicable), then CoachMarkSequence
  └── on dismiss → TutorialRepository.markSeen(TutorialKey.X)
                        ├─ write to SharedPreferences immediately
                        └─ fire-and-forget PATCH /users/me/tutorials
```

### Storage: Server + Local Cache

**Server (source of truth):**
- New `tutorial_seen_keys` column (`text[]`, default `'{}'`) on the `users` table.
- `GET /users/me` response already includes all user fields — add `tutorialSeenKeys: string[]` to the response DTO.
- New endpoint: `PATCH /users/me/tutorials` body `{ keys: string[] }` — always replaces `tutorial_seen_keys` with the provided array. The client always sends the full current set (read from `tutorialProvider` state, add the new key, send). For reset, client sends `[]`.

**Local (SharedPreferences cache):**
- Key: `tutorial_seen_keys` → JSON-encoded `List<String>`.
- Written immediately on `markSeen()` for instant reads with no network latency.
- Refreshed from server on every login.
- On reset: cleared locally, then PATCH with `{ keys: [] }` sent to server.

---

## Server Changes

### Migration

```sql
ALTER TABLE users
  ADD COLUMN tutorial_seen_keys text[] NOT NULL DEFAULT '{}';
```

### DTO update (`UserResponseDto`)

Add field:
```typescript
tutorialSeenKeys: string[];
```

### New endpoint

```
PATCH /users/me/tutorials
Authorization: Bearer <token>
Body: { "keys": ["onboarding", "home", "checkout"] }
Response: 204 No Content
```

Server always replaces `tutorial_seen_keys` with the provided array. No merge logic needed — the client owns the full set and always sends it.

---

## Flutter Architecture

### Package

Add to `pubspec.yaml`:
```yaml
tutorial_coach_mark: ^1.2.11
```

No widget wrapping required. Targets are referenced by `GlobalKey`.

### File Structure

```
lib/features/tutorial/
  models/
    tutorial_key.dart          # TutorialKey enum
  repository/
    tutorial_repository.dart   # load, markSeen, resetAll, syncFromServer
  providers/
    tutorial_provider.dart     # AsyncNotifier<Set<TutorialKey>> + family bool provider
  widgets/
    feature_overlay_card.dart  # reusable bottom-sheet intro modal
    tutorial_bubble.dart       # reusable arrow-callout contentWidget for coach marks
```

### `TutorialRepository`

```dart
class TutorialRepository {
  static const _prefsKey = 'tutorial_seen_keys';

  // Called at login — syncs server state into local cache
  Future<void> syncFromServer(List<String> serverKeys) { ... }

  // Returns seen keys from local cache (synchronous after sync)
  Set<TutorialKey> loadLocal() { ... }

  // Write local immediately, fire-and-forget to server
  Future<void> markSeen(TutorialKey key) { ... }

  // Clear local + PATCH [] to server
  Future<void> resetAll() { ... }
}
```

### `tutorialProvider`

```dart
// Holds the full set of seen TutorialKeys
final tutorialProvider = AsyncNotifierProvider<TutorialNotifier, Set<TutorialKey>>(
  TutorialNotifier.new,
);

// Derived: single bool — used per-screen to gate tutorial display
final tutorialSeenProvider = Provider.family<bool, TutorialKey>((ref, key) {
  return ref.watch(tutorialProvider).valueOrNull?.contains(key) ?? true;
  // Defaults to true (seen) while loading — prevents flash on returning users
});
```

### Screen Integration Pattern

Every tutorialized screen follows this pattern:

```dart
class _SomeScreenState extends ConsumerState<SomeScreen> {
  // One GlobalKey per spotlight target
  final _targetKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowTutorial());
  }

  void _maybeShowTutorial() {
    if (!mounted) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.X));
    if (seen) return;

    // 1. Optionally show FeatureOverlayCard first
    // 2. Then start CoachMarkSequence
    // 3. On complete/skip: markSeen
  }
}
```

---

## UI Components

### `FeatureOverlayCard`

A reusable bottom sheet that slides up over a dimmed screen. Used for the "intro before you dive in" moments.

**Props:**
- `title: String`
- `body: String`
- `iconTiles: List<FeatureIconTile>` (icon + label, shown in a row of 3)
- `ctaLabel: String`
- `onCta: VoidCallback`
- `onSkip: VoidCallback`

**Visual spec:**
- Modal bottom sheet with `borderRadius` top corners (28px).
- Background: `colors.surface`.
- Drag handle at top center (36×4px pill, `colors.outline`).
- Close (✕) icon top-right.
- Title: `AppTypography.h2`, `colors.onBackground`.
- Body: `AppTypography.body`, `colors.onSurfaceDim`.
- Icon tile row: 3 equal tiles, each with a 48×48 rounded container (brand at 10% opacity), `HugeIcon` (22px, brand), label caption below.
- CTA: full-width `ElevatedButton`, brand background.
- Skip: centered `TextButton`, dim color.
- Entry animation: `flutter_animate` `slideY(begin: 0.08)` + `fadeIn`, 350ms.

### `TutorialBubble`

The `contentWidget` passed to each `TargetFocus` in `tutorial_coach_mark`. Renders the arrow-callout box.

**Props:**
- `icon: IconData`
- `title: String`
- `body: String`
- `step: int`
- `totalSteps: int`
- `onNext: VoidCallback`
- `onSkip: VoidCallback`

**Visual spec:**
- White/surface rounded container (16px radius), `AppShadows.md` shadow.
- Icon row: 20px HugeIcon (brand) + bold title (15px).
- Body text: 13px, `colors.onSurfaceDim`, line-height 1.4.
- Footer row: "X of Y" step counter (caption, dim) + spacer + "Skip" (text, dim) + "Next →" / "Done ✓" (text, brand, bold).
- Width: `MediaQuery.of(context).size.width * 0.85`.

### `CoachMarkSequence` helper

A thin wrapper that builds and shows a `TutorialCoachMark` from a list of `TutorialStep` objects.

```dart
class TutorialStep {
  final GlobalKey targetKey;
  final IconData icon;
  final String title;
  final String body;
  final ShapeLightFocus shape; // circle or rect
}

void showCoachMark(
  BuildContext context,
  List<TutorialStep> steps,
  VoidCallback onFinish,
) { ... }
```

---

## Screen-by-Screen Tutorial Definitions

### Home Screen (`TutorialKey.home`)

**Trigger:** First landing on `/customer/home` after post-onboarding redirect.

**Step 1 — FeatureOverlayCard**
- Title: "Welcome to GRIDGO"
- Body: "Your prints, delivered."
- Icon tiles: 🖨️ Order · 🗺️ Track · 💬 Chat
- CTA: "Show me around" → starts coach marks
- Skip: "Skip for now" → markSeen immediately

**Step 2 — Coach mark: Credits chip** (top-right header)
- Target: `GlobalKey` on `_CreditsWidget`
- Shape: `ShapeLightFocus.RRect`
- Title: "GRIDGO Credits"
- Body: "Top up your balance and pay at checkout — no GCash OTP or app-switching needed."
- Step 1 of 2

**Step 3 — Coach mark: GridBot FAB** (bottom-right `FloatingChatButton`)
- Target: `GlobalKey` on `FloatingChatButton`
- Shape: `ShapeLightFocus.Circle`
- Title: "Meet GridBot"
- Body: "Ask anything — order specs, pricing, delivery status. Available 24/7."
- Step 2 of 2 → Done ✓ → markSeen

---

### Checkout Screen (`TutorialKey.checkout`)

**Trigger:** First navigation to `/customer/order/checkout`.

**Step 1 — FeatureOverlayCard**
- Title: "Before you checkout"
- Body: ""
- Icon tiles: 📄 Items · 📍 Delivery · 💳 Payment
- Tip line: "💡 Use Multi-drop to send prints to different addresses in one order."
- CTA: "Got it" → starts coach marks

**Step 2 — Coach mark: Multi-drop tab** (delivery section segmented control)
- Target: `GlobalKey` on the Multi-drop tab within `CheckoutSegmented`
- Shape: `ShapeLightFocus.RRect`
- Title: "Multi-drop Delivery"
- Body: "Assign each file to a different address. One rider handles all the stops."
- Step 1 of 2

**Step 3 — Coach mark: GRIDGO Credits payment row**
- Target: `GlobalKey` on the `CheckoutPaymentCard` container
- Shape: `ShapeLightFocus.RRect`
- Title: "Pay with GRIDGO Credits"
- Body: "No OTP, no app-switching. Top up anytime in Profile → Wallet."
- Step 2 of 2 → Done ✓ → markSeen

---

### Tracking Screen (`TutorialKey.tracking`)

**Trigger:** First navigation to `/customer/tracking`.

**No FeatureOverlayCard** — coach mark fires directly.

**Step 1 — Coach mark: Live map**
- Target: `GlobalKey` on the `DeliveryMap` widget
- Shape: `ShapeLightFocus.RRect`
- Title: "Live Rider Tracking"
- Body: "Your rider's GPS updates in real time. The ETA badge top-right refreshes live."
- Step 1 of 1 → Done ✓ → markSeen

---

## First-Login Gate (OnboardingScreen change)

**Current behaviour:** `/onboarding` is shown on every login (router redirects any authenticated user arriving from an auth route to `/onboarding`).

**New behaviour:** `/onboarding` is shown only if `TutorialKey.onboarding` is NOT in the user's seen keys.

**Router change** (`app_router.dart`):

```dart
// OLD
if (isAuth && isOnAuth) {
  return '/onboarding';
}

// NEW
if (isAuth && isOnAuth) {
  final seen = ref.read(tutorialSeenProvider(TutorialKey.onboarding));
  return seen ? _roleHomePath(ref) : '/onboarding';
  // _roleHomePath: '/customer/home', '/rider/deliveries', or '/admin/dashboard'
}
```

**`OnboardingScreen` change:** On "Get Started" / "Skip" tap, before calling `_goToHome()`:
```dart
ref.read(tutorialProvider.notifier).markSeen(TutorialKey.onboarding);
```

---

## Reset Tutorials (Profile Screen)

**New menu row** under PREFERENCES section in `profile_screen.dart`:
- Icon: `HugeIcons.strokeRoundedRepeat` (or `strokeRoundedRefresh`)
- Label: "Reset Tutorials"
- Trailing: chevron right
- Tap: show confirmation `AlertDialog`

**Confirmation dialog:**
- Title: "Reset Tutorials"
- Body: "Feature guides will reappear next time you visit each screen."
- Actions: "Cancel" | "Reset" (brand color)
- On confirm: `ref.read(tutorialProvider.notifier).resetAll()`

`resetAll()` clears SharedPreferences key + fires `PATCH /users/me/tutorials` with `{ keys: [] }`.

---

## Error Handling

- `markSeen()` network failure: local write always succeeds; server sync is fire-and-forget. On next login, server state is re-synced — worst case the tutorial re-shows once.
- `syncFromServer()` failure at login: fall back to local cache. If local cache is empty (fresh install), all tutorials will show — correct default behaviour.
- `resetAll()` network failure: local is already cleared (tutorials will re-show). Retry is not needed; the next `markSeen()` call will write the new state.

---

## Testing

### Unit tests (`tutorial_repository_test.dart`)
- `markSeen()` writes to SharedPreferences and fires API call.
- `syncFromServer()` overwrites local cache with server keys.
- `resetAll()` clears local cache and fires PATCH with empty array.
- `loadLocal()` returns empty set when no prefs key exists.

### Widget tests
- `FeatureOverlayCard` renders icon tiles, fires `onCta` and `onSkip` callbacks.
- `TutorialBubble` renders step counter, "Next" on non-final steps, "Done ✓" on final step.
- Home screen: tutorial does NOT show when `tutorialSeenProvider(TutorialKey.home)` returns `true`.
- Home screen: tutorial fires when `tutorialSeenProvider(TutorialKey.home)` returns `false`.

### Integration test
- New user flow: register → login → `/onboarding` shown → "Get Started" → home tutorial fires → dismiss → tutorial does NOT fire on re-visit.
- Reset flow: Profile → Reset Tutorials → confirm → return to home → tutorial fires again.

---

## Implementation Order

1. **DB migration** — add `tutorial_seen_keys` column.
2. **Server** — update `UserResponseDto`, add `PATCH /users/me/tutorials` endpoint.
3. **Flutter: tutorial layer** — `TutorialKey`, `TutorialRepository`, `tutorialProvider`.
4. **Flutter: UI components** — `FeatureOverlayCard`, `TutorialBubble`, `CoachMarkSequence`.
5. **Flutter: OnboardingScreen gate** — first-login only change.
6. **Flutter: Home screen** — integrate `TutorialKey.home` tutorial.
7. **Flutter: Checkout screen** — integrate `TutorialKey.checkout` tutorial.
8. **Flutter: Tracking screen** — integrate `TutorialKey.tracking` tutorial.
9. **Flutter: Profile reset** — add "Reset Tutorials" row + dialog.
10. **Tests** — unit + widget + integration.
