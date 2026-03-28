import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

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

/// Bottom navigation bar using [SafeArea] for universal platform support.
///
/// Works correctly on: iOS (home indicator), Android (gesture bar),
/// PWA web (browser toolbars), and desktop.
///
/// The [MediaQuery.removePadding] wrapper ensures SafeArea insets
/// are NOT consumed by parent widgets — our nav bar always gets the
/// full bottom padding regardless of widget tree structure.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    // Re-inject the original viewPadding so SafeArea works even if
    // a parent Scaffold/SafeArea consumed the padding.
    final viewPadding = MediaQuery.of(context).viewPadding;

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(
        padding: viewPadding,
      ),
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
              children: List.generate(items.length, (index) {
                final item = items[index];
                final isActive = index == currentIndex;

                return Expanded(
                  child: GestureDetector(
                    onTap: () => onTap(index),
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
                              final iconData =
                                  isActive ? item.activeIcon : item.icon;
                              final color = isActive
                                  ? colors.onBackground
                                  : colors.onSurfaceDim;
                              if (iconData is IconData) {
                                return Icon(iconData, size: 22, color: color);
                              }
                              return HugeIcon(
                                  icon: iconData, size: 22, color: color);
                            }),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.label,
                            style: AppTypography.caption.copyWith(
                              color: isActive
                                  ? colors.onBackground
                                  : colors.onSurfaceDim,
                              fontWeight:
                                  isActive ? FontWeight.w600 : FontWeight.w400,
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
              }),
            ),
          ),
        ),
      ),
    );
  }
}
