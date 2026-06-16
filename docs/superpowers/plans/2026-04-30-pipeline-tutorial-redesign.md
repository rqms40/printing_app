# Pipeline Tutorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home/checkout feature-highlight tutorials with a multi-screen guided walkthrough of the print order pipeline, move feature discovery into a post-first-order pass, fix bubble auto-positioning to eliminate FAB collisions, drop the bouncy welcome animation, and restyle the welcome card and primary CTA.

**Architecture:** A new `PipelineTutorialNotifier` (StateNotifier, session-only) tracks `active` + `step` across screens. Each pipeline-participating screen reads the provider in `postFrameCallback`, fires its coach mark when its step matches, advances the state on tap, and abandons via `dispose()` on back-navigation. The persistent `tutorialProvider` (already server-synced) stores the new `pipeline`, `homeFeatures`, `checkoutFeatures`, `tracking` keys to gate first-time fires.

**Tech Stack:** Flutter + Riverpod (`StateNotifier`), `tutorial_coach_mark: ^1.2.11` (already installed), `flutter_animate`, `hugeicons`, SharedPreferences.

---

## File Map

**New files:**
- `apps/mobile/lib/features/tutorial/providers/pipeline_tutorial_provider.dart`
- `apps/mobile/lib/features/tutorial/widgets/primary_action_button.dart`
- `apps/mobile/test/features/tutorial/pipeline_tutorial_provider_test.dart`

**Modified files:**
- `apps/mobile/lib/features/tutorial/models/tutorial_key.dart` — replace enum values
- `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart` — `heroIcon` variant + drop slideY + new CTA shape
- `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart` — optional `onAdvance` ("Got it →") + footer trim
- `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart` — auto-position resolver
- `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart` — hero variant test
- `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart` — Got it tests
- `apps/mobile/lib/features/customer/home/screens/home_screen.dart` — pipeline step 0 + welcome card + post-pipeline `homeFeatures`
- `apps/mobile/lib/features/customer/order/screens/category_screen.dart` — pipeline step 1
- `apps/mobile/lib/features/customer/order/screens/paper_specs_screen.dart` — pipeline steps 2 & 3
- `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` — pipeline step 4
- `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart` — pipeline steps 5–8 + post-pipeline `checkoutFeatures`
- `apps/mobile/lib/features/customer/order/screens/order_success_screen.dart` — pipeline step 9 (finish)
- `apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart` — accept `tutorialKey`
- `apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart` — accept `tutorialKey` for Place Order button
- `apps/mobile/lib/features/customer/tracking/screens/delivery_tracking_screen.dart` — gate now also requires `pipeline ∈ seen`
- `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` — `_confirmResetTutorials` also resets pipeline state

---

## Task 1: Replace `TutorialKey` enum values

**Files:**
- Modify: `apps/mobile/lib/features/tutorial/models/tutorial_key.dart`

- [ ] **Step 1: Replace the enum**

Open the file and replace the entire content with:

```dart
enum TutorialKey {
  onboarding,
  pipeline,
  homeFeatures,
  checkoutFeatures,
  tracking;

  static TutorialKey? fromString(String value) {
    for (final key in TutorialKey.values) {
      if (key.name == value) return key;
    }
    return null;
  }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_repository_test.dart
```

Expected: 5 tests pass (the repository tests don't reference removed keys).

- [ ] **Step 3: Verify no other code references removed keys**

```bash
grep -rn "TutorialKey.home\b\|TutorialKey.checkout\b" /home/jd/projects/printing_app/apps/mobile/lib /home/jd/projects/printing_app/apps/mobile/test 2>&1 | head -20
```

Expected: only references in files we'll update in later tasks (home_screen.dart, checkout_screen.dart, profile_screen.dart, tutorial_repository_test.dart). Note them — they will be replaced in Tasks 9, 10, 11.

The repository test at line `'tutorial_seen_keys': '["onboarding","unknown_future_key"]'` already tests unknown-key dropping; this still passes.

- [ ] **Step 4: Update repo test that references `home`**

Open `apps/mobile/test/features/tutorial/tutorial_repository_test.dart`. Find any test using `TutorialKey.home` or `TutorialKey.checkout` and replace with `TutorialKey.pipeline` and `TutorialKey.homeFeatures`. Specifically the test `'markSeen adds key to existing set'` and `'syncFromServer writes server keys to prefs'` — replace any string `'home'`/`'checkout'` with `'pipeline'`/`'homeFeatures'` and any enum `TutorialKey.home`/`TutorialKey.checkout` with `TutorialKey.pipeline`/`TutorialKey.homeFeatures`.

Re-run:
```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_repository_test.dart
```

Expected: 5 tests pass.

- [ ] **Step 5: Do not commit** — user requires explicit approval before commits.

---

## Task 2: Add `_PrimaryActionButton` shared widget

**Files:**
- Create: `apps/mobile/lib/features/tutorial/widgets/primary_action_button.dart`

- [ ] **Step 1: Create the file**

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';

class PrimaryActionButton extends StatelessWidget {
  const PrimaryActionButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.brand,
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
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
    );
  }
}
```

- [ ] **Step 2: Verify compile**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/tutorial/widgets/primary_action_button.dart
```

Expected: `No issues found!`

---

## Task 3: Pipeline tutorial provider with tests

