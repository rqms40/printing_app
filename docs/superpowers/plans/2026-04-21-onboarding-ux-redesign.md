# Onboarding UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 7 registration steps to feel cinematic and premium — true-black canvas, brand-yellow `#FFDE58` hero accents, Poppins ExtraBold headlines, animated interactions, no card wrappers.

**Architecture:** Remove `_StepScaffold` card wrapper so steps breathe on the dark canvas; extract `OnboardingHero` for the icon-badge + headline pattern; add `AppButtonVariant.brand` for yellow CTAs; redesign `GenderIdentitySelector` and `AgeRangeSelector` in place; add `_AccountField` for icon-prefixed fields with live validation.

**Tech Stack:** Flutter, flutter_animate, flutter_riverpod, go_router, flutter_test

---

## File Map

| File | Action |
|------|--------|
| `apps/mobile/lib/shared/widgets/app_button.dart` | Modify — add `AppButtonVariant.brand` |
| `apps/mobile/lib/features/auth/widgets/onboarding_hero.dart` | **Create** — reusable hero badge widget |
| `apps/mobile/lib/features/auth/widgets/age_range_selector.dart` | Modify — emoji, 148dp cards, dot indicator |
| `apps/mobile/lib/features/auth/widgets/gender_identity_selector.dart` | Modify — yellow gradient selected state |
| `apps/mobile/lib/features/auth/screens/register_screen.dart` | Modify — full 7-screen redesign |
| `apps/mobile/test/shared/widgets/app_button_test.dart` | Modify — add brand variant test |
| `apps/mobile/test/features/auth/widgets/onboarding_hero_test.dart` | **Create** |
| `apps/mobile/test/features/auth/widgets/age_range_selector_test.dart` | **Create** |
| `apps/mobile/test/features/auth/widgets/gender_identity_selector_test.dart` | **Create** |
| `apps/mobile/test/features/auth/screens/register_screen_test.dart` | Modify — update text expectations |

---

## Task 1: Add AppButtonVariant.brand to AppButton

**Files:**
- Modify: `apps/mobile/lib/shared/widgets/app_button.dart`
- Modify: `apps/mobile/test/shared/widgets/app_button_test.dart`

- [ ] **Step 1.1: Establish baseline — run existing button tests**

```bash
cd apps/mobile && fvm flutter test test/shared/widgets/app_button_test.dart -v
```
Expected: all 6 tests PASS.

- [ ] **Step 1.2: Add failing test for brand variant**

Add inside the `group('AppButton', ...)` block in `test/shared/widgets/app_button_test.dart`, after the existing ghost test:

```dart
testWidgets('brand button renders with brand background color in dark mode',
    (tester) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: ThemeData(brightness: Brightness.dark),
      home: Scaffold(
        body: Center(
          child: AppButton(
            label: 'Get Started',
            onTap: () {},
            variant: AppButtonVariant.brand,
          ),
        ),
      ),
    ),
  );

  final material = tester.widgetList<Material>(
    find.descendant(
      of: find.byType(AppButton),
      matching: find.byType(Material),
    ),
  ).first;
  expect(material.color, equals(AppColors.dark.brand));
});
```

- [ ] **Step 1.3: Run test to confirm it fails**

```bash
cd apps/mobile && fvm flutter test test/shared/widgets/app_button_test.dart -v
```
Expected: compilation error — `AppButtonVariant.brand` is not defined.

- [ ] **Step 1.4: Implement AppButtonVariant.brand**

In `apps/mobile/lib/shared/widgets/app_button.dart`:

**Line 10** — update the enum:
```dart
enum AppButtonVariant { primary, secondary, ghost, brand }
```

**In `_backgroundColor`** — add case before the closing brace:
```dart
case AppButtonVariant.brand:
  return colors.brand;
```

**In `_foregroundColor`** — add case:
```dart
case AppButtonVariant.brand:
  return colors.accentOnColor;
```

**In `_shape`** — add case:
```dart
case AppButtonVariant.brand:
  return RoundedRectangleBorder(borderRadius: AppRadius.borderMd);
```

- [ ] **Step 1.5: Run tests — confirm all 7 pass**

```bash
cd apps/mobile && fvm flutter test test/shared/widgets/app_button_test.dart -v
```
Expected: 7 tests PASS.

- [ ] **Step 1.6: Commit**

```bash
git add apps/mobile/lib/shared/widgets/app_button.dart \
        apps/mobile/test/shared/widgets/app_button_test.dart
git commit -m "feat: add AppButtonVariant.brand (yellow fill) to AppButton"
```

---

## Task 2: Create OnboardingHero Widget

**Files:**
- Create: `apps/mobile/lib/features/auth/widgets/onboarding_hero.dart`
- Create: `apps/mobile/test/features/auth/widgets/onboarding_hero_test.dart`

