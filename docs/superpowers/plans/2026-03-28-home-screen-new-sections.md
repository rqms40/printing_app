# Home Screen New Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Quick Actions strip and Popular Prints carousel below the existing Recent Orders section on the customer home screen.

**Architecture:** Two new stateless widget files (`quick_actions_strip.dart`, `popular_prints_section.dart`) added to `lib/features/customer/home/widgets/`. The `home_screen.dart` is modified to include them in the scrollable Column. Both widgets follow existing patterns: theme-aware via `AppColorSet`, animated via `flutter_animate`, navigation via `go_router`.

**Tech Stack:** Flutter, flutter_animate, go_router, hugeicons

---

### Task 1: Create Quick Actions Strip Widget

**Files:**
- Create: `lib/features/customer/home/widgets/quick_actions_strip.dart`

- [ ] **Step 1: Create the quick_actions_strip.dart file**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Horizontal scrollable row of circular quick-action buttons.
class QuickActionsStrip extends StatelessWidget {
  const QuickActionsStrip({super.key});

  static const _actions = <_QuickActionData>[
    _QuickActionData(
      label: 'New\nOrder',
      icon: HugeIcons.strokeRoundedAdd01,
      route: '/customer/order/new',
      isPrimary: true,
    ),
    _QuickActionData(
      label: 'Reprint\nLast',
      icon: HugeIcons.strokeRoundedRepeat,
      isComingSoon: true,
    ),
    _QuickActionData(
      label: 'Upload\nFile',
      icon: HugeIcons.strokeRoundedUpload03,
      route: '/customer/order/new',
    ),
    _QuickActionData(
      label: 'Scan\nQR',
      icon: HugeIcons.strokeRoundedQrCode,
      isComingSoon: true,
    ),
    _QuickActionData(
      label: 'Track\nOrder',
      icon: HugeIcons.strokeRoundedSearch01,
      route: '/customer/orders',
    ),
  ];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Quick Actions'),
        SizedBox(
          height: 90,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _actions.length,
            separatorBuilder: (_, __) =>
                const SizedBox(width: AppSpacing.md),
            itemBuilder: (context, index) {
              final action = _actions[index];
              return _QuickActionItem(
                data: action,
                colors: colors,
              )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: (50 * index).ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.15,
                    duration: 400.ms,
                    delay: (50 * index).ms,
                    curve: Curves.easeOut,
                  );
            },
          ),
        ),
      ],
    );
  }
}

class _QuickActionData {
  final String label;
  final IconData icon;
  final String? route;
  final bool isPrimary;
  final bool isComingSoon;

  const _QuickActionData({
    required this.label,
    required this.icon,
    this.route,
    this.isPrimary = false,
    this.isComingSoon = false,
  });
}

class _QuickActionItem extends StatelessWidget {
  const _QuickActionItem({
    required this.data,
    required this.colors,
  });

