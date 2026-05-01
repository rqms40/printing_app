import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class SegmentedItem<T> {
  const SegmentedItem({required this.value, required this.icon, required this.label});
  final T value;
  final List<List<dynamic>> icon;
  final String label;
}

class CheckoutSegmented<T> extends StatelessWidget {
  const CheckoutSegmented({
    super.key,
    required this.items,
    required this.selected,
    required this.onChanged,
    this.tutorialKey,
  });

  final List<SegmentedItem<T>> items;
  final T selected;
  final ValueChanged<T> onChanged;
  final GlobalKey? tutorialKey;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return KeyedSubtree(
      key: tutorialKey,
      child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: colors.outline.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(item.value),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: item.value == selected ? colors.brand : Colors.transparent,
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      HugeIcon(
                        icon: item.icon,
                        size: 16,
                        color: item.value == selected
                            ? colors.background
                            : colors.onSurfaceDim,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        item.label,
                        style: AppTypography.caption.copyWith(
                          color: item.value == selected
                              ? colors.background
                              : colors.onBackground,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
    );
  }
}