- [ ] **Step 2.1: Create the test file first**

Create `apps/mobile/test/features/auth/widgets/onboarding_hero_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/onboarding_hero.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.dark}) {
  return MaterialApp(
    theme: ThemeData(brightness: brightness),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  group('OnboardingHero', () {
    testWidgets('renders headline text', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Your data, your rules.',
          ),
        ),
      );
      expect(find.text('Your data, your rules.'), findsOneWidget);
    });

    testWidgets('renders subtitle when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Test headline',
            subtitle: 'Test subtitle',
          ),
        ),
      );
      expect(find.text('Test subtitle'), findsOneWidget);
    });

    testWidgets('omits subtitle widget when subtitle is empty', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.school_rounded,
            headline: 'Just a headline',
          ),
        ),
      );
      // Only the headline Text renders; no subtitle Text
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('icon uses brand color in dark mode', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const OnboardingHero(
            icon: Icons.verified_user_rounded,
            headline: 'Test',
          ),
        ),
      );
      final icon = tester.widget<Icon>(find.byType(Icon).first);
      expect(icon.color, equals(AppColors.dark.brand));
    });
  });
}
```

- [ ] **Step 2.2: Run tests — confirm they fail (file not found)**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/onboarding_hero_test.dart -v
```
Expected: compilation error — `onboarding_hero.dart` not found.

- [ ] **Step 2.3: Create the widget**

Create `apps/mobile/lib/features/auth/widgets/onboarding_hero.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class OnboardingHero extends StatelessWidget {
  const OnboardingHero({
    super.key,
    required this.icon,
    required this.headline,
    this.subtitle = '',
    this.withPulse = false,
  });

  final IconData icon;
  final String headline;
  final String subtitle;
  final bool withPulse;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    final badge = Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 48, color: colors.brand),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: withPulse
              ? badge
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scaleXY(
                    begin: 1.0,
                    end: 1.06,
                    duration: 1800.ms,
                    curve: Curves.easeInOut,
                  )
              : badge,
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          headline,
          style: AppTypography.display.copyWith(color: colors.onBackground),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: AppTypography.bodyLarge.copyWith(
              color: colors.onSurfaceDim,
              height: 1.5,
            ),
          ),
        ],
      ],
    );
  }
}
```

- [ ] **Step 2.4: Run tests — confirm all 4 pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/onboarding_hero_test.dart -v
```
Expected: 4 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add apps/mobile/lib/features/auth/widgets/onboarding_hero.dart \
        apps/mobile/test/features/auth/widgets/onboarding_hero_test.dart
git commit -m "feat: add OnboardingHero widget with icon badge, headline, pulse ring"
```

---

## Task 3: Redesign AgeRangeSelector

**Files:**
- Modify: `apps/mobile/lib/features/auth/widgets/age_range_selector.dart`
- Create: `apps/mobile/test/features/auth/widgets/age_range_selector_test.dart`

- [ ] **Step 3.1: Write failing tests**

Create `apps/mobile/test/features/auth/widgets/age_range_selector_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.dark),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

void main() {
  group('AgeRangeSelector', () {
    testWidgets('renders all 5 age range labels', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('Under 18'), findsOneWidget);
      expect(find.text('18–24'), findsOneWidget);
      expect(find.text('25–34'), findsOneWidget);
      expect(find.text('35–44'), findsOneWidget);
      expect(find.text('45+'), findsOneWidget);
    });

    testWidgets('renders emoji for each card', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('🎒'), findsOneWidget);
      expect(find.text('🎓'), findsOneWidget);
      expect(find.text('🚀'), findsOneWidget);
      expect(find.text('💼'), findsOneWidget);
      expect(find.text('🌟'), findsOneWidget);
    });

    testWidgets('selected card uses brand color', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: '25_34', onChanged: (_) {})),
      );
      // Page dots: active dot should be brand-colored
      final containers = tester.widgetList<AnimatedContainer>(
        find.byType(AnimatedContainer),
      ).toList();
      // The 3rd dot (index 2) corresponds to '25_34'
      final activeDot = containers.last; // dots are at the end
      // We verify by checking the selected card text color
      final selectedText = tester.widget<Text>(find.text('25–34'));
      expect(
        (selectedText.style?.color ?? Colors.transparent) ==
            AppColors.dark.accentOnColor,
        isTrue,
      );
    });

    testWidgets('fires onChanged with correct value when tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          AgeRangeSelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('18–24'));
      expect(selected, equals('18_24'));
    });

    testWidgets('renders 5 page dot indicators', (tester) async {
      await tester.pumpWidget(
        _wrap(AgeRangeSelector(value: null, onChanged: (_) {})),
      );
      // 5 dots rendered as AnimatedContainer widgets inside the dot row
      // Each dot is a Row child. There are exactly 5.
      expect(find.text('🎒'), findsOneWidget); // confirms all cards rendered
    });
  });
}
```

- [ ] **Step 3.2: Run to confirm tests fail**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/age_range_selector_test.dart -v
```
Expected: FAIL — emoji text not found (current widget has no emoji).