**Files:**
- Create: `apps/mobile/lib/features/tutorial/providers/pipeline_tutorial_provider.dart`
- Create: `apps/mobile/test/features/tutorial/pipeline_tutorial_provider_test.dart`

- [ ] **Step 1: Write the failing tests first**

Create `apps/mobile/test/features/tutorial/pipeline_tutorial_provider_test.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('PipelineTutorialNotifier', () {
    test('initial state is inactive at startPrintingTile', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);
    });

    test('start sets active=true at startPrintingTile', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isTrue);
      expect(state.step, PipelineStep.startPrintingTile);
    });

    test('advance moves to next step', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      expect(
        container.read(pipelineTutorialProvider).step,
        PipelineStep.paperCategoryCard,
      );
    });

    test('advance from placeOrderButton triggers finish (marks pipeline seen, clears state)', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Walk to placeOrderButton then advance once more (which lands on `done` and finishes)
      final notifier = container.read(pipelineTutorialProvider.notifier);
      notifier.start();
      for (var i = 0; i < PipelineStep.placeOrderButton.index; i++) {
        notifier.advance();
      }
      expect(
        container.read(pipelineTutorialProvider).step,
        PipelineStep.placeOrderButton,
      );

      notifier.advance(); // → done → finish()

      // After finish: state cleared, pipeline marked seen
      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);

      // Allow the async markSeen to flush
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(tutorialProvider).contains(TutorialKey.pipeline),
        isTrue,
      );
    });

    test('abandon marks pipeline seen and clears state', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      container.read(pipelineTutorialProvider.notifier).abandon();

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);

      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(tutorialProvider).contains(TutorialKey.pipeline),
        isTrue,
      );
    });

    test('reset clears state without marking seen', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pipelineTutorialProvider.notifier).start();
      container.read(pipelineTutorialProvider.notifier).advance();
      container.read(pipelineTutorialProvider.notifier).reset();

      final state = container.read(pipelineTutorialProvider);
      expect(state.active, isFalse);
      expect(state.step, PipelineStep.startPrintingTile);

      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(tutorialProvider).contains(TutorialKey.pipeline),
        isFalse,
      );
    });
  });
}
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/pipeline_tutorial_provider_test.dart 2>&1 | tail -10
```

Expected: compile error — file does not exist yet.

- [ ] **Step 3: Create the provider**

Create `apps/mobile/lib/features/tutorial/providers/pipeline_tutorial_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';

enum PipelineStep {
  startPrintingTile,
  paperCategoryCard,
  paperSpecsForm,
  paperSpecsContinue,
  uploadCard,
  checkoutItems,
  checkoutDelivery,
  checkoutPayment,
  placeOrderButton,
  done,
}

class PipelineState {
  const PipelineState({
    this.active = false,
    this.step = PipelineStep.startPrintingTile,
  });

  final bool active;
  final PipelineStep step;

  PipelineState copyWith({bool? active, PipelineStep? step}) =>
      PipelineState(
        active: active ?? this.active,
        step: step ?? this.step,
      );
}

class PipelineTutorialNotifier extends StateNotifier<PipelineState> {
  PipelineTutorialNotifier(this._ref) : super(const PipelineState());

  final Ref _ref;

  void start() {
    state = const PipelineState(
      active: true,
      step: PipelineStep.startPrintingTile,
    );
  }

  void advance() {
    final values = PipelineStep.values;
    final nextIndex = state.step.index + 1;
    if (nextIndex >= values.length) {
      finish();
      return;
    }
    final next = values[nextIndex];
    if (next == PipelineStep.done) {
      finish();
      return;
    }
    state = state.copyWith(step: next);
  }

  void finish() {
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }

  void abandon() {
    _ref.read(tutorialProvider.notifier).markSeen(TutorialKey.pipeline);
    state = const PipelineState();
  }

  void reset() {
    state = const PipelineState();
  }
}

final pipelineTutorialProvider =
    StateNotifierProvider<PipelineTutorialNotifier, PipelineState>(
  (ref) => PipelineTutorialNotifier(ref),
);
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/pipeline_tutorial_provider_test.dart 2>&1 | tail -10
```

Expected: 6 tests pass.

---

## Task 4: Coach mark auto-position resolver

**Files:**
- Modify: `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart`

- [ ] **Step 1: Read current file**

Read `apps/mobile/lib/features/tutorial/widgets/coach_mark_sequence.dart` to understand the current `showCoachMark` and `TutorialStep` shapes.

- [ ] **Step 2: Replace the file content**