  final _QuickActionData data;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (data.isComingSoon) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Coming soon!',
                style: AppTypography.body.copyWith(color: colors.accentOnColor),
              ),
              backgroundColor: colors.accent,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 1),
            ),
          );
          return;
        }
        if (data.route != null) {
          context.push(data.route!);
        }
      },
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: data.isPrimary ? colors.brand : colors.surface,
                border: data.isPrimary
                    ? null
                    : Border.all(
                        color: colors.outline,
                        width: 1.5,
                      ),
              ),
              child: Icon(
                data.icon,
                size: 22,
                color: data.isPrimary
                    ? colors.accentOnColor
                    : colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              data.label,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w500,
                fontSize: 11,
                height: 1.3,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /home/kiritos40/personal/commissions/printing_app && flutter analyze lib/features/customer/home/widgets/quick_actions_strip.dart`
Expected: No issues found

- [ ] **Step 3: Commit**

```bash
git add lib/features/customer/home/widgets/quick_actions_strip.dart
git commit -m "feat: add QuickActionsStrip widget for customer home screen"
```

---

### Task 2: Create Popular Prints Section Widget

**Files:**
- Create: `lib/features/customer/home/widgets/popular_prints_section.dart`

- [ ] **Step 1: Create the popular_prints_section.dart file**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Horizontal carousel of popular print type cards with illustrated previews.
class PopularPrintsSection extends StatelessWidget {
  const PopularPrintsSection({super.key});

  static const _prints = <_PrintTypeData>[
    _PrintTypeData(
      title: 'Documents',
      price: 'from ₱3',
      unit: '/ page',
      gradientColors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
      illustrationType: _IllustrationType.documents,
    ),
    _PrintTypeData(
      title: 'ID Photos',
      price: 'from ₱15',
      unit: '/ set',
      gradientColors: [Color(0xFF1A2E1A), Color(0xFF0F2F1A)],
      illustrationType: _IllustrationType.photos,
    ),
    _PrintTypeData(
      title: 'Posters',
      price: 'from ₱45',
      unit: '/ pc',
      gradientColors: [Color(0xFF2E1A2E), Color(0xFF1A1A2E)],
      illustrationType: _IllustrationType.posters,
    ),
    _PrintTypeData(
      title: 'Thesis Bind',
      price: 'from ₱120',
      unit: '/ copy',
      gradientColors: [Color(0xFF2E2A1A), Color(0xFF1A1A0E)],
      illustrationType: _IllustrationType.thesis,
    ),
    _PrintTypeData(
      title: '3D Prints',
      price: 'from ₱150',
      unit: '/ model',
      gradientColors: [Color(0xFF1A2E2E), Color(0xFF0E1A2E)],
      illustrationType: _IllustrationType.threeDPrint,
    ),
    _PrintTypeData(
      title: 'Stickers',
      price: 'from ₱25',
      unit: '/ sheet',
      gradientColors: [Color(0xFF2E1A1E), Color(0xFF2E1A2A)],
      illustrationType: _IllustrationType.stickers,
    ),
  ];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Popular Prints',
          actionLabel: 'See All',
          onAction: () => context.push('/customer/order/new'),
        ),
        SizedBox(
          height: 175,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _prints.length,
            separatorBuilder: (_, __) =>
                const SizedBox(width: AppSpacing.sm + 4),
            itemBuilder: (context, index) {
              final printType = _prints[index];
              return _PrintCard(
                data: printType,
                colors: colors,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.15,
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  );
            },
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
enum _IllustrationType { documents, photos, posters, thesis, threeDPrint, stickers }

class _PrintTypeData {
  final String title;
  final String price;
  final String unit;
  final List<Color> gradientColors;
  final _IllustrationType illustrationType;

  const _PrintTypeData({
    required this.title,
    required this.price,
    required this.unit,
    required this.gradientColors,
    required this.illustrationType,
  });
}

// ---------------------------------------------------------------------------
// Print card
// ---------------------------------------------------------------------------
class _PrintCard extends StatefulWidget {
  const _PrintCard({
    required this.data,
    required this.colors,
    required this.onTap,
  });

  final _PrintTypeData data;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  State<_PrintCard> createState() => _PrintCardState();
}

class _PrintCardState extends State<_PrintCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          width: 150,
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: isDark
                  ? widget.colors.outline.withValues(alpha: 0.5)
                  : widget.colors.outlineVariant,
              width: 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Illustration area
              Container(
                height: 100,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? widget.data.gradientColors
                        : [
                            widget.data.gradientColors[0]
                                .withValues(alpha: 0.08),
                            widget.data.gradientColors[1]
                                .withValues(alpha: 0.12),
                          ],
                  ),
                ),
                child: Center(
                  child: _buildIllustration(widget.data.illustrationType, isDark),
                ),
              ),
              // Text body
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.data.title,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: widget.data.price,
                            style: AppTypography.caption.copyWith(
                              color: widget.colors.brand,
                              fontWeight: FontWeight.w600,
                              fontSize: 11,
                            ),
                          ),
                          TextSpan(
                            text: ' ${widget.data.unit}',
                            style: AppTypography.caption.copyWith(
                              color: widget.colors.onSurfaceDim,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Illustrations — pure Flutter painting, no images
// ---------------------------------------------------------------------------
Widget _buildIllustration(_IllustrationType type, bool isDark) {
  switch (type) {
    case _IllustrationType.documents:
      return _DocumentsIllustration(isDark: isDark);
    case _IllustrationType.photos:
      return _PhotosIllustration(isDark: isDark);
    case _IllustrationType.posters:
      return _PostersIllustration(isDark: isDark);
    case _IllustrationType.thesis:
      return _ThesisIllustration(isDark: isDark);
    case _IllustrationType.threeDPrint:
      return _ThreeDIllustration(isDark: isDark);
    case _IllustrationType.stickers:
      return _StickersIllustration(isDark: isDark);
  }
}

class _DocumentsIllustration extends StatelessWidget {
  const _DocumentsIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Back page
        Transform.translate(
          offset: const Offset(-4, 4),
          child: Container(
            width: 48,
            height: 62,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFFE0E0E0) : const Color(0xFFCCCCCC),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
        // Front page
        Container(
          width: 48,
          height: 62,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFFF0F0F0) : const Color(0xFFE8E8E8),
            borderRadius: BorderRadius.circular(3),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 8,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(height: 3, width: 32, color: const Color(0xFFAAAAAA)),
              const SizedBox(height: 4),
              Container(height: 3, width: 24, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 4),
              Container(height: 3, width: 28, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 4),
              Container(height: 3, width: 20, color: const Color(0xFFCCCCCC)),
            ],
          ),
        ),
      ],
    );
  }
}

class _PhotosIllustration extends StatelessWidget {
  const _PhotosIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 60,
      height: 50,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            isDark ? const Color(0xFFFFDE58) : const Color(0xFFD4A017),
            isDark ? const Color(0xFFFF9800) : const Color(0xFFB8860B),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFDE58).withValues(alpha: isDark ? 0.3 : 0.15),
            blurRadius: 12,
          ),
        ],
      ),
      child: Stack(
        children: [
          // Sun
          Positioned(
            top: 8,
            right: 10,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.8),
              ),
            ),
          ),
          // Mountains
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(4),
              ),
              child: CustomPaint(
                size: const Size(60, 22),
                painter: _MountainPainter(isDark: isDark),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MountainPainter extends CustomPainter {
  _MountainPainter({required this.isDark});
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = isDark ? const Color(0xFF4CAF50) : const Color(0xFF2E7D32);
    final path = Path()
      ..moveTo(0, size.height)
      ..lineTo(size.width * 0.3, size.height * 0.2)
      ..lineTo(size.width * 0.55, size.height * 0.6)
      ..lineTo(size.width * 0.75, size.height * 0.15)
      ..lineTo(size.width, size.height * 0.5)
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PostersIllustration extends StatelessWidget {
  const _PostersIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 50,
      height: 65,
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? const Color(0xFFF0F0F0) : const Color(0xFF555555),
          width: 2,
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Text(
          'A2',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: (isDark ? const Color(0xFFF0F0F0) : const Color(0xFF555555))
                .withValues(alpha: 0.6),
          ),
        ),
      ),
    );
  }
}

class _ThesisIllustration extends StatelessWidget {
  const _ThesisIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Book spine shadow
        Transform.translate(
          offset: const Offset(-3, 0),
          child: Container(
            width: 6,
            height: 60,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF5C3310) : const Color(0xFF8B6914),
              borderRadius: const BorderRadius.horizontal(
                left: Radius.circular(2),
              ),
            ),
          ),
        ),
        // Book body
        Container(
          width: 45,
          height: 60,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [const Color(0xFF8B4513), const Color(0xFF654321)]
                  : [const Color(0xFFA0522D), const Color(0xFF8B4513)],
            ),
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(4),
              left: Radius.circular(2),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
              const SizedBox(height: 6),
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
              const SizedBox(height: 6),
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
            ],
          ),
        ),
      ],
    );
  }
}

class _ThreeDIllustration extends StatelessWidget {
  const _ThreeDIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: 0.785, // 45 degrees
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFFFFDE58), const Color(0xFFE6C84A)]
                : [const Color(0xFFD4A017), const Color(0xFFB8960A)],
          ),
          borderRadius: BorderRadius.circular(4),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? const Color(0xFFB8960A)
                  : const Color(0xFF8B7510),
              offset: const Offset(4, 4),
              blurRadius: 0,
            ),
            BoxShadow(
              color: const Color(0xFFFFDE58).withValues(alpha: isDark ? 0.2 : 0.1),
              blurRadius: 20,
            ),
          ],
        ),
      ),
    );
  }
}

class _StickersIllustration extends StatelessWidget {
  const _StickersIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.rotate(
          angle: -0.17,
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFFFF6B6B) : const Color(0xFFE05555),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(-4, -6),
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFFFFDE58) : const Color(0xFFD4A017),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(-8, 0),
          child: Transform.rotate(
            angle: 0.17,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? const Color(0xFF51CF66) : const Color(0xFF2E7D32),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.2),
                  width: 2,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /home/kiritos40/personal/commissions/printing_app && flutter analyze lib/features/customer/home/widgets/popular_prints_section.dart`
Expected: No issues found

- [ ] **Step 3: Commit**

```bash
git add lib/features/customer/home/widgets/popular_prints_section.dart
git commit -m "feat: add PopularPrintsSection widget with illustrated product cards"
```

---

### Task 3: Integrate New Sections into Home Screen

**Files:**
- Modify: `lib/features/customer/home/screens/home_screen.dart`

- [ ] **Step 1: Add imports to home_screen.dart**

Add these two imports after the existing imports at the top of the file (after line 8):

```dart
import 'package:printing_app/features/customer/home/widgets/quick_actions_strip.dart';
import 'package:printing_app/features/customer/home/widgets/popular_prints_section.dart';
```

- [ ] **Step 2: Add Quick Actions and Popular Prints below Recent Orders**

In the `Column` children list inside `SingleChildScrollView`, replace the final `SizedBox(height: AppSpacing.lg)` (the one after `RecentOrdersSection`, around line 83) with the two new sections and a bottom spacer:

Replace this block (lines 78-84):
```dart
              // Recent orders section
              const RecentOrdersSection()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),
```

With:
```dart
              // Recent orders section
              const RecentOrdersSection()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Quick actions strip
              const QuickActionsStrip()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 320.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 320.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Popular prints carousel
              const PopularPrintsSection()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 400.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxl),
```

- [ ] **Step 3: Verify the full home screen compiles**

Run: `cd /home/kiritos40/personal/commissions/printing_app && flutter analyze lib/features/customer/home/`
Expected: No issues found

- [ ] **Step 4: Commit**

```bash
git add lib/features/customer/home/screens/home_screen.dart
git commit -m "feat: integrate Quick Actions and Popular Prints into customer home screen"
```

---

### Task 4: Visual Verification

- [ ] **Step 1: Run the app and verify on device/emulator**

Run: `cd /home/kiritos40/personal/commissions/printing_app && flutter run`

Verify:
1. Home screen scrolls: Greeting → Bento Grid → Recent Orders → Quick Actions → Popular Prints
2. Quick Actions: 5 circular buttons scroll horizontally, "New Order" has yellow fill, others grey outline
3. Tapping "New Order" navigates to `/customer/order/new`
4. Tapping "Reprint Last" or "Scan QR" shows "Coming soon!" snackbar
5. Popular Prints: 6 cards scroll horizontally with gradient illustrations
6. Each card shows title and price in brand yellow
7. Tapping any card navigates to `/customer/order/new`
8. All sections animate in with staggered fade + slide
9. Dark mode: illustrations look correct, colors match theme
10. Light mode: gradient alphas are subtle, text is readable

- [ ] **Step 2: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: visual adjustments for home screen new sections"
```