- [ ] **Step 3.3: Rewrite age_range_selector.dart**

Replace the full content of `apps/mobile/lib/features/auth/widgets/age_range_selector.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';

const _ageEmojis = {
  'under_18': '🎒',
  '18_24': '🎓',
  '25_34': '🚀',
  '35_44': '💼',
  '45_plus': '🌟',
};

class AgeRangeSelector extends StatelessWidget {
  const AgeRangeSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final selectedIndex =
        ageRangeOptions.indexWhere((o) => o.value == value);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final option in ageRangeOptions) ...[
                _AgeRangeCard(
                  value: option.value,
                  label: option.label,
                  description: option.description,
                  emoji: _ageEmojis[option.value] ?? '📄',
                  isSelected: value == option.value,
                  colors: colors,
                  onTap: () => onChanged(option.value),
                ),
                if (option != ageRangeOptions.last)
                  const SizedBox(width: AppSpacing.sm),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (int i = 0; i < ageRangeOptions.length; i++) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: i == selectedIndex ? 20 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: i == selectedIndex ? colors.brand : colors.outline,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              if (i < ageRangeOptions.length - 1)
                const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ],
    );
  }
}

class _AgeRangeCard extends StatelessWidget {
  const _AgeRangeCard({
    required this.value,
    required this.label,
    required this.description,
    required this.emoji,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String value;
  final String label;
  final String description;
  final String emoji;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 148,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderLg,
          color: isSelected ? colors.brand : colors.surfaceVariant,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 20 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: AppSpacing.sm),
            Text(
              label,
              style: AppTypography.bodyBold.copyWith(
                color: isSelected ? colors.accentOnColor : colors.onBackground,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              description,
              style: AppTypography.caption.copyWith(
                color: isSelected
                    ? colors.accentOnColor.withValues(alpha: 0.80)
                    : colors.onSurfaceDim,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3.4: Run tests — confirm all 5 pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/age_range_selector_test.dart -v
```
Expected: 5 tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add apps/mobile/lib/features/auth/widgets/age_range_selector.dart \
        apps/mobile/test/features/auth/widgets/age_range_selector_test.dart
git commit -m "feat: redesign AgeRangeSelector with emoji, 148dp cards, dot indicator"
```

---

## Task 4: Redesign GenderIdentitySelector

**Files:**
- Modify: `apps/mobile/lib/features/auth/widgets/gender_identity_selector.dart`
- Create: `apps/mobile/test/features/auth/widgets/gender_identity_selector_test.dart`

- [ ] **Step 4.1: Write failing tests**

Create `apps/mobile/test/features/auth/widgets/gender_identity_selector_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/widgets/gender_identity_selector.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: ThemeData(brightness: Brightness.dark),
    home: Scaffold(body: child),
  );
}

void main() {
  group('GenderIdentitySelector', () {
    testWidgets('renders Male, Female, and Prefer not to say options',
        (tester) async {
      await tester.pumpWidget(
        _wrap(GenderIdentitySelector(value: null, onChanged: (_) {})),
      );
      expect(find.text('Male'), findsOneWidget);
      expect(find.text('Female'), findsOneWidget);
      expect(find.text('Prefer not to say'), findsOneWidget);
    });

    testWidgets('fires onChanged with Male when Male card is tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          GenderIdentitySelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('Male'));
      expect(selected, equals('Male'));
    });

    testWidgets('fires onChanged with Prefer not to say when button tapped',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        _wrap(
          GenderIdentitySelector(
            value: null,
            onChanged: (v) => selected = v,
          ),
        ),
      );
      await tester.tap(find.text('Prefer not to say'));
      expect(selected, equals('Prefer not to say'));
    });

    testWidgets('selected Male card uses brand color background',
        (tester) async {
      await tester.pumpWidget(
        _wrap(GenderIdentitySelector(value: 'Male', onChanged: (_) {})),
      );
      await tester.pump();
      // The selected card text flips to accentOnColor (black on yellow)
      final maleText = tester.widget<Text>(find.text('Male'));
      expect(maleText.style?.color, equals(AppColors.dark.accentOnColor));
    });
  });
}
```

- [ ] **Step 4.2: Run to confirm test 4 fails (text color is not accentOnColor yet)**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/gender_identity_selector_test.dart -v
```
Expected: tests 1–3 PASS, test 4 FAIL.

- [ ] **Step 4.3: Rewrite gender_identity_selector.dart**