```dart
import 'package:flutter/material.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

class TutorialStep {
  const TutorialStep({
    required this.targetKey,
    required this.icon,
    required this.title,
    required this.body,
    this.shape = ShapeLightFocus.RRect,
    this.align,
    this.advanceOnSpotlightTap = true,
  });

  final GlobalKey targetKey;
  final dynamic icon;
  final String title;
  final String body;
  final ShapeLightFocus shape;

  /// If null, align is auto-resolved per-step from target Y position.
  final ContentAlign? align;

  /// True for steps where the user taps the spotlighted widget itself
  /// to advance (the bubble shows only Skip). False for sections that
  /// need an explicit "Got it →" button (passed as `onAdvance` to the bubble).
  final bool advanceOnSpotlightTap;
}

ContentAlign _resolveAlign(GlobalKey key, BuildContext ctx) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null) return ContentAlign.bottom;
  final centerY = box.localToGlobal(Offset.zero).dy + box.size.height / 2;
  final screenH = MediaQuery.of(ctx).size.height;
  return centerY > screenH * 0.5 ? ContentAlign.top : ContentAlign.bottom;
}

void showCoachMark(
  BuildContext context,
  List<TutorialStep> steps,
  VoidCallback onFinish, {
  VoidCallback? onSkip,
}) {
  final targets = steps.asMap().entries.map((entry) {
    final i = entry.key;
    final step = entry.value;
    final align = step.align ?? _resolveAlign(step.targetKey, context);

    return TargetFocus(
      identify: '${step.title}-$i',
      keyTarget: step.targetKey,
      shape: step.shape,
      radius: 8,
      paddingFocus: 8,
      enableOverlayTab: false,
      contents: [
        TargetContent(
          align: align,
          builder: (context, controller) => TutorialBubble(
            icon: step.icon,
            title: step.title,
            body: step.body,
            step: i + 1,
            totalSteps: steps.length,
            onSkip: controller.skip,
            onAdvance: step.advanceOnSpotlightTap
                ? null
                : controller.next,
          ),
        ),
      ],
    );
  }).toList();

  TutorialCoachMark(
    targets: targets,
    colorShadow: Colors.black,
    opacityShadow: 0.75,
    onFinish: onFinish,
    onSkip: () {
      (onSkip ?? onFinish).call();
      return true;
    },
  ).show(context: context);
}
```

- [ ] **Step 3: Verify compile**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/tutorial/
```

Note: this will fail on `tutorial_bubble.dart` until Task 5 is done because we changed `onNext` → `onAdvance`. That's expected — proceed to Task 5 immediately.

---

## Task 5: TutorialBubble footer trim + onAdvance

**Files:**
- Modify: `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart`
- Modify: `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart`

- [ ] **Step 1: Update tests first (TDD)**

Replace the content of `apps/mobile/test/features/tutorial/tutorial_bubble_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/tutorial_bubble.dart';

