import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Data class for a navigation item in [AppBottomNav].
class NavItem {
  const NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  /// Can be [IconData] (Material) or HugeIcons SVG data (List).
  final dynamic icon;

  /// Can be [IconData] (Material) or HugeIcons SVG data (List).
  final dynamic activeIcon;
  final String label;
}

/// Bottom navigation bar following the DarkastixPrint greyscale design.
///
/// Active items show a filled icon + label in accent color.
/// Inactive items show an outlined icon in onSurfaceDim, no label.
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
        child: SizedBox(
          height: 56,
          child: Row(
            children: List.generate(items.length, (index) {
              final item = items[index];
              final isActive = index == currentIndex;

              return Expanded(
                child: InkWell(
                  onTap: () => onTap(index),
                  child: SizedBox(
                    height: 56,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Builder(builder: (context) {
                          final iconData =
                              isActive ? item.activeIcon : item.icon;
                          final color = isActive
                              ? colors.accent
                              : colors.onSurfaceDim;
                          if (iconData is IconData) {
                            return Icon(iconData, size: 24, color: color);
                          }
                          return HugeIcon(
                              icon: iconData, size: 24, color: color);
                        }),
                        if (isActive) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            item.label,
                            style: AppTypography.caption.copyWith(
                              color: colors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
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