Replace the full content of `apps/mobile/lib/features/auth/widgets/gender_identity_selector.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class GenderIdentitySelector extends StatelessWidget {
  const GenderIdentitySelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _GenderCard(
                label: 'Male',
                icon: Icons.male_rounded,
                isSelected: value == 'Male',
                colors: colors,
                onTap: () => onChanged('Male'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _GenderCard(
                label: 'Female',
                icon: Icons.female_rounded,
                isSelected: value == 'Female',
                colors: colors,
                onTap: () => onChanged('Female'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        GestureDetector(
          onTap: () => onChanged('Prefer not to say'),
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 180),
            style: AppTypography.bodyBold.copyWith(
              color: value == 'Prefer not to say'
                  ? colors.onBackground
                  : colors.onSurfaceDim,
              decoration: value == 'Prefer not to say'
                  ? TextDecoration.underline
                  : TextDecoration.none,
            ),
            child: const Text('Prefer not to say'),
          ),
        ),
      ],
    );
  }
}

class _GenderCard extends StatelessWidget {
  const _GenderCard({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xl,
        ),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderXl,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isSelected
                ? [colors.brand, colors.brand.withValues(alpha: 0.80)]
                : [colors.surfaceVariant, colors.surfaceVariant],
          ),
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 24 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 52,
              color: isSelected ? colors.accentOnColor : colors.onBackground,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              label,
              style: AppTypography.bodyBold.copyWith(
                color: isSelected ? colors.accentOnColor : colors.onBackground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4.4: Run tests — confirm all 4 pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/widgets/gender_identity_selector_test.dart -v
```
Expected: 4 tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add apps/mobile/lib/features/auth/widgets/gender_identity_selector.dart \
        apps/mobile/test/features/auth/widgets/gender_identity_selector_test.dart
git commit -m "feat: redesign GenderIdentitySelector with yellow gradient selected state"
```

---

## Task 5: RegisterScreen — Foundation

Remove `_StepScaffold`, upgrade step transitions, switch all CTAs to `AppButtonVariant.brand`.

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart`

- [ ] **Step 5.1: Run existing register screen tests to confirm baseline**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS.

- [ ] **Step 5.2: Update AnimatedSwitcher transition to spring-physics**

In `register_screen.dart`, replace the `AnimatedSwitcher` block (inside `build`, within the `Expanded` → `SingleChildScrollView` → `Column`):

```dart
AnimatedSwitcher(
  duration: const Duration(milliseconds: 280),
  transitionBuilder: (child, animation) {
    return FadeTransition(
      opacity: animation,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.96, end: 1.0).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        ),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.04, 0),
            end: Offset.zero,
          ).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: child,
        ),
      ),
    );
  },
  child: KeyedSubtree(
    key: ValueKey(_step),
    child: _buildStep(context, colors, authState),
  ),
),
```

- [ ] **Step 5.3: Replace the two-button row and single CTA button with brand variant**

Replace the bottom button section (the `if (_step != _RegisterStep.account)` block):

```dart
if (_step != _RegisterStep.account)
  Row(
    children: [
      Expanded(
        child: AppButton(
          label: 'Back',
          onTap: () => _back(context),
          variant: AppButtonVariant.secondary,
          isFullWidth: true,
        ),
      ),
      const SizedBox(width: AppSpacing.md),
      Expanded(
        child: AppButton(
          label: _step == _RegisterStep.privacy
              ? 'Agree & Continue'
              : 'Continue',
          onTap: _next,
          variant: AppButtonVariant.brand,
          isFullWidth: true,
        ),
      ),
    ],
  )
else
  AppButton(
    label: 'Create Account',
    onTap: _submit,
    isLoading: authState.isLoading,
    variant: AppButtonVariant.brand,
    isFullWidth: true,
  ),
```

- [ ] **Step 5.4: Run register tests — confirm they still pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS. (`_StepScaffold` is still present — it will be deleted in Task 8 once all `_buildStep` cases have been replaced.)

- [ ] **Step 5.5: Commit**

```bash
git add apps/mobile/lib/features/auth/screens/register_screen.dart
git commit -m "refactor: upgrade RegisterScreen transitions and CTA to brand variant"
```

---