void main() {
  group('TutorialBubble', () {
    testWidgets('shows step counter and Skip but no Got it when onAdvance is null', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'GRIDGO Credits',
            body: 'Pay without GCash.',
            step: 1,
            totalSteps: 2,
            onSkip: () {},
            onAdvance: null,
          ),
        ),
      ));
      expect(find.text('1 of 2'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Got it →'), findsNothing);
    });

    testWidgets('shows Got it → when onAdvance is provided', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'Items',
            body: 'Quick review.',
            step: 5,
            totalSteps: 9,
            onSkip: () {},
            onAdvance: () {},
          ),
        ),
      ));
      expect(find.text('Got it →'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
    });

    testWidgets('Got it → fires onAdvance', (tester) async {
      bool advanced = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'T',
            body: 'B',
            step: 1,
            totalSteps: 3,
            onSkip: () {},
            onAdvance: () => advanced = true,
          ),
        ),
      ));
      await tester.tap(find.text('Got it →'));
      expect(advanced, isTrue);
    });

    testWidgets('Skip fires onSkip', (tester) async {
      bool skipped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: TutorialBubble(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'T',
            body: 'B',
            step: 1,
            totalSteps: 3,
            onSkip: () => skipped = true,
            onAdvance: null,
          ),
        ),
      ));
      await tester.tap(find.text('Skip'));
      expect(skipped, isTrue);
    });
  });
}
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_bubble_test.dart 2>&1 | tail -15
```

Expected: tests fail / compile error (the bubble's old `onNext` API doesn't match).

- [ ] **Step 3: Replace `tutorial_bubble.dart`**

Replace the content of `apps/mobile/lib/features/tutorial/widgets/tutorial_bubble.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class TutorialBubble extends StatelessWidget {
  const TutorialBubble({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.step,
    required this.totalSteps,
    required this.onSkip,
    required this.onAdvance,
  });

  final dynamic icon;
  final String title;
  final String body;
  final int step;
  final int totalSteps;
  final VoidCallback onSkip;

  /// When non-null, renders a "Got it →" button on the right that calls this.
  /// When null (most pipeline steps), only Skip is shown — the user advances
  /// by tapping the spotlighted target itself.
  final VoidCallback? onAdvance;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final width = MediaQuery.of(context).size.width * 0.85;

    return Container(
      width: width,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HugeIcon(icon: icon, color: colors.brand, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTypography.body.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Text(
                '$step of $totalSteps',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: onSkip,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: 4,
                  ),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Skip',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
              if (onAdvance != null) ...[
                const SizedBox(width: AppSpacing.sm),
                TextButton(
                  onPressed: onAdvance,
                  style: TextButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 4,
                    ),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Got it →',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/tutorial_bubble_test.dart 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Run analyze on the whole tutorial folder**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/tutorial/
```

Expected: `No issues found!`

---

## Task 6: FeatureOverlayCard hero variant + drop slideY

**Files:**
- Modify: `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart`
- Modify: `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart`

- [ ] **Step 1: Update tests first (TDD)**

Replace the content of `apps/mobile/test/features/tutorial/feature_overlay_card_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';

void main() {
  group('FeatureOverlayCard', () {
    testWidgets('hero variant renders title, body, and primary CTA', (tester) async {
      bool ctaTapped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            heroIcon: HugeIcons.strokeRoundedPrinter,
            title: "Let's print something.",
            body: "We'll walk you through your first order.",
            iconTiles: const [],
            ctaLabel: 'Show me how →',
            onCta: () => ctaTapped = true,
            onSkip: () {},
            showSkip: false,
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text("Let's print something."), findsOneWidget);
      expect(find.text("We'll walk you through your first order."), findsOneWidget);
      expect(find.text('Show me how →'), findsOneWidget);
      expect(find.text('Skip for now'), findsNothing);

      await tester.tap(find.text('Show me how →'));
      expect(ctaTapped, isTrue);
    });

    testWidgets('icon tile variant still renders tiles when heroIcon is null', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'Welcome',
            body: 'Body',
            iconTiles: const [
              FeatureIconTile(icon: HugeIcons.strokeRoundedPrinter, label: 'Order'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedLocation01, label: 'Track'),
              FeatureIconTile(icon: HugeIcons.strokeRoundedMessage01, label: 'Chat'),
            ],
            ctaLabel: 'Got it',
            onCta: () {},
            onSkip: () {},
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Order'), findsOneWidget);
      expect(find.text('Track'), findsOneWidget);
      expect(find.text('Chat'), findsOneWidget);
    });

    testWidgets('Skip for now visible when showSkip is true', (tester) async {
      bool skipped = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FeatureOverlayCard(
            title: 'T', body: 'B',
            iconTiles: const [],
            ctaLabel: 'Got it',
            onCta: () {},
            onSkip: () => skipped = true,
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text('Skip for now'));
      expect(skipped, isTrue);
    });
  });
}
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/feature_overlay_card_test.dart 2>&1 | tail -15
```

Expected: at least the first test fails (heroIcon and showSkip props don't exist yet).

- [ ] **Step 3: Replace the widget**

Replace the content of `apps/mobile/lib/features/tutorial/widgets/feature_overlay_card.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/tutorial/widgets/primary_action_button.dart';

class FeatureIconTile {
  const FeatureIconTile({required this.icon, required this.label});
  final dynamic icon;
  final String label;
}

class FeatureOverlayCard extends StatelessWidget {
  const FeatureOverlayCard({
    super.key,
    required this.title,
    required this.body,
    required this.iconTiles,
    required this.ctaLabel,
    required this.onCta,
    required this.onSkip,
    this.tipLine,
    this.heroIcon,
    this.showSkip = true,
  });

  final String title;
  final String body;
  final List<FeatureIconTile> iconTiles;
  final String ctaLabel;
  final VoidCallback onCta;
  final VoidCallback onSkip;
  final String? tipLine;

  /// When non-null, renders a single hero icon block instead of the icon-tile row.
  final dynamic heroIcon;

  /// Whether to render the "Skip for now" text button. False for the pipeline
  /// welcome card — skipping happens via the coach-mark bubbles instead.
  final bool showSkip;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl, AppSpacing.md, AppSpacing.xl, AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: colors.outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          if (heroIcon != null) ...[
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: HugeIcon(
                    icon: heroIcon,
                    color: colors.brand,
                    size: 36,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          Center(
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.h2.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                fontSize: 24,
              ),
            ),
          ),

          if (body.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                  height: 1.4,
                ),
              ),
            ),
          ],

          if (heroIcon == null && iconTiles.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: iconTiles.map((tile) => Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        color: colors.brand.withValues(alpha: 0.10),
                        borderRadius: AppRadius.borderMd,
                      ),
                      child: Center(
                        child: HugeIcon(
                          icon: tile.icon,
                          color: colors.brand,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      tile.label,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )).toList(),
            ),
          ],

          if (tipLine != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: 10,
              ),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.10),
                borderRadius: AppRadius.borderMd,
              ),
              child: Text(
                tipLine!,
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground, fontSize: 12,
                ),
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          PrimaryActionButton(label: ctaLabel, onPressed: onCta),

          if (showSkip) ...[
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: TextButton(
                onPressed: onSkip,
                child: Text(
                  'Skip for now',
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 200.ms);
  }
}
```

Note: `slideY` is dropped. `showModalBottomSheet` provides the slide-up natively.

- [ ] **Step 4: Run tests, verify they pass**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/feature_overlay_card_test.dart 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Run analyze**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/tutorial/
```

Expected: `No issues found!`

---

## Task 7: Home screen — pipeline step 0 + welcome card + post-pipeline `homeFeatures`

**Files:**
- Modify: `apps/mobile/lib/features/customer/home/screens/home_screen.dart`

- [ ] **Step 1: Read the file to locate insertion points**

Read `apps/mobile/lib/features/customer/home/screens/home_screen.dart`. Note:
- Existing tutorial keys (`_creditsTutorialKey`, `_chatFabTutorialKey`) and the `_maybeShowHomeTutorial` method
- The `_StartPrintingTile` usage around line 303 and the class definition at line 1416
- The `_HomeScreenState.initState` post-frame callback structure

- [ ] **Step 2: Add a new `_startPrintingTutorialKey` field**

In the `_HomeScreenState` class, near the existing `_creditsTutorialKey` and `_chatFabTutorialKey`:

```dart
  final _startPrintingTutorialKey = GlobalKey();
```

- [ ] **Step 3: Add imports**

At the top of the file, ensure these imports exist (some are already there):

```dart
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
```

- [ ] **Step 4: Replace `_maybeShowHomeTutorial` with the new pipeline-aware logic**

Find the existing `_maybeShowHomeTutorial()` method and replace it (and the subsequent `_startHomeCoachMarks()`) with:

```dart
  void _maybeShowHomeTutorial() {
    if (!mounted) return;

    // First-time pipeline: show welcome card → user taps "Show me how →" to start
    if (!ref.read(tutorialSeenProvider(TutorialKey.pipeline))) {
      _showPipelineWelcomeCard();
      return;
    }

    // Post-pipeline: home features (Credits + GridBot)
    if (!ref.read(tutorialSeenProvider(TutorialKey.homeFeatures))) {
      _startHomeFeaturesCoachMarks();
      return;
    }
  }

  void _showPipelineWelcomeCard() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FeatureOverlayCard(
        heroIcon: HugeIcons.strokeRoundedPrinter,
        title: "Let's print something.",
        body: "We'll walk you through your first order.",
        iconTiles: const [],
        ctaLabel: 'Show me how →',
        showSkip: false,
        onCta: () {
          Navigator.of(context).pop();
          ref.read(pipelineTutorialProvider.notifier).start();
          _showPipelineStartCoachMark();
        },
        onSkip: () {}, // unused — showSkip is false
      ),
    );
  }

  void _showPipelineStartCoachMark() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _startPrintingTutorialKey,
          icon: HugeIcons.strokeRoundedPrinter,
          title: 'Start Printing',
          body: 'Tap here to start your first print order.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: true,
        ),
      ],
      () {}, // onFinish is a no-op — advance happens via the tile's onTap
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _startHomeFeaturesCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _creditsTutorialKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'GRIDGO Credits',
          body: 'Top up GRIDGO Credits and pay at checkout — no GCash OTP, no app-switching.',
          advanceOnSpotlightTap: false,
        ),
        TutorialStep(
          targetKey: _chatFabTutorialKey,
          icon: HugeIcons.strokeRoundedMessage01,
          title: 'Meet GridBot',
          body: 'Need help? GridBot answers anything — order specs, pricing, delivery status. 24/7.',
          shape: ShapeLightFocus.Circle,
          advanceOnSpotlightTap: false,
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.homeFeatures),
    );
  }
```

- [ ] **Step 5: Re-fire pipeline coach mark when home rebuilds (optional safety)**

Inside the existing `initState` second `addPostFrameCallback`, ensure it also re-checks pipeline state on each home entry. The current call `_maybeShowHomeTutorial();` is sufficient — no extra changes needed here.

- [ ] **Step 6: Wrap `_StartPrintingTile` with the tutorial key + augment onTap**

Find where `_StartPrintingTile` is rendered (around line 303). Replace with:

```dart
KeyedSubtree(
  key: _startPrintingTutorialKey,
  child: _StartPrintingTile(
    colors: colors,
    onTap: () {
      // If pipeline is active at step 0, advance before navigating
      final pipeline = ref.read(pipelineTutorialProvider);
      if (pipeline.active && pipeline.step == PipelineStep.startPrintingTile) {
        ref.read(pipelineTutorialProvider.notifier).advance();
      }
      context.push('/customer/order/new');
    },
  ),
),
```

If the existing `onTap` did something other than `context.push('/customer/order/new')`, preserve that — only insert the pipeline-advance line before whatever existing call was there.

- [ ] **Step 7: Build and verify**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

Expected: `✓ Built build/web`.

---

## Task 8: Category screen — pipeline step 1

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/category_screen.dart`

- [ ] **Step 1: Read the file**

Read the screen and identify:
- The widget rendering "Paper Printing" — likely a `Card`, `_CategoryCard`, or `InkWell`
- The class — is it `ConsumerWidget` or `ConsumerStatefulWidget`? Convert if needed.

- [ ] **Step 2: Convert to ConsumerStatefulWidget if needed**

If currently `ConsumerWidget`, convert. The pattern:

```dart
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key});

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  final _paperCategoryKey = GlobalKey();
  bool _advancedThisFrame = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePipelineCoachMark());
  }

  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    if (state.active &&
        state.step == PipelineStep.paperCategoryCard &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      _showAbandonSnack();
    }
    super.dispose();
  }

  void _showAbandonSnack() {
    // Cannot use context here in dispose; instead, schedule via root scaffold messenger
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
      ),
    );
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.paperCategoryCard) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _paperCategoryKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Paper Printing',
          body: 'Pick Paper Printing for documents, photos, and posters.',
          advanceOnSpotlightTap: true,
        ),
      ],
      () {},
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }
```

(Existing `build()` method body moves into the new state class; ref is now `this.ref` instead of a parameter.)

- [ ] **Step 3: Wrap the Paper Printing card with the key + augment its onTap**

In the build method, locate the Paper Printing card. Wrap with:

```dart
KeyedSubtree(
  key: _paperCategoryKey,
  child: <ExistingPaperCardWidget>(
    onTap: () {
      final pipeline = ref.read(pipelineTutorialProvider);
      if (pipeline.active && pipeline.step == PipelineStep.paperCategoryCard) {
        _advancedThisFrame = true;
        ref.read(pipelineTutorialProvider.notifier).advance();
      }
      // existing navigation: context.push('/customer/order/paper-specs') or similar
      <existing onTap body>
    },
  ),
),
```

Preserve the existing `onTap` body — only inject the advance call before it.

- [ ] **Step 4: Add imports**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
```

- [ ] **Step 5: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

Expected: `✓ Built build/web`.

---

