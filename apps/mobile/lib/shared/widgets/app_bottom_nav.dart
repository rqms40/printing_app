import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  });

  final dynamic icon;
  final dynamic activeIcon;
  final String label;
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
    label: 'Reprint',
    icon: HugeIcons.strokeRoundedRepeat,
    isComingSoon: true,
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

/// Bottom navigation bar with a "+" FAB in the center slot.
///
/// The toggle state, panel, teardrop, and close button are all managed by
/// [ScaffoldWithNav] so they can truly float above the page.
/// [AppBottomNav] just renders the bar and emits tap events.
class AppBottomNav extends StatefulWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.onToggle,
    this.isOpen = false,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final ValueChanged<bool>? onToggle;

  /// True when the quick-action panel is open. The FAB fades out so the
  /// teardrop + close button from [ScaffoldWithNav] take its place.
  final bool isOpen;

  @override
  State<AppBottomNav> createState() => _AppBottomNavState();
}

class _AppBottomNavState extends State<AppBottomNav>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fabCtrl;

  @override
  void initState() {
    super.initState();
    _fabCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void didUpdateWidget(AppBottomNav old) {
    super.didUpdateWidget(old);
    if (widget.isOpen != old.isOpen) {
      widget.isOpen ? _fabCtrl.forward() : _fabCtrl.reverse();
    }
  }

  @override
  void dispose() {
    _fabCtrl.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  void _handleFabTap() {
    HapticFeedback.lightImpact();
    widget.onToggle?.call(!widget.isOpen);
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final viewPadding = MediaQuery.of(context).viewPadding;

    final leftItems = widget.items.take(2).toList();
    final rightItems = widget.items.skip(2).toList();

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
            child: Row(
              children: [
                // ── Left nav items ─────────────────────────────────────────
                ...List.generate(leftItems.length, (i) {
                  return _NavItemTile(
                    item: leftItems[i],
                    isActive: i == widget.currentIndex,
                    onTap: () => widget.onTap(i),
                    colors: colors,
                  );
                }),

                // ── Center FAB slot ─────────────────────────────────────────
                // Fades out when open so the ScaffoldWithNav overlay takes over
                SizedBox(
                  width: 72,
                  height: 56,
                  child: Center(
                    child: AnimatedOpacity(
                      opacity: widget.isOpen ? 0.0 : 1.0,
                      duration: const Duration(milliseconds: 200),
                      child: GestureDetector(
                        onTap: _handleFabTap,
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFDE58),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Color(0x55FFDE58),
                                blurRadius: 12,
                                spreadRadius: 0,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.add_rounded,
                            size: 28,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // ── Right nav items ─────────────────────────────────────────
                ...List.generate(rightItems.length, (i) {
                  final globalIndex = i + leftItems.length;
                  return _NavItemTile(
                    item: rightItems[i],
                    isActive: globalIndex == widget.currentIndex,
                    onTap: () => widget.onTap(globalIndex),
                    colors: colors,
                  );
                }),
              ],
            ),
          ),
        ),
      ),
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
                child: Builder(builder: (context) {
                  final iconData = isActive ? item.activeIcon : item.icon;
                  final color =
                      isActive ? colors.onBackground : colors.onSurfaceDim;
                  if (iconData is IconData) {
                    return Icon(iconData, size: 22, color: color);
                  }
                  return HugeIcon(icon: iconData, size: 22, color: color);
                }),
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
  });

  final Animation<Offset> slideAnim;
  final Animation<double> fadeAnim;
  final double navBarHeight;
  final void Function(QuickActionItem) onActionTap;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: navBarHeight,
      child: SlideTransition(
        position: slideAnim,
        child: FadeTransition(
          opacity: fadeAnim,
          child: _PanelBody(onActionTap: onActionTap),
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
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFDE58),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFDE58).withValues(alpha: 0.5),
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
                        ? const Color(0xFFFFDE58)
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