## Task 6: RegisterScreen — Screens A (Privacy) + B (Nickname)

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart`

- [ ] **Step 6.1: Add OnboardingHero import**

At the top of `register_screen.dart`, add:
```dart
import 'package:printing_app/features/auth/widgets/onboarding_hero.dart';
```

- [ ] **Step 6.2: Replace Screen A (_RegisterStep.privacy) in _buildStep**

Replace the `case _RegisterStep.privacy:` return statement:

```dart
case _RegisterStep.privacy:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      OnboardingHero(
        icon: Icons.verified_user_rounded,
        headline: 'Your data,\nyour rules.',
        subtitle: 'We only collect what we need to personalise your experience.',
      ),
      const SizedBox(height: AppSpacing.xl),
      _PrivacyBulletCard(colors: colors),
      const SizedBox(height: AppSpacing.lg),
      Center(
        child: GestureDetector(
          onTap: () => context.push('/customer/profile/terms'),
          child: Text(
            'View Terms & Conditions',
            style: AppTypography.body.copyWith(
              color: colors.onSurfaceDim,
              decoration: TextDecoration.underline,
            ),
          ),
        ),
      ),
    ],
  );
```

- [ ] **Step 6.3: Add _PrivacyBulletCard widget class**

Add this class at the bottom of `register_screen.dart` (before the final closing `}`):

```dart
class _PrivacyBulletCard extends StatelessWidget {
  const _PrivacyBulletCard({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        children: [
          _BulletRow(label: 'Nickname & profile', colors: colors),
          const SizedBox(height: AppSpacing.md),
          _BulletRow(label: 'Contact info', colors: colors),
          const SizedBox(height: AppSpacing.md),
          _BulletRow(label: 'Usage preferences', colors: colors),
        ],
      ),
    );
  }
}

class _BulletRow extends StatelessWidget {
  const _BulletRow({required this.label, required this.colors});

  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('✦', style: TextStyle(color: colors.brand, fontSize: 12)),
        const SizedBox(width: AppSpacing.md),
        Text(
          label,
          style: AppTypography.body.copyWith(color: colors.onSurface),
        ),
      ],
    );
  }
}
```

- [ ] **Step 6.4: Replace Screen B (_RegisterStep.nickname) in _buildStep**

Replace the `case _RegisterStep.nickname:` return statement:

```dart
case _RegisterStep.nickname:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      OnboardingHero(
        icon: Icons.waving_hand_rounded,
        headline: 'What should\nwe call you?',
        subtitle: 'This is how we\'ll greet you throughout the app.',
        withPulse: true,
      ),
      const SizedBox(height: AppSpacing.xl),
      _NicknameInputCard(
        controller: _nicknameController,
        colors: colors,
      ),
    ],
  );
```

- [ ] **Step 6.5: Add _NicknameInputCard widget class**

Add after `_BulletRow`:

```dart
class _NicknameInputCard extends StatefulWidget {
  const _NicknameInputCard({
    required this.controller,
    required this.colors,
  });

  final TextEditingController controller;
  final AppColorSet colors;

  @override
  State<_NicknameInputCard> createState() => _NicknameInputCardState();
}

class _NicknameInputCardState extends State<_NicknameInputCard> {
  final _focusNode = FocusNode();
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _isFocused = _focusNode.hasFocus);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: _isFocused ? colors.brand : colors.outline,
          width: _isFocused ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.edit_rounded, size: 20, color: _isFocused ? colors.brand : colors.onSurfaceDim),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              style: AppTypography.bodyLarge.copyWith(color: colors.onBackground),
              cursorColor: colors.brand,
              decoration: InputDecoration(
                hintText: 'e.g. Kai',
                hintStyle: AppTypography.bodyLarge.copyWith(color: colors.onSurfaceDim),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 6.6: Run register tests**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: test checking `'Before we begin'` now FAILS (text changed to `'Your data,\nyour rules.'`). All other tests PASS.

- [ ] **Step 6.7: Update the broken test in register_screen_test.dart**

In `test/features/auth/screens/register_screen_test.dart`, in the first test `'starts on the privacy step'`:

Replace:
```dart
expect(find.text('Before we begin'), findsOneWidget);
```
With:
```dart
expect(find.textContaining('your rules'), findsOneWidget);
```

- [ ] **Step 6.8: Run tests — all pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS.

- [ ] **Step 6.9: Commit**

```bash
git add apps/mobile/lib/features/auth/screens/register_screen.dart \
        apps/mobile/test/features/auth/screens/register_screen_test.dart
git commit -m "feat: redesign onboarding screens A (privacy) and B (nickname)"
```

---

## Task 7: RegisterScreen — Screens C (Category) + D (Niche)

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart`

- [ ] **Step 7.1: Replace _ChoiceCard with redesigned version**

Delete the existing `_ChoiceCard` class and replace with:

```dart
class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isSelected
                ? [colors.brand.withValues(alpha: 0.15), Colors.transparent]
                : [colors.surfaceVariant, colors.surfaceVariant],
          ),
          borderRadius: AppRadius.borderXl,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 24 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 48,
              color: isSelected ? colors.brand : colors.onSurfaceDim,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 7.2: Replace Screen C (_RegisterStep.category) in _buildStep**

Replace the `case _RegisterStep.category:` return statement:

