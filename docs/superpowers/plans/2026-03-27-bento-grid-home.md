# Bento Grid Home Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hero banner + service cards on the customer home screen with a mobile bento grid layout using `flutter_staggered_grid_view`, and fix the recent orders carousel to be flush-left.

**Architecture:** The bento grid is a single `BentoGrid` widget containing 5 `StaggeredGridTile` children, each wrapping a dedicated tile widget. The grid uses `StaggeredGrid.count` with `crossAxisCount: 4`. Tiles reuse existing design tokens (`AppCard`, `AppColors`, `AppTypography`, `AppRadius`, `AppShadows`) and existing illustrations (`PrinterIllustration`). The carousel fix is a two-property change on `PageController`.

**Tech Stack:** Flutter, `flutter_staggered_grid_view`, Riverpod, existing DarkastixPrint design system

**Spec:** `docs/superpowers/specs/2026-03-27-bento-grid-home-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `pubspec.yaml` | Modify | Add `flutter_staggered_grid_view` dependency |
| `lib/features/customer/home/widgets/bento_grid.dart` | Create | Bento grid layout with 5 tiles using `StaggeredGrid.count` |
| `lib/features/customer/home/screens/home_screen.dart` | Modify | Replace hero banner + service cards with `BentoGrid` widget |
| `lib/features/customer/home/widgets/recent_orders_section.dart` | Modify | Fix `PageController` to flush-left alignment |

---

### Task 1: Add `flutter_staggered_grid_view` dependency

**Files:**
- Modify: `pubspec.yaml`

- [ ] **Step 1: Add the dependency to pubspec.yaml**

In `pubspec.yaml`, under the `# UI & Animation` comment block, add:

```yaml
  flutter_staggered_grid_view: ^0.7.0
```

Place it after the `flutter_animate` line (line 30).

- [ ] **Step 2: Run pub get**

Run: `flutter pub get`
Expected: "Got dependencies!" with no errors.

- [ ] **Step 3: Commit**

```bash
git add pubspec.yaml pubspec.lock
git commit -m "deps: add flutter_staggered_grid_view for bento grid layout"
```

---

### Task 2: Create the `BentoGrid` widget

**Files:**
- Create: `lib/features/customer/home/widgets/bento_grid.dart`

- [ ] **Step 1: Create the bento grid widget file**

Create `lib/features/customer/home/widgets/bento_grid.dart` with the following content:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_illustrations.dart';
import 'package:printing_app/shared/widgets/icon_container.dart';

/// Mobile bento grid replacing the hero banner and service cards.
///
/// 4-column quilted grid with 5 tiles:
/// ```
/// ┌──────────────┬───────┐
/// │              │ Paper │
/// │  Hero/Promo  │  2x1  │
/// │    2x2       ├───────┤
/// │              │  3D   │
/// │              │  2x1  │
/// ├──────────────┼───────┤
/// │  Quick Stats │ Promo │
/// │    2x1       │  2x1  │
/// └──────────────┴───────┘
/// ```
class BentoGrid extends StatelessWidget {
  const BentoGrid({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeOrderCount = MockData.orders
        .where((o) =>
            o.orderStatus != OrderStatus.delivered &&
            o.orderStatus != OrderStatus.completedPickup &&
            o.orderStatus != OrderStatus.cancelled)
        .length;

    return StaggeredGrid.count(
      crossAxisCount: 4,
      mainAxisSpacing: AppSpacing.md,
      crossAxisSpacing: AppSpacing.md,
      children: [
        // 1. Hero tile (2x2)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 2,
          child: _HeroTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
        ),

        // 2. Paper Printing tile (2x1)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _ServiceTile(
            title: 'Paper\nPrinting',
            icon: HugeIcons.strokeRoundedFile02,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 60.ms,
                  curve: Curves.easeOut),
        ),

        // 3. 3D Printing tile (2x1)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _ServiceTile(
            title: '3D\nPrinting',
            icon: HugeIcons.strokeRoundedPackageDelivered,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 120.ms,
                  curve: Curves.easeOut),
        ),

        // 4. Quick Stats tile (2x1)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _StatsTile(
            activeOrderCount: activeOrderCount,
            colors: colors,
            isDark: isDark,
            onTap: () => context.go('/customer/orders'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 180.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 180.ms,
                  curve: Curves.easeOut),
        ),

        // 5. Promo tile (2x1)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _PromoTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 240.ms,
                  curve: Curves.easeOut),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Hero Tile
// ---------------------------------------------------------------------------

