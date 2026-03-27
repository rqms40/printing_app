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

/// Bottom navigation bar with proper iPhone safe area handling.
///
/// Uses `MediaQuery.viewPadding.bottom` directly to add padding for
/// the home indicator on iPhone X+ (34px). This works even when a
/// parent widget has consumed the SafeArea insets.
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

    // iPhone home indicator: ~34px on iPhone X+, 0 on older/Android
    final bottomInset = MediaQuery.of(context).viewPadding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          top: BorderSide(color: colors.outline, width: 0.5),
        ),
      ),
      padding: EdgeInsets.only(
        top: 6,
        bottom: bottomInset > 0 ? bottomInset : 4,
      ),
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
                    // Icon with indicator pill
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
                    // Label
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
    );
  }
}
