# In-App Tutorial — Pipeline Walkthrough Redesign

**Date:** 2026-04-30
**Status:** Approved
**Supersedes:** `2026-04-30-in-app-tutorial-system-design.md` (home/checkout sections)
**Scope:** Replace the "Welcome + feature highlights" home tutorial with a multi-screen guided walkthrough of the print order pipeline. Move feature discovery (Credits / GridBot / Multi-drop / live tracking) into a secondary post-first-order pass. Fix bubble position collision with the chat FAB, drop the bouncy entry animation, restyle the welcome card and CTA.

---

## Goal

A first-time customer is taught **how to use the app** before being taught **what features it has**. The first tutorial walks them screen-by-screen through placing their first print order. Once they've completed (or dismissed) that walkthrough, the secondary "show me the cool stuff" coach marks fire as they encounter the relevant screens.

Bubble positioning auto-adapts to the target's screen position (above for bottom-half targets, below for top-half) so coach marks no longer get clipped by the chat FAB or other bottom-anchored elements. The welcome card and primary CTAs are restyled to match the rest of the app's button language.

---

## Tutorial Key Set

```dart
enum TutorialKey {
  onboarding,        // gates the role onboarding slides (unchanged)
  pipeline,          // multi-screen first-print walkthrough (new)
  homeFeatures,      // Credits chip + GridBot FAB on home (new)
  checkoutFeatures,  // Multi-drop tab + GRID Credits payment (renamed from checkout)
  tracking,          // live-map coach mark (unchanged in behavior, gate updated)
}
```

The previous `home` and `checkout` keys are dropped. Existing users with `home` or `checkout` in their server `tutorial_seen_keys` array are silently handled by `TutorialKey.fromString` returning `null` for unknown strings — they'll see the redesigned tutorials once.

---

## Architecture

### Persisted "seen" state (unchanged)

`tutorialProvider: StateNotifierProvider<TutorialNotifier, Set<TutorialKey>>` — server-synced via `PATCH /users/me/tutorials`, locally cached in SharedPreferences. The new key names go into the same array.

### New: in-memory pipeline state

The pipeline walkthrough requires mid-flow state (which step the user is on across screen navigations). This is **session-only**, not persisted.

```dart
class PipelineState {
  const PipelineState({this.active = false, this.step = PipelineStep.startPrintingTile});
  final bool active;
  final PipelineStep step;
  PipelineState copyWith({bool? active, PipelineStep? step}) =>
      PipelineState(active: active ?? this.active, step: step ?? this.step);
}

enum PipelineStep {
  startPrintingTile,    // 0  Home → "Start Printing" tile
  paperCategoryCard,    // 1  Category → "Paper Printing" card
  paperSpecsForm,       // 2  PaperSpecs → form area
  paperSpecsContinue,   // 3  PaperSpecs → "Continue" button
  uploadCard,           // 4  Upload → file upload card
  checkoutItems,        // 5  Checkout → items section
  checkoutDelivery,     // 6  Checkout → delivery section
  checkoutPayment,      // 7  Checkout → payment section
  placeOrderButton,     // 8  Checkout → "Place Order" footer
  done,                 // 9  Order Success → markSeen(pipeline), active=false
}

class PipelineTutorialNotifier extends StateNotifier<PipelineState> {
  PipelineTutorialNotifier(this._ref) : super(const PipelineState());
  final Ref _ref;

  void start() => state = const PipelineState(active: true, step: PipelineStep.startPrintingTile);
  void advance() {
    final values = PipelineStep.values;
    final next = values[state.step.index + 1];
    state = state.copyWith(step: next);
    if (next == PipelineStep.done) finish();
  }
  void finish() {
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }
  void abandon() {
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }
  void reset() => state = const PipelineState();
}

final pipelineTutorialProvider =
    StateNotifierProvider<PipelineTutorialNotifier, PipelineState>(
  (ref) => PipelineTutorialNotifier(ref),
);
```

### Per-screen integration pattern

Every screen that participates in the pipeline implements:

```dart
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) => _maybePipelineCoachMark());
}

void _maybePipelineCoachMark() {
  if (!mounted) return;
  final state = ref.read(pipelineTutorialProvider);
  if (!state.active || state.step != PipelineStep.<myStep>) return;
  showCoachMark(context, [TutorialStep(...)], () {
    ref.read(pipelineTutorialProvider.notifier).advance();
  });
}
```

For navigation-target steps (e.g. step 0 — "Start Printing" tile), tapping the spotlighted widget both:
1. Advances the pipeline step (via the user's normal handler, augmented to call `advance()` first)
2. Performs its native action (navigation, selection)

For non-navigation targets (e.g. checkout items review), the bubble shows a "Got it →" button that calls `advance()` directly without performing a tap.

### Back-navigation handling

Each pipeline-participating screen detects back-out via `dispose()` checking `pipelineState.active && step == myStep && !_advancedThisFrame`. If true, calls `pipelineTutorialProvider.notifier.abandon()` which marks `pipeline` seen and dismisses. Shows a `SnackBar`: "Tutorial dismissed — replay anytime in Profile → Reset Tutorials."

The `_advancedThisFrame` flag is set when the user taps the spotlighted target (which advances the step), so dispose-after-advance does not trigger the abandon path.

### Eligibility for post-pipeline tutorials

Each post-pipeline tutorial fires when:

```
pipeline ∈ tutorialProvider.seen  ∧  <thisKey> ∉ tutorialProvider.seen
```

These are independent per-screen first-visit fires — no cross-screen state needed.

---

## Visual Fixes

### `FeatureOverlayCard` redesign (slimmer welcome card)

Currently a 3-icon-tile preview. Replaced with:

- **Hero icon block**: 72×72 rounded-square (14px radius), brand-tinted background (`colors.brand.withValues(alpha: 0.10)`), centered `HugeIcon(strokeRoundedPrinter, size: 36, color: colors.brand)`.
- **Title**: `"Let's print something."` — `AppTypography.h1`-equivalent (24px, w800, -0.5 letter-spacing), `colors.onBackground`.
- **Subtitle**: `"We'll walk you through your first order."` — `AppTypography.body`, `colors.onSurfaceDim`, line-height 1.4.
- **Single primary CTA**: `_PrimaryActionButton(label: 'Show me how →', onPressed: ...)` — see button shape spec below.
- **No skip button** on the welcome card — Skip lives only inside the coach marks.
- **Drag handle (36×4 pill)** and **close (✕)** icon top-right stay.
- **Animation**: drop `flutter_animate.slideY`. Keep only `.fadeIn(duration: 200.ms)`. The double-bounce came from `slideY` layered on top of `showModalBottomSheet`'s native slide-up — removing slideY removes the bounce.

The `iconTiles` and `tipLine` props on `FeatureOverlayCard` are kept available (the `checkoutFeatures` and `homeFeatures` flows may still want a multi-tile preview later), but the home pipeline welcome uses the new "hero icon" layout. To support both, `FeatureOverlayCard` gets a new `heroIcon: IconData?` prop. If provided, render the hero block instead of the icon tile row.

### Primary button shape — `_PrimaryActionButton`

Reusable widget, single visual shape used by every primary tutorial CTA. Matches the existing checkout "Place Order" footer button.

```dart
SizedBox(
  width: double.infinity,
  height: 52,
  child: ElevatedButton(
    onPressed: onPressed,
    style: ElevatedButton.styleFrom(
      backgroundColor: colors.brand,
      foregroundColor: Colors.black,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      textStyle: const TextStyle(
        fontFamily: 'Satoshi',
        fontWeight: FontWeight.w800,
        fontSize: 14,
        letterSpacing: 0.3,
      ),
    ),
    child: Text(label),
  ),
)
```

Lives in `lib/features/tutorial/widgets/primary_action_button.dart` so it can be reused elsewhere if needed.

### `TutorialBubble` auto-positioning

`showCoachMark()` resolves `ContentAlign` per step from the target widget's screen Y position:

```dart
ContentAlign _resolveAlign(GlobalKey key, BuildContext ctx) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null) return ContentAlign.bottom;
  final centerY = box.localToGlobal(Offset.zero).dy + box.size.height / 2;
  final screenH = MediaQuery.of(ctx).size.height;
  return centerY > screenH * 0.5 ? ContentAlign.top : ContentAlign.bottom;
}
```

`TutorialStep` gets an optional `align: ContentAlign?` field for edge-case overrides. When `null`, the resolver decides.

This fixes the chat FAB collision: the FAB is bottom-right → `centerY > screenH/2` → bubble renders above it.

### `TutorialBubble` footer trim

Footer becomes:

- **Button-tap targets** (the spotlighted widget itself advances the step): `[step X of N]   [spacer]   [Skip]`
- **Non-button targets** (no native tap to advance): `[step X of N]   [spacer]   [Skip]   [Got it →]`

The "Got it →" button only renders when the bubble is given a non-null `onAdvance` callback distinct from `onSkip`.

---

## Pipeline Step Specifications

Every step uses the bubble auto-position resolver. `TutorialBubble` body text is one short sentence — the user is mid-task and shouldn't read paragraphs.

### Step 0 — Home: "Start Printing" tile

- **Target:** `_StartPrintingTile` (existing widget on the home screen, key wrapped via `KeyedSubtree(key: _startPrintingTutorialKey, ...)`)
- **Shape:** `ShapeLightFocus.RRect`, radius 14
- **Body:** `"Tap here to start your first print order."`
- **Footer:** `[step 1 of 9] [Skip]` (no Got it — they tap the tile to advance)
- **Tap behavior:** the tile's `onTap` calls `pipelineTutorialProvider.notifier.advance()` then `context.push('/customer/order/new')`.

### Step 1 — Category: "Paper Printing" card

- **Target:** the Paper Printing card in `CategoryScreen`
- **Body:** `"Pick **Paper Printing** for documents, photos, posters."`
- **Tap behavior:** Paper card `onTap` calls `advance()` then existing navigation.

### Step 2 — PaperSpecs: form area

- **Target:** the entire scrollable specs form (wraps the column with `KeyedSubtree`)
- **Shape:** `ShapeLightFocus.RRect`
- **Body:** `"Set your paper size, color mode, and copies. Defaults work for most prints."`
- **Footer:** `[step 3 of 9] [Skip] [Got it →]` (form is not a single tap target)
- **Got it tap:** calls `advance()` only, no navigation.

### Step 3 — PaperSpecs: "Continue" button

- **Target:** the bottom "Continue" button on PaperSpecs
- **Body:** `"Tap **Continue** when your specs look right."`
- **Tap behavior:** Continue's `onPressed` calls `advance()` then navigates to upload.

### Step 4 — Upload: file upload card

- **Target:** `FileUploadCard`
- **Body:** `"Drop a file here, or tap to browse. PDFs, images, and docs all work."`
- **Footer:** `[Got it →]` since the card itself uses a file picker (which can't be auto-completed by the tutorial — user must actually pick a file). Got it advances to step 5; the user is then on their own to actually upload, which navigates to checkout.
- **Caveat:** if the user backs out of upload without picking a file, the dispose handler triggers `abandon()` per the back-navigation rule.

### Step 5 — Checkout: items section

- **Target:** `CheckoutItemsCard` (wrapped with `KeyedSubtree`)
- **Body:** `"Quick review of what you're printing."`
- **Footer:** `[Got it →]`

### Step 6 — Checkout: delivery section

- **Target:** `CheckoutDeliveryCard`
- **Body:** `"Pick how you want it delivered — to your door, pickup, or multiple addresses."`
- **Footer:** `[Got it →]`

### Step 7 — Checkout: payment section

- **Target:** `CheckoutPaymentCard`
- **Body:** `"Pick how you want to pay."`
- **Footer:** `[Got it →]`

### Step 8 — Checkout: "Place Order" footer button

- **Target:** the Place Order button in `CheckoutFooter`
- **Body:** `"All set — tap **Place Order** to send it."`
- **Tap behavior:** Place Order's `onPressed` calls `advance()` then existing `_placeOrder()`.

### Step 9 — Order Success: completion

- **Trigger:** Order Success screen's `initState` checks if `pipelineState.step == done` and calls `finish()` immediately. No coach mark — just marks `pipeline` seen and clears active state.
- **Visual:** the success screen renders normally; no overlay.

---

## Post-Pipeline "Other Features" Pass

All gated by `pipeline ∈ seen ∧ <thisKey> ∉ seen`.

### `homeFeatures` (fires on home after first order)

No welcome card. Coach mark sequence directly:

- **Step 1** — Credits chip (top-right header): auto-positions below
  - Body: `"Top up GRID Credits and pay at checkout — no GCash OTP, no app-switching."`
- **Step 2** — GridBot FAB (bottom-right): auto-positions above (← fixes the chat FAB collision)
  - Shape: `ShapeLightFocus.Circle`
  - Body: `"Need help? GridBot answers anything — order specs, pricing, delivery status. 24/7."`
- On finish → `markSeen(homeFeatures)`.

### `checkoutFeatures` (fires next standalone checkout visit, post-pipeline)

- **Step 1** — Multi-drop tab in `CheckoutSegmented`
  - Body: `"Send prints to different addresses in one order. One rider, all the stops."`
- **Step 2** — `CheckoutPaymentCard`
  - Body: `"Pay with GRID Credits — no OTP, no app-switching."`
- On finish → `markSeen(checkoutFeatures)`.

The pipeline walkthrough's checkout steps (5/6/7/8) do NOT touch these specific tabs/rows — they highlight whole sections. So `checkoutFeatures` re-firing on the next visit is not a duplicate.

### `tracking` (fires first tracking visit, post-pipeline)

Behavior unchanged from the original spec, gate now also requires `pipeline ∈ seen`:

- Single coach mark on `DeliveryMap`
- Body: `"Your rider's GPS updates in real time. ETA refreshes live."`
- On finish → `markSeen(tracking)`.

---

## Reset Tutorials Flow

Profile → Preferences → "Reset Tutorials" row (unchanged from current spec).

On confirm:

1. `tutorialProvider.notifier.resetAll()` → server PATCH `[]`, prefs cleared, local state `{}`
2. `pipelineTutorialProvider.notifier.reset()` → in-memory pipeline state cleared
3. `SnackBar`: `"Tutorials reset — they'll show again on your next visit."`

After reset, on next home load:
- `pipeline ∉ seen` → welcome card "Let's print something." appears
- Tapping "Show me how →" calls `pipelineTutorialProvider.notifier.start()` → state.active=true, step=0
- Walkthrough proceeds as on first run

The `onboarding` key reset is preserved — onboarding slides reappear on next login. Matches user expectation of "reset everything."

---

## Server Changes

None. Existing `tutorial_seen_keys text[]` column and `PATCH /users/me/tutorials` endpoint already handle arbitrary string arrays. New key names (`pipeline`, `homeFeatures`, `checkoutFeatures`) are accepted as-is.

---

## File Map

**New files:**
- `lib/features/tutorial/providers/pipeline_tutorial_provider.dart` — `PipelineState`, `PipelineStep` enum, `PipelineTutorialNotifier`, `pipelineTutorialProvider`
- `lib/features/tutorial/widgets/primary_action_button.dart` — `_PrimaryActionButton` shared widget
- `apps/mobile/test/features/tutorial/pipeline_tutorial_provider_test.dart` — start/advance/finish/abandon/reset tests

**Modified files:**
- `lib/features/tutorial/models/tutorial_key.dart` — replace `home`/`checkout` with `pipeline`/`homeFeatures`/`checkoutFeatures`
- `lib/features/tutorial/widgets/feature_overlay_card.dart` — add `heroIcon`, drop slideY, restyle CTA
- `lib/features/tutorial/widgets/tutorial_bubble.dart` — footer trim, optional `onAdvance` for "Got it →"
- `lib/features/tutorial/widgets/coach_mark_sequence.dart` — auto-position resolver
- `lib/features/customer/home/screens/home_screen.dart` — replace `home` tutorial with pipeline step 0 + `homeFeatures` post-pipeline tutorial
- `lib/features/customer/home/widgets/...` (or wherever `_StartPrintingTile` lives) — wrap with `KeyedSubtree`, augment `onTap` to call `advance()`
- `lib/features/customer/order/screens/category_screen.dart` — pipeline step 1
- `lib/features/customer/order/screens/paper_specs_screen.dart` — pipeline steps 2 + 3
- `lib/features/customer/order/screens/upload_screen.dart` — pipeline step 4
- `lib/features/customer/order/screens/checkout_screen.dart` — replace `checkout` tutorial with pipeline steps 5/6/7/8 + `checkoutFeatures` post-pipeline tutorial
- `lib/features/customer/order/screens/order_success_screen.dart` — pipeline step 9 (finish)
- `lib/features/customer/tracking/screens/delivery_tracking_screen.dart` — gate now also requires `pipeline ∈ seen`
- `lib/features/customer/profile/screens/profile_screen.dart` — `_confirmResetTutorials` also calls `pipelineTutorialProvider.notifier.reset()`

---

## Error Handling

- **Pipeline target missing** (e.g. screen renders but the keyed widget hasn't mounted): the post-frame callback runs after layout, so `RenderBox` should be available. If `currentContext == null`, `_resolveAlign` falls back to `ContentAlign.bottom`. The coach mark library handles missing targets by skipping that step gracefully.
- **User navigates forward via a non-spotlighted path** (e.g. opens a side menu mid-walkthrough): the destination screen won't match the expected step → no coach mark fires. When they back out, the dispose handler abandons the tutorial.
- **markSeen network failure** during pipeline finish: same as today — local prefs write succeeds, server sync is fire-and-forget. Worst case the pipeline re-fires on next login (rare).

---

## Testing

### Unit tests

- `pipeline_tutorial_provider_test.dart`:
  - `start()` sets active=true, step=startPrintingTile
  - `advance()` increments through all steps and fires `finish()` on `done`
  - `finish()` calls `markSeen(pipeline)` and clears state
  - `abandon()` calls `markSeen(pipeline)` and clears state
  - `reset()` clears state without marking seen

### Widget tests

- `feature_overlay_card_test.dart`: hero icon variant renders, CTA "Show me how →" fires onCta, no Skip button visible when `heroIcon` is set
- `tutorial_bubble_test.dart`: footer shows "Got it →" only when `onAdvance != null`, step counter format unchanged

### Integration tests

- New-user flow: register → onboarding → home shows welcome card → "Show me how →" → step 0 fires → tap Start Printing → step 1 fires on Category → ... → step 8 → tap Place Order → step 9 fires on Order Success → pipeline marked seen → return to home → `homeFeatures` fires
- Back-navigation flow: start pipeline → tap Start Printing → land on Category at step 1 → press back → `abandon()` fires → pipeline marked seen → SnackBar shown
- Reset flow: complete pipeline → Profile → Reset Tutorials → confirm → return to home → welcome card reappears → walkthrough resumes from step 0

---

## Implementation Order

1. **Tutorial layer foundations** — update `TutorialKey` enum, add `PipelineTutorialNotifier`, add `_PrimaryActionButton`
2. **Visual fixes** — `FeatureOverlayCard` hero variant + drop slideY, `TutorialBubble` footer trim, `coach_mark_sequence` auto-position
3. **Pipeline step 0** — home screen "Start Printing" tile + welcome card "Let's print something."
4. **Pipeline steps 1–4** — Category, PaperSpecs (form + Continue), Upload
5. **Pipeline steps 5–8** — Checkout (items, delivery, payment, place order)
6. **Pipeline step 9** — Order Success completion
7. **Back-navigation abandon** — dispose hooks on each pipeline screen
8. **Post-pipeline tutorials** — rewire home `homeFeatures`, checkout `checkoutFeatures`, tracking gate
9. **Reset flow** — extend `_confirmResetTutorials` to reset pipeline state
10. **Tests + final build**
