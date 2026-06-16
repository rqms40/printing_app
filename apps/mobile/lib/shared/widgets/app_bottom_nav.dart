import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Public data classes
// ─────────────────────────────────────────────────────────────────────────────

/// Data class for a navigation item in [AppBottomNav].
class NavItem {
  const NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.badge = 0,
  });

  final dynamic icon;
  final dynamic activeIcon;
  final String label;
  final int badge;
}

/// Data for a single quick-action button shown in the FAB panel.
class QuickActionItem {
  final String label;
  final dynamic icon;
  final String? route;
  final bool isPrimary;
  final bool isComingSoon;
  final bool useGo;

  const QuickActionItem({
    required this.label,
    required this.icon,
    this.route,
    this.isPrimary = false,
    this.isComingSoon = false,
    this.useGo = false,
  });
}

/// Default quick-action list.
const kQuickActions = <QuickActionItem>[
  QuickActionItem(
    label: 'New Order',
    icon: HugeIcons.strokeRoundedAdd01,
    route: '/customer/order/new',
    isPrimary: true,
  ),
  QuickActionItem(
    label: 'Your Queue',
    icon: HugeIcons.strokeRoundedFile02,
    route: '/customer/order/checkout',
  ),
  QuickActionItem(
    label: 'Support',
    icon: HugeIcons.strokeRoundedHelpCircle,
    route: '/customer/profile/support',
  ),
  QuickActionItem(
    label: 'Track',
    icon: HugeIcons.strokeRoundedSearch01,
    route: '/customer/orders',
    useGo: true,
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// AppBottomNav
// ─────────────────────────────────────────────────────────────────────────────

/// Bottom navigation bar.
///
/// When [showFab] is true (customer), renders 2 items + a 72 px center gap
/// (where [ScaffoldWithNav] places its floating FAB) + 2 items.
/// When [showFab] is false (rider / admin), renders all items evenly.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.showFab = false,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  /// When true a 72 px gap is left in the centre for the floating FAB.
  final bool showFab;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final viewPadding = MediaQuery.of(context).viewPadding;

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(padding: viewPadding),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(
            top: BorderSide(color: colors.outline, width: 0.5),
          ),
        ),
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 4),
          child: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: showFab ? _buildWithGap(colors) : _buildFlat(colors),
          ),
        ),
      ),
    );
  }

  /// 2 left items + centre gap + 2 right items.
  Widget _buildWithGap(AppColorSet colors) {
    final leftItems = items.take(2).toList();
    final rightItems = items.skip(2).toList();
    return Row(
      children: [
        ...List.generate(leftItems.length, (i) => _NavItemTile(
          item: leftItems[i],
          isActive: i == currentIndex,
          onTap: () => onTap(i),
          colors: colors,
        )),
        // Empty slot — floating FAB sits here from ScaffoldWithNav's Stack
        const SizedBox(width: 72, height: 56),
        ...List.generate(rightItems.length, (i) {
          final globalIndex = i + leftItems.length;
          return _NavItemTile(
            item: rightItems[i],
            isActive: globalIndex == currentIndex,
            onTap: () => onTap(globalIndex),
            colors: colors,
          );
        }),
      ],
    );
  }

  /// All items evenly distributed — no FAB gap.
  Widget _buildFlat(AppColorSet colors) {
    return Row(
      children: List.generate(items.length, (i) => _NavItemTile(
        item: items[i],
        isActive: i == currentIndex,
        onTap: () => onTap(i),
        colors: colors,
      )),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav item tile
// ─────────────────────────────────────────────────────────────────────────────

class _NavItemTile extends StatelessWidget {
  const _NavItemTile({
    required this.item,
    required this.isActive,
    required this.onTap,
    required this.colors,
  });

  final NavItem item;
  final bool isActive;
  final VoidCallback onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          height: 52,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding: EdgeInsets.symmetric(
                  horizontal: isActive ? 16 : 0,
                  vertical: isActive ? 4 : 0,
                ),
                decoration: BoxDecoration(
                  color: isActive
                      ? colors.accent.withValues(alpha: 0.1)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Builder(builder: (context) {
                      final iconData = isActive ? item.activeIcon : item.icon;
                      final color =
                          isActive ? colors.onBackground : colors.onSurfaceDim;
                      if (iconData is IconData) {
                        return Icon(iconData, size: 22, color: color);
                      }
                      return HugeIcon(icon: iconData, size: 22, color: color);
                    }),
                    if (item.badge > 0)
                      Positioned(
                        top: -4,
                        right: -6,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 14),
                          height: 14,
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE53935),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Center(
                            child: Text(
                              item.badge > 9 ? '9+' : '${item.badge}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w700,
                                height: 1,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                style: AppTypography.caption.copyWith(
                  color: isActive ? colors.onBackground : colors.onSurfaceDim,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  fontSize: 11,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-action panel — rendered by ScaffoldWithNav above the whole page
// ─────────────────────────────────────────────────────────────────────────────

/// The yellow floating panel. Placed in [ScaffoldWithNav]'s Stack so it
/// truly overlays the page content.
class QuickActionPanel extends StatelessWidget {
  const QuickActionPanel({
    super.key,
    required this.slideAnim,
    required this.fadeAnim,
    required this.navBarHeight,
    required this.onActionTap,
    this.ignoring = false,
  });

  final Animation<Offset> slideAnim;
  final Animation<double> fadeAnim;
  final double navBarHeight;
  final void Function(QuickActionItem) onActionTap;

  /// When true the panel is invisible to hit-testing (closed state).
  final bool ignoring;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: navBarHeight,
      child: IgnorePointer(
        ignoring: ignoring,
        child: SlideTransition(
          position: slideAnim,
          child: FadeTransition(
            opacity: fadeAnim,
            child: _PanelBody(onActionTap: onActionTap),
          ),
        ),
      ),
    );
  }
}

class _PanelBody extends StatelessWidget {
  const _PanelBody({required this.onActionTap});

  final void Function(QuickActionItem) onActionTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: colors.brand,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: colors.brand.withValues(alpha: 0.5),
            blurRadius: 28,
            spreadRadius: 2,
            offset: const Offset(0, -6),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Title
            const Text(
              'Quick Actions',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                letterSpacing: 0.4,
              ),
            ),
            const SizedBox(height: 18),

            // Action grid
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(kQuickActions.length, (i) {
                final qa = kQuickActions[i];
                return TweenAnimationBuilder<double>(
                  key: ValueKey(i),
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: Duration(milliseconds: 240 + i * 55),
                  curve: Curves.easeOutBack,
                  builder: (_, v, child) => Transform.scale(
                    scale: v.clamp(0.0, 1.0),
                    child: Opacity(opacity: v.clamp(0.0, 1.0), child: child),
                  ),
                  child: _ActionItem(
                    qa: qa,
                    onTap: () => onActionTap(qa),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual action button
// ─────────────────────────────────────────────────────────────────────────────

class _ActionItem extends StatefulWidget {
  const _ActionItem({required this.qa, required this.onTap});

  final QuickActionItem qa;
  final VoidCallback onTap;

  @override
  State<_ActionItem> createState() => _ActionItemState();
}

class _ActionItemState extends State<_ActionItem> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.87 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: SizedBox(
          width: 64,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: widget.qa.isPrimary
                      ? Colors.black
                      : Colors.black.withValues(alpha: 0.09),
                  shape: BoxShape.circle,
                  border: widget.qa.isPrimary
                      ? null
                      : Border.all(
                          color: Colors.black.withValues(alpha: 0.18),
                          width: 1.5,
                        ),
                ),
                child: Center(
                  child: HugeIcon(
                    icon: widget.qa.icon,
                    size: 22,
                    color: widget.qa.isPrimary
                        ? colors.brand
                        : Colors.black,
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Text(
                widget.qa.label,
                style: const TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w600,
                  fontSize: 10,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