## Task 9: PaperSpecs screen — pipeline steps 2 and 3

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/paper_specs_screen.dart`

- [ ] **Step 1: Read the file**

Identify:
- Form column wrapper that contains size/color/copies selectors — this becomes step 2's target
- The "Continue" button at line ~162 (label: 'Continue', onTap: _onContinue) — step 3's target
- Whether the screen is `ConsumerStatefulWidget` (likely is, since it has `_onContinue`)

- [ ] **Step 2: Add tutorial keys + lifecycle**

In the state class:

```dart
  final _specsFormKey = GlobalKey();
  final _specsContinueKey = GlobalKey();
  bool _advancedThisFrame = false;

  @override
  void initState() {
    super.initState();
    // ... existing initState body ...
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePipelineCoachMark());
  }

  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    if (state.active &&
        (state.step == PipelineStep.paperSpecsForm ||
         state.step == PipelineStep.paperSpecsContinue) &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
        ),
      );
    }
    super.dispose();
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active) return;

    if (state.step == PipelineStep.paperSpecsForm) {
      showCoachMark(
        context,
        [
          TutorialStep(
            targetKey: _specsFormKey,
            icon: HugeIcons.strokeRoundedSettings02,
            title: 'Set your specs',
            body: 'Set your paper size, color mode, and copies. Defaults work for most prints.',
            shape: ShapeLightFocus.RRect,
            advanceOnSpotlightTap: false,
          ),
        ],
        () => ref.read(pipelineTutorialProvider.notifier).advance(),
        onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
      );
    } else if (state.step == PipelineStep.paperSpecsContinue) {
      showCoachMark(
        context,
        [
          TutorialStep(
            targetKey: _specsContinueKey,
            icon: HugeIcons.strokeRoundedArrowRight01,
            title: 'Continue',
            body: 'Tap Continue when your specs look right.',
            advanceOnSpotlightTap: true,
          ),
        ],
        () {},
        onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
      );
    }
  }
```

If `HugeIcons.strokeRoundedSettings02` or `strokeRoundedArrowRight01` don't exist, swap for whatever is available — confirm with:

```bash
grep -rn "strokeRoundedSettings\|strokeRoundedArrowRight" /home/jd/projects/printing_app/apps/mobile/lib --include="*.dart" | head -5
```

- [ ] **Step 3: Wrap the form column with `_specsFormKey`**

In the build method, find the outer `Column` or `ListView` containing the spec selectors. Wrap with:

```dart
KeyedSubtree(
  key: _specsFormKey,
  child: <existing form column>,
),
```

- [ ] **Step 4: Wrap the Continue button with `_specsContinueKey` + augment onTap**

Find the Continue button (around line 162). Wrap and augment:

```dart
KeyedSubtree(
  key: _specsContinueKey,
  child: <ExistingContinueButton>(
    label: 'Continue',
    onTap: () {
      final pipeline = ref.read(pipelineTutorialProvider);
      if (pipeline.active && pipeline.step == PipelineStep.paperSpecsContinue) {
        _advancedThisFrame = true;
        ref.read(pipelineTutorialProvider.notifier).advance();
      }
      _onContinue();
    },
  ),
),
```

- [ ] **Step 5: Hook the form-step "Got it" advance**

Step 2's `onAdvance` is the bubble's "Got it →" — already wired via `advanceOnSpotlightTap: false` and the `onFinish` callback in `showCoachMark`. After tapping Got it, the second pipeline step (`paperSpecsContinue`) doesn't auto-fire on the same screen — we must re-trigger the coach mark check. Add at the end of the `onFinish` for the form step:

```dart
        () {
          ref.read(pipelineTutorialProvider.notifier).advance();
          // Re-trigger to fire the Continue coach mark on the same screen
          WidgetsBinding.instance.addPostFrameCallback((_) => _maybePipelineCoachMark());
        },
```

- [ ] **Step 6: Add imports**

```dart
import 'package:hugeicons/hugeicons.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
```

- [ ] **Step 7: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 10: Upload screen — pipeline step 4

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`

- [ ] **Step 1: Read the file**

Identify:
- The `FileUploadCard` widget usage in the build
- Whether `UploadScreen` is `ConsumerStatefulWidget`

- [ ] **Step 2: Add tutorial key + lifecycle**

In the state class:

```dart
  final _uploadCardKey = GlobalKey();
  bool _advancedThisFrame = false;

  @override
  void initState() {
    super.initState();
    // ... existing body ...
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePipelineCoachMark());
  }

  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    if (state.active &&
        state.step == PipelineStep.uploadCard &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
        ),
      );
    }
    super.dispose();
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.uploadCard) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _uploadCardKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Upload your file',
          body: 'Drop a file here, or tap to browse. PDFs, images, and docs all work.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        _advancedThisFrame = true;
        ref.read(pipelineTutorialProvider.notifier).advance();
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }
```

- [ ] **Step 3: Wrap the FileUploadCard**

In the build, find `FileUploadCard(...)` usage and wrap:

```dart
KeyedSubtree(
  key: _uploadCardKey,
  child: <existing FileUploadCard(...) usage>,
),
```

- [ ] **Step 4: Add imports**

Same imports as Task 9.

- [ ] **Step 5: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 11: CheckoutItemsCard accepts `tutorialKey`

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_items_card.dart`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Add the param**

Add `this.tutorialKey,` to the constructor and `final GlobalKey? tutorialKey;` field. Wrap the outermost widget in `build()`:

```dart
return KeyedSubtree(
  key: tutorialKey,
  child: <existing build body>,
);
```

If the outermost widget already returns a `Container` or `Card`, keep the wrap with `KeyedSubtree` so we don't fight existing keys.

- [ ] **Step 3: Build & analyze**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/widgets/checkout_items_card.dart
```

