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

/// Bottom navigation bar built on Flutter's [BottomAppBar] for proper
/// safe area handling on all devices (iPhone home indicator, Android
/// gesture bar, etc.).
///
/// [BottomAppBar] is the framework's recommended container for custom
/// bottom navigation — it automatically respects device insets via
/// [SafeArea] internally and integrates with [Scaffold.bottomNavigationBar].
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

    return BottomAppBar(
      color: colors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      padding: EdgeInsets.zero,
      height: null, // auto-size based on content + safe area
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: colors.outline, width: 0.5),
          ),
        ),
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
    );
  }
}