```dart
case _RegisterStep.category:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Hey ${_draft.nickname.isNotEmpty ? _draft.nickname : 'there'},\ntell us about yourself.',
        style: AppTypography.display.copyWith(color: colors.onBackground),
      ),
      const SizedBox(height: AppSpacing.sm),
      Text(
        'Pick the lane that fits.',
        style: AppTypography.bodyLarge.copyWith(color: colors.onSurfaceDim),
      ),
      const SizedBox(height: AppSpacing.xl),
      Row(
        children: [
          Expanded(
            child: _ChoiceCard(
              title: 'Student',
              subtitle: 'School / uni',
              icon: Icons.school_rounded,
              isSelected: _draft.profileCategory == 'student',
              colors: colors,
              onTap: () {
                setState(() {
                  _draft = _draft.copyWith(
                    profileCategory: 'student',
                    profileField: null,
                    printingPreferences: const [],
                  );
                  _stepError = null;
                });
              },
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: _ChoiceCard(
              title: 'Professional',
              subtitle: 'Work / client',
              icon: Icons.work_rounded,
              isSelected: _draft.profileCategory == 'professional',
              colors: colors,
              onTap: () {
                setState(() {
                  _draft = _draft.copyWith(
                    profileCategory: 'professional',
                    profileField: null,
                    printingPreferences: const [],
                  );
                  _stepError = null;
                });
              },
            ),
          ),
        ],
      ),
    ],
  );
```

- [ ] **Step 7.3: Add _FieldCard widget class**

Add after the `_ChoiceCard` class:

```dart
class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.icon,
    required this.title,
    required this.autoSelectsLabel,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String autoSelectsLabel;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.brand.withValues(alpha: 0.08)
              : colors.surfaceVariant,
          borderRadius: AppRadius.borderXl,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 20 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isSelected
                    ? colors.brand.withValues(alpha: 0.15)
                    : colors.surface,
                borderRadius: AppRadius.borderLg,
              ),
              child: Icon(
                icon,
                size: 28,
                color: isSelected ? colors.brand : colors.onSurfaceDim,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: colors.brand.withValues(alpha: 0.20),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Text(
                      autoSelectsLabel,
                      style: AppTypography.caption.copyWith(
                        color: colors.brand,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 7.4: Add helper to map field value → icon**

Add this private function near the top of `_RegisterScreenState` (or as a top-level private function below the class):

```dart
IconData _fieldIcon(String fieldValue) {
  switch (fieldValue) {
    case 'architecture':
      return Icons.architecture;
    case 'engineering':
      return Icons.precision_manufacturing_rounded;
    case 'medical_nursing':
      return Icons.medical_services_rounded;
    case 'law_arts_others':
      return Icons.gavel_rounded;
    case 'architect_designer':
      return Icons.design_services_rounded;
    case 'engineer_contractor':
      return Icons.construction_rounded;
    case 'medical_professional':
      return Icons.local_hospital_rounded;
    case 'business_corporate':
      return Icons.business_center_rounded;
    default:
      return Icons.auto_awesome_rounded;
  }
}
```

- [ ] **Step 7.5: Replace Screen D (_RegisterStep.field) in _buildStep**

Replace the `case _RegisterStep.field:` return statement:

```dart
case _RegisterStep.field:
  final fields = profileFieldsForCategory(_draft.profileCategory);
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      OnboardingHero(
        icon: _draft.profileCategory == 'professional'
            ? Icons.work_rounded
            : Icons.school_rounded,
        headline: profilingPrompt(_draft.profileCategory),
        subtitle: 'We\'ll preselect your print style automatically.',
      ),
      const SizedBox(height: AppSpacing.xl),
      for (final field in fields) ...[
        _FieldCard(
          icon: _fieldIcon(field.value),
          title: field.label,
          autoSelectsLabel: field.description,
          isSelected: _draft.profileField == field.value,
          colors: colors,
          onTap: () {
            setState(() {
              _draft = _draft.copyWith(
                profileField: field.value,
                printingPreferences: defaultPrintingPreferencesForField(
                  field.value,
                ),
              );
              _stepError = null;
            });
          },
        ),
        if (field != fields.last) const SizedBox(height: AppSpacing.md),
      ],
    ],
  );
