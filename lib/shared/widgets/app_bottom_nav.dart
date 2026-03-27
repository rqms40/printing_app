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

  /// Outline/stroke icon shown when inactive.
  final dynamic icon;

  /// Solid/filled icon shown when active.
  final dynamic activeIcon;

  /// Label always visible below the icon.
  final String label;
}

/// Bottom navigation bar following mobile UX best practices:
///
/// - Labels ALWAYS visible (improves discoverability per Material guidelines)
/// - Active: solid icon + accent-colored label
/// - Inactive: outline icon + dim label
/// - Active indicator pill behind the icon (Material 3 pattern)
/// - Min 48dp touch target per item
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

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          top: BorderSide(color: colors.outline, width: 0.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 4),
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
                        // Icon with optional active indicator pill
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
                        // Label — always visible
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
    );
  }
}