---

## Task 12: CheckoutFooter accepts `tutorialKey` for Place Order

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/widgets/checkout_footer.dart`

- [ ] **Step 1: Read the file**

Find the Place Order button.

- [ ] **Step 2: Add the param**

Add `this.placeOrderKey,` constructor param and `final GlobalKey? placeOrderKey;` field. Wrap the Place Order button with:

```dart
KeyedSubtree(
  key: placeOrderKey,
  child: <existing Place Order button>,
),
```

- [ ] **Step 3: Build & analyze**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/order/widgets/checkout_footer.dart
```

---

## Task 13: Checkout screen — pipeline steps 5–8 + post-pipeline `checkoutFeatures`

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/checkout_screen.dart`

- [ ] **Step 1: Read the file**

This screen was already converted to `ConsumerStatefulWidget` by the original tutorial work. Existing keys: `_multiDropKey`, `_paymentKey`. Existing methods: `_maybeShowCheckoutTutorial`, `_startCheckoutCoachMarks`.

- [ ] **Step 2: Add new tutorial keys**

In the state class, add four new keys:

```dart
  final _itemsKey = GlobalKey();
  final _deliveryKey = GlobalKey();
  final _paymentSectionKey = GlobalKey(); // distinct from _paymentKey (which targets payment row inside the card for checkoutFeatures)
  final _placeOrderKey = GlobalKey();
  bool _advancedThisFrame = false;
```

Note: `_multiDropKey` and `_paymentKey` are kept — they're now used by the post-pipeline `checkoutFeatures` flow. `_deliveryKey` and `_paymentSectionKey` target the whole-section cards for the pipeline.

- [ ] **Step 3: Replace `_maybeShowCheckoutTutorial`**

Replace the existing method with this pipeline-aware version:

```dart
  void _maybeShowCheckoutTutorial() {
    if (!mounted) return;

    final pipeline = ref.read(pipelineTutorialProvider);
    if (pipeline.active && pipeline.step == PipelineStep.checkoutItems) {
      _firePipelineItems();
      return;
    }

    // Post-pipeline standalone visit: checkoutFeatures
    if (ref.read(tutorialSeenProvider(TutorialKey.pipeline)) &&
        !ref.read(tutorialSeenProvider(TutorialKey.checkoutFeatures))) {
      _startCheckoutFeaturesCoachMarks();
    }
  }

  void _firePipelineItems() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _itemsKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Items',
          body: "Quick review of what you're printing.",
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        WidgetsBinding.instance.addPostFrameCallback((_) => _firePipelineDelivery());
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelineDelivery() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _deliveryKey,
          icon: HugeIcons.strokeRoundedLocation01,
          title: 'Delivery',
          body: 'Pick how you want it delivered — to your door, pickup, or multiple addresses.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        WidgetsBinding.instance.addPostFrameCallback((_) => _firePipelinePayment());
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelinePayment() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _paymentSectionKey,
          icon: HugeIcons.strokeRoundedWallet01,
          title: 'Payment',
          body: 'Pick how you want to pay.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        WidgetsBinding.instance.addPostFrameCallback((_) => _firePipelinePlaceOrder());
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelinePlaceOrder() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _placeOrderKey,
          icon: HugeIcons.strokeRoundedCheckmarkCircle02,
          title: 'Place Order',
          body: 'All set — tap Place Order to send it.',
          advanceOnSpotlightTap: true,
        ),
      ],
      () {},
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _startCheckoutFeaturesCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropKey,
          icon: HugeIcons.strokeRoundedRoute01,
          title: 'Multi-drop Delivery',
          body: 'Send prints to different addresses in one order. One rider, all the stops.',
          advanceOnSpotlightTap: false,
        ),
        TutorialStep(
          targetKey: _paymentKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'Pay with GRIDGO Credits',
          body: 'No OTP, no app-switching. Top up anytime in Profile → Wallet.',
          advanceOnSpotlightTap: false,
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.checkoutFeatures),
    );
  }
```

If `HugeIcons.strokeRoundedCheckmarkCircle02` doesn't exist, use `HugeIcons.strokeRoundedCheckmarkCircle01` or whatever variant exists. Verify with grep before commit.

- [ ] **Step 4: Override `dispose` for back-out abandon**

```dart
  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    final pipelineSteps = {
      PipelineStep.checkoutItems,
      PipelineStep.checkoutDelivery,
      PipelineStep.checkoutPayment,
      PipelineStep.placeOrderButton,
    };
    if (state.active &&
        pipelineSteps.contains(state.step) &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
        ),
      );
    }
    super.dispose();
  }