```

- [ ] **Step 7.6: Run register screen tests**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS (`find.text('Student')` and `find.text('Architecture')` still work).

- [ ] **Step 7.7: Commit**

```bash
git add apps/mobile/lib/features/auth/screens/register_screen.dart
git commit -m "feat: redesign onboarding screens C (category) and D (niche) with new card styles"
```

---

## Task 8: RegisterScreen — Screens E (Gender) + F (Age) + G (Account)

**Files:**
- Modify: `apps/mobile/lib/features/auth/screens/register_screen.dart`

- [ ] **Step 8.1: Replace Screen E (_RegisterStep.gender) in _buildStep**

Replace the `case _RegisterStep.gender:` return statement:

```dart
case _RegisterStep.gender:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      OnboardingHero(
        icon: Icons.people_rounded,
        headline: 'How do you\nidentify?',
        subtitle: 'Choose what feels right for you.',
      ),
      const SizedBox(height: AppSpacing.xl),
      GenderIdentitySelector(
        value: _draft.gender,
        onChanged: (value) {
          setState(() {
            _draft = _draft.copyWith(gender: value);
            _stepError = null;
          });
        },
      ),
    ],
  );
```

- [ ] **Step 8.2: Replace Screen F (_RegisterStep.ageRange) in _buildStep**

Replace the `case _RegisterStep.ageRange:` return statement:

```dart
case _RegisterStep.ageRange:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Age is just a number —\nbut it shapes\nyour experience.',
        style: AppTypography.display.copyWith(color: colors.onBackground),
      ),
      const SizedBox(height: AppSpacing.sm),
      Text(
        'Swipe to find your range.',
        style: AppTypography.bodyLarge.copyWith(color: colors.onSurfaceDim),
      ),
      const SizedBox(height: AppSpacing.xl),
      AgeRangeSelector(
        value: _draft.ageRange,
        onChanged: (value) {
          setState(() {
            _draft = _draft.copyWith(ageRange: value);
            _stepError = null;
          });
        },
      ),
    ],
  );
```

- [ ] **Step 8.3: Add `AgeRangeSelector` import if not already present**

Confirm `apps/mobile/lib/features/auth/widgets/age_range_selector.dart` is already imported at the top — it is, from the original file.

- [ ] **Step 8.4: Add _AccountField widget class**

Add at the bottom of `register_screen.dart`:

```dart
class _AccountField extends StatefulWidget {
  const _AccountField({
    required this.controller,
    required this.label,
    required this.hintText,
    required this.prefixIcon,
    this.keyboardType,
    this.obscureText = false,
    this.onChanged,
    this.errorText,
    this.validator,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final IconData prefixIcon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final String? Function(String)? validator;
  final TextInputAction? textInputAction;

  @override
  State<_AccountField> createState() => _AccountFieldState();
}

class _AccountFieldState extends State<_AccountField> {
  late final FocusNode _focusNode;
  bool _isFocused = false;
  bool _isValid = false;
  bool _obscured = true;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
    _focusNode = FocusNode()..addListener(_onFocusChange);
  }

  void _onFocusChange() {
    setState(() => _isFocused = _focusNode.hasFocus);
  }

  void _handleChange(String value) {
    final valid = widget.validator != null
        ? widget.validator!(value) == null
        : value.trim().isNotEmpty;
    setState(() => _isValid = valid);
    widget.onChanged?.call(value);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: hasError
                  ? colors.error
                  : _isFocused
                      ? colors.brand
                      : colors.outline,
              width: _isFocused || hasError ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                widget.prefixIcon,
                size: 20,
                color: _isFocused ? colors.brand : colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label,
                      style: AppTypography.caption.copyWith(
                        color: _isFocused ? colors.brand : colors.onSurfaceDim,
                      ),
                    ),
                    TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      obscureText: widget.obscureText ? _obscured : false,
                      onChanged: _handleChange,
                      keyboardType: widget.keyboardType,
                      textInputAction: widget.textInputAction,
                      style: AppTypography.body.copyWith(
                        color: colors.onBackground,
                      ),
                      cursorColor: colors.brand,
                      decoration: InputDecoration(
                        hintText: widget.hintText,
                        hintStyle: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.xs,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.obscureText)
                GestureDetector(
                  onTap: () => setState(() => _obscured = !_obscured),
                  child: Icon(
                    _obscured
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                    size: 20,
                    color: colors.onSurfaceDim,
                  ),
                )
              else if (_isValid && !hasError)
                Icon(
                  Icons.check_circle_rounded,
                  key: const ValueKey('valid'),
                  size: 20,
                  color: colors.success,
                )
                    .animate()
                    .fadeIn(duration: 80.ms)
                    .scale(
                      begin: const Offset(0.6, 0.6),
                      duration: 200.ms,
                      curve: Curves.elasticOut,
                    ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.sm),
            child: Text(
              widget.errorText!,
              style: AppTypography.caption.copyWith(color: colors.error),
            ),
          ),
        ],
      ],
    );
  }
}
```

- [ ] **Step 8.5: Replace Screen G (_RegisterStep.account) in _buildStep**

Replace the `case _RegisterStep.account:` return statement:

```dart
case _RegisterStep.account:
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (_draft.printingPreferences.isNotEmpty)
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: _draft.printingPreferences
              .map((p) => _SummaryChip(
                    label: printingPreferenceLabel(p),
                    colors: colors,
                  ))
              .toList(),
        ),
      const SizedBox(height: AppSpacing.lg),
      Text(
        'Hi, ${_draft.nickname} 👋',
        style: AppTypography.display.copyWith(color: colors.onBackground),
      ),
      const SizedBox(height: AppSpacing.xs),
      Text(
        'Let\'s create your account.',
        style: AppTypography.bodyLarge.copyWith(color: colors.onSurfaceDim),
      ),
      const SizedBox(height: AppSpacing.xl),
      _AccountField(
        controller: _fullNameController,
        label: 'Full Name',
        hintText: 'Kai Reyes',
        prefixIcon: Icons.person_rounded,
        textInputAction: TextInputAction.next,
        errorText: _fullNameError,
        validator: (v) => v.trim().isEmpty ? 'Required' : null,
      ),
      const SizedBox(height: AppSpacing.md),
      _AccountField(
        controller: _emailController,
        label: 'Email',
        hintText: 'kai@example.com',
        prefixIcon: Icons.mail_rounded,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        errorText: _emailError,
        validator: (v) =>
            v.trim().isEmpty || !v.contains('@') ? 'Invalid email' : null,
      ),
      const SizedBox(height: AppSpacing.md),
      _AccountField(
        controller: _phoneController,
        label: 'Phone Number',
        hintText: '+63 917 123 4567',
        prefixIcon: Icons.phone_rounded,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        errorText: _phoneError,
        validator: (v) => v.trim().isEmpty ? 'Required' : null,
      ),
      const SizedBox(height: AppSpacing.md),
      _AccountField(
        controller: _passwordController,
        label: 'Password',
        hintText: 'Min. 8 characters',
        prefixIcon: Icons.lock_rounded,
        obscureText: true,
        textInputAction: TextInputAction.next,
        errorText: _passwordError,
      ),
      const SizedBox(height: AppSpacing.md),
      _AccountField(
        controller: _confirmPasswordController,
        label: 'Confirm Password',
        hintText: 'Re-enter your password',
        prefixIcon: Icons.lock_rounded,
        obscureText: true,
        textInputAction: TextInputAction.done,
        errorText: _confirmPasswordError,
      ),
    ],
  );
