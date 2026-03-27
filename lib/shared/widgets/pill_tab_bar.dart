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

/// Reusable pill-style tab selector matching the DarkastixPrint design system.
///
/// Usage:
/// ```dart
/// PillTabBar(
///   tabs: [PillTab(label: 'Active', count: 3), PillTab(label: 'Done')],
///   selectedIndex: _selectedTab,
///   onTabChanged: (i) => setState(() => _selectedTab = i),
/// )
/// ```
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

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderFull,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(tabs.length, (index) {
            final tab = tabs[index];
            final isSelected = index == selectedIndex;

            return GestureDetector(
              onTap: () => onTabChanged(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? colors.surface : Colors.transparent,
                  borderRadius: AppRadius.borderFull,
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color:
                                colors.onBackground.withValues(alpha: 0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      tab.label,
                      style: (isSelected
                              ? AppTypography.bodyBold
                              : AppTypography.body)
                          .copyWith(
                        color: isSelected
                            ? colors.onBackground
                            : colors.onSurfaceDim,
                      ),
                    ),
                    if (tab.count > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 1),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? colors.accent.withValues(alpha: 0.1)
                              : colors.onSurfaceDim.withValues(alpha: 0.1),
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
            );
          }),
        ),
      ),
    );
  }
}