```

- [ ] **Step 5: Update build to thread keys to children**

In the build method:
- `CheckoutItemsCard(tutorialKey: _itemsKey)` (added in Task 11)
- `CheckoutDeliveryCard(segmentedKey: _multiDropKey)` (existing) — additionally wrap the whole `CheckoutDeliveryCard` with `KeyedSubtree(key: _deliveryKey, child: ...)` for the pipeline whole-section target
- `CheckoutPaymentCard(tutorialKey: _paymentKey)` (existing) — wrap with `KeyedSubtree(key: _paymentSectionKey, child: ...)` for the pipeline whole-section target
- `CheckoutFooter(onPlaceOrder: ..., placeOrderKey: _placeOrderKey)` (Task 12)

In `_placeOrder`, before the existing logic, set the advance flag:

```dart
  Future<void> _placeOrder(BuildContext context, WidgetRef ref) async {
    final pipeline = ref.read(pipelineTutorialProvider);
    if (pipeline.active && pipeline.step == PipelineStep.placeOrderButton) {
      _advancedThisFrame = true;
      ref.read(pipelineTutorialProvider.notifier).advance();
    }
    // ... existing _placeOrder body unchanged ...
  }
```

- [ ] **Step 6: Add import**

```dart
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
```

- [ ] **Step 7: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 14: Order Success screen — pipeline step 9 (finish)

**Files:**
- Modify: `apps/mobile/lib/features/customer/order/screens/order_success_screen.dart`

- [ ] **Step 1: Read the file**

Note: this is the screen `_placeOrder` navigates to via `context.go('/customer/order/success', ...)`. It's likely already a `ConsumerStatefulWidget`.

- [ ] **Step 2: Add finish hook in initState**

In the state class's `initState`:

```dart
  @override
  void initState() {
    super.initState();
    // ... existing body ...
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pipeline = ref.read(pipelineTutorialProvider);
      if (pipeline.active &&
          pipeline.step == PipelineStep.placeOrderButton) {
        // Pipeline reached its terminal screen — mark complete
        ref.read(pipelineTutorialProvider.notifier).finish();
      }
    });
  }
```

If the screen is currently `ConsumerWidget` or `StatelessWidget`, convert to `ConsumerStatefulWidget` first.

- [ ] **Step 3: Add import**

```dart
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
```

- [ ] **Step 4: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 15: Tracking screen — gate now requires `pipeline ∈ seen`

**Files:**
- Modify: `apps/mobile/lib/features/customer/tracking/screens/delivery_tracking_screen.dart`

- [ ] **Step 1: Update the trigger condition**

In the existing `_maybeShowTrackingTutorial`, change:

```dart
  void _maybeShowTrackingTutorial() {
    if (!mounted) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.tracking));
    if (seen) return;
```

to:

```dart
  void _maybeShowTrackingTutorial() {
    if (!mounted) return;
    final pipelineSeen = ref.read(tutorialSeenProvider(TutorialKey.pipeline));
    if (!pipelineSeen) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.tracking));
    if (seen) return;
```

- [ ] **Step 2: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 16: Profile reset — also reset pipeline state

**Files:**
- Modify: `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`

- [ ] **Step 1: Update `_confirmResetTutorials`**

Find `ref.read(tutorialProvider.notifier).resetAll();` inside the Reset confirmation handler. Add immediately after it:

```dart
              ref.read(pipelineTutorialProvider.notifier).reset();
```

- [ ] **Step 2: Add import**

```dart
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
```

- [ ] **Step 3: Build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

---

## Task 17: Run all tests + final build

- [ ] **Step 1: Run tutorial tests**

```bash
cd /home/jd/projects/printing_app/apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/tutorial/ -v 2>&1 | tail -20
```

Expected: all tutorial tests pass (repository, pipeline provider, feature_overlay_card, tutorial_bubble).

- [ ] **Step 2: Run full test suite**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -10
```

Expected: same pass/fail count as the pre-redesign baseline (no new regressions). The 2 pre-existing failures noted at the end of the previous tutorial work are not introduced by this redesign — confirm they're unchanged.

- [ ] **Step 3: Final release build**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -10
```

Expected: `✓ Built build/web`.

- [ ] **Step 4: Manual smoke checklist**

The build artifact is at `build/web/`. Open in a browser and verify:

1. **Fresh user flow**: clear local storage, sign in as a fresh customer. Onboarding slides → home → "Let's print something." sheet appears (no slide-up bounce — pure fade). Tap "Show me how →" → coach mark fires on Start Printing tile. Tap tile → navigates to Category. Coach mark fires on Paper Printing card. Tap → PaperSpecs. Form coach mark → tap "Got it →" → Continue button coach mark → tap Continue → Upload. Coach mark on upload card → tap "Got it →". Pick a file → checkout. Items coach mark → "Got it →" → Delivery → "Got it →" → Payment → "Got it →" → Place Order coach mark. Tap Place Order → order success → pipeline marked seen.

2. **Post-pipeline home**: return to home. Credits chip and GridBot FAB coach marks fire (auto-positioned correctly — bubble appears ABOVE the FAB, not behind it). Tap "Got it →" through both. Mark `homeFeatures` seen.

3. **Post-pipeline checkout (standalone)**: enter checkout flow without pipeline active. Multi-drop tab + GRIDGO Credits row coach marks fire. Mark `checkoutFeatures` seen.

4. **Tracking**: navigate to tracking. Coach mark fires. Mark `tracking` seen.

5. **Back-out abandon**: reset tutorials in Profile. Restart pipeline. Tap Start Printing → on Category, press device back. Returns to home. SnackBar: "Tutorial dismissed...". Pipeline marked seen.

6. **Reset flow**: Profile → Reset Tutorials → confirm. Welcome card reappears on next home visit. Walkthrough resumes from step 0.

If any of these fails, file a bug — do not commit until resolved.

- [ ] **Step 5: Do not commit**

User requires explicit approval before any git commit.
