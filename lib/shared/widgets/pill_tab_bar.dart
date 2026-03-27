import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Data class for a single pill tab.
class PillTab {
  const PillTab({required this.label, this.count = 0});

  final String label;
  final int count;
}

/// Pill-style segmented tab selector with a smooth sliding indicator.
///
/// Uses a single animated positioned indicator that slides behind the
/// selected tab — no per-tab background animation, no flicker.
class PillTabBar extends StatelessWidget {
  const PillTabBar({
    super.key,
    required this.tabs,
    required this.selectedIndex,
    required this.onTabChanged,
  });

  final List<PillTab> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTabChanged;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: 40,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderFull,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tabWidth = constraints.maxWidth / tabs.length;

          return Stack(
            children: [
              // Sliding indicator
              AnimatedPositioned(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                left: selectedIndex * tabWidth,
                top: 0,
                bottom: 0,
                width: tabWidth,
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadius.borderFull,
                    boxShadow: [
                      BoxShadow(
                        color: (isDark ? Colors.black : colors.onBackground)
                            .withValues(alpha: isDark ? 0.3 : 0.08),
                        blurRadius: 6,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),

              // Tab labels
              Row(
                children: List.generate(tabs.length, (index) {
                  final tab = tabs[index];
                  final isSelected = index == selectedIndex;

                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onTabChanged(index),
                      behavior: HitTestBehavior.opaque,
                      child: Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Use AnimatedDefaultTextStyle for smooth font weight transition
                            AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 200),
                              style: AppTypography.body.copyWith(
                                color: isSelected
                                    ? colors.onBackground
                                    : colors.onSurfaceDim,
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w400,
                                fontSize: 13,
                              ),
                              child: Text(
                                tab.label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (tab.count > 0) ...[
                              const SizedBox(width: 5),
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? colors.accent.withValues(alpha: 0.12)
                                      : colors.onSurfaceDim
                                          .withValues(alpha: 0.08),
                                  borderRadius: AppRadius.borderFull,
                                ),
                                child: Text(
                                  '${tab.count}',
                                  style: AppTypography.caption.copyWith(
                                    color: isSelected
                                        ? colors.accent
                                        : colors.onSurfaceDim,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}