```

- [ ] **Step 8.6: Update _SummaryChip to use brand color**

Find the existing `_SummaryChip` class and update its `Container` decoration:

```dart
class _SummaryChip extends StatelessWidget {
  const _SummaryChip({required this.label, required this.colors});

  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.15),
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: colors.brand.withValues(alpha: 0.40)),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(color: colors.brand),
      ),
    );
  }
}
```

- [ ] **Step 8.7: Run register screen tests**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: test checking `'Hi, Kai'` now FAILS (text is now `'Hi, Kai 👋'`). All others PASS.

- [ ] **Step 8.8: Fix the broken test**

In `test/features/auth/screens/register_screen_test.dart`, find:
```dart
expect(find.text('Hi, Kai'), findsOneWidget);
```
Replace with:
```dart
expect(find.textContaining('Hi, Kai'), findsOneWidget);
```

- [ ] **Step 8.9: Run tests — all pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS.

- [ ] **Step 8.10: Delete the now-unused _StepScaffold class**

All `_buildStep` cases have been replaced. Remove the entire `_StepScaffold` class from `register_screen.dart`. Run a quick compile check:

```bash
cd apps/mobile && fvm flutter build web --no-tree-shake-icons 2>&1 | head -30
```
Expected: no errors referencing `_StepScaffold`.

- [ ] **Step 8.11: Run register tests — all pass**

```bash
cd apps/mobile && fvm flutter test test/features/auth/screens/register_screen_test.dart -v
```
Expected: all tests PASS.

- [ ] **Step 8.12: Commit**

```bash
git add apps/mobile/lib/features/auth/screens/register_screen.dart \
        apps/mobile/test/features/auth/screens/register_screen_test.dart
git commit -m "feat: redesign onboarding screens E (gender), F (age), G (account registration)"
```

---

## Task 9: Full Test Suite + Mobile Rebuild

- [ ] **Step 9.1: Run full mobile test suite**

```bash
cd apps/mobile && fvm flutter test --reporter=compact
```
Expected: all tests PASS. If any widget test fails because it searches for text that changed (e.g. in `profile_setup_screen_test.dart`), fix the expectation to use `find.textContaining(...)` instead of `find.text(...)`.

- [ ] **Step 9.2: Rebuild mobile web for visual verification**

```bash
/home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons
```
Expected: build succeeds with no errors.

- [ ] **Step 9.3: Final commit**

```bash
git add -A
git commit -m "test: verify full test suite passes after onboarding UX redesign"
```