class _HeroTile extends StatelessWidget {
  const _HeroTile({required this.colors, required this.isDark});

  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderXl,
        boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
      ),
      child: Stack(
        children: [
          Positioned(
            right: -AppSpacing.sm,
            bottom: -AppSpacing.sm,
            child: Opacity(
              opacity: 0.07,
              child: PrinterIllustration(
                size: 110,
                color: colors.onBackground,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                'Professional\nprinting,\ndelivered.',
                style: AppTypography.display.copyWith(
                  color: colors.onBackground,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Paper & 3D services\nat your fingertips',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Service Tile
// ---------------------------------------------------------------------------

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.title,
    required this.icon,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final String title;
  final dynamic icon;
  final AppColorSet colors;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
          border: isDark
              ? Border.all(color: colors.outline, width: 0.5)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconContainer(
              icon: icon,
              size: IconContainerSize.md,
              shape: IconContainerShape.rounded,
              iconColor: colors.onBackground,
            ),
            Text(
              title,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stats Tile
// ---------------------------------------------------------------------------

class _StatsTile extends StatelessWidget {
  const _StatsTile({
    required this.activeOrderCount,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final int activeOrderCount;
  final AppColorSet colors;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
          border: isDark
              ? Border.all(color: colors.outline, width: 0.5)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconContainer(
              icon: HugeIcons.strokeRoundedPackage,
              size: IconContainerSize.md,
              shape: IconContainerShape.rounded,
              iconColor: colors.onBackground,
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$activeOrderCount',
                  style: AppTypography.h2.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                Text(
                  'Active orders',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Promo Tile
// ---------------------------------------------------------------------------

class _PromoTile extends StatelessWidget {
  const _PromoTile({required this.colors, required this.isDark});

  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark
            ? colors.surfaceHigh
            : colors.accent.withValues(alpha: 0.06),
        borderRadius: AppRadius.borderXl,
        boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'FEATURED',
            style: AppTypography.overline.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          Text(
            '20% off\nlarge format',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Verify no analysis errors**

Run: `dart analyze lib/features/customer/home/widgets/bento_grid.dart`
Expected: "No issues found!"

- [ ] **Step 3: Commit**

```bash
git add lib/features/customer/home/widgets/bento_grid.dart
git commit -m "feat: add BentoGrid widget with 5 quilted tiles"
```

---

### Task 3: Update `HomeScreen` to use `BentoGrid`

**Files:**
- Modify: `lib/features/customer/home/screens/home_screen.dart`

- [ ] **Step 1: Replace imports**

In `home_screen.dart`, replace the hero banner and service card imports:

Remove these imports:
```dart
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/customer/home/widgets/service_card.dart';
```

Replace with:
```dart
import 'package:printing_app/features/customer/home/widgets/bento_grid.dart';
```

Also remove the unused imports:
```dart
import 'package:hugeicons/hugeicons.dart';
import 'package:go_router/go_router.dart';
```

(These are now handled inside `BentoGrid`.)

- [ ] **Step 2: Replace the hero banner + services section in the Column children**

Replace everything between the greeting `Column` closing `)` and the recent orders section. Specifically, replace lines 74-112 (from `const SizedBox(height: AppSpacing.lg),` after the greeting through the second `ServiceCard`'s animation chain):

Remove:
```dart
              const SizedBox(height: AppSpacing.lg),

              // Hero banner
              const HeroBanner()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Services section
              const SectionHeader(title: 'Services'),

              ServiceCard(
                title: 'Paper Printing',
                description: 'Documents, posters, banners & more',
                icon: HugeIcons.strokeRoundedFile02,
                onTap: () {
                  context.push('/customer/order/new');
                },
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.md),

              ServiceCard(
                title: '3D Printing',
                description: 'Custom models, prototypes & figurines',
                icon: HugeIcons.strokeRoundedPackageDelivered,
                onTap: () {
                  context.push('/customer/order/new');
                },
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 180.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 180.ms, curve: Curves.easeOut),
```

Replace with:
```dart
              const SizedBox(height: AppSpacing.lg),

              // Bento grid
              const BentoGrid(),
```

- [ ] **Step 3: Also remove the now-unused `SectionHeader` import if it's only used for "Services"**

Check if `SectionHeader` is still used (it is — by `RecentOrdersSection`). Keep the import only if it's used directly in this file. Looking at the code, `SectionHeader` is imported but only the `RecentOrdersSection` uses it internally. So remove this import from `home_screen.dart`:

```dart
import 'package:printing_app/shared/widgets/section_header.dart';
```

Wait — check: `SectionHeader` with title `'Services'` is the only direct usage in `home_screen.dart`. The `RecentOrdersSection` imports its own `SectionHeader`. So yes, remove it.

- [ ] **Step 4: Verify no analysis errors**

Run: `dart analyze lib/features/customer/home/screens/home_screen.dart`
Expected: "No issues found!"

- [ ] **Step 5: Commit**

```bash
git add lib/features/customer/home/screens/home_screen.dart
git commit -m "feat: replace hero banner and service cards with BentoGrid"
```

---

### Task 4: Fix recent orders carousel alignment

**Files:**
- Modify: `lib/features/customer/home/widgets/recent_orders_section.dart`

- [ ] **Step 1: Update PageController initialization**

In `recent_orders_section.dart`, find the `initState` method (line 57-60). Change:

```dart
    _pageController = PageController(viewportFraction: 0.85);
```

To:

```dart
    _pageController = PageController(viewportFraction: 0.88, padEnds: false);
```

This makes the first card flush-left and subsequent cards peek from the right.

- [ ] **Step 2: Verify no analysis errors**

Run: `dart analyze lib/features/customer/home/widgets/recent_orders_section.dart`
Expected: "No issues found!"

- [ ] **Step 3: Commit**

```bash
git add lib/features/customer/home/widgets/recent_orders_section.dart
git commit -m "fix: flush-left carousel alignment for recent orders"
```

---

### Task 5: Run full analysis and verify

- [ ] **Step 1: Run full project analysis**

Run: `dart analyze lib/`
Expected: No errors. Warnings are acceptable if pre-existing.

- [ ] **Step 2: Run existing tests**

Run: `flutter test`
Expected: All existing tests pass (or pre-existing failures only).

- [ ] **Step 3: Final commit if any fixes were needed**

If analysis or tests required fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve analysis issues from bento grid integration"
```
