import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';

/// Bottom sheet that lets the user pick which drop a single copy of a print
/// job should be sent to. Returns the selected [DestinationGroup.id], or
/// `null` if the user dismissed without picking. A sentinel value of `__new__`
/// is returned if the user taps "Add a new drop" — caller is responsible for
/// creating the new drop and re-running the assignment.
class AssignDropSheet {
  static const newDropSentinel = '__new__';

  static Future<String?> show(
    BuildContext context, {
    required List<DestinationGroup> drops,
    required String itemFileName,
    required int copyIndex,
    required int totalCopies,
    required String? currentDropId,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AssignDropBody(
        drops: drops,
        itemFileName: itemFileName,
        copyIndex: copyIndex,
        totalCopies: totalCopies,
        currentDropId: currentDropId,
      ),
    );
  }
}

class _AssignDropBody extends StatelessWidget {
  const _AssignDropBody({
    required this.drops,
    required this.itemFileName,
    required this.copyIndex,
    required this.totalCopies,
    required this.currentDropId,
  });

  final List<DestinationGroup> drops;
  final String itemFileName;
  final int copyIndex;
  final int totalCopies;
  final String? currentDropId;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return SafeArea(
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Send copy to',
              style: AppTypography.h3.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '$itemFileName · copy ${copyIndex + 1} of $totalCopies',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            for (var i = 0; i < drops.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _DropRow(
                drop: drops[i],
                index: i,
                colors: colors,
                selected: drops[i].id == currentDropId,
                onTap: () => Navigator.of(context).pop(drops[i].id),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            InkWell(
              borderRadius: AppRadius.borderLg,
              onTap: () =>
                  Navigator.of(context).pop(AssignDropSheet.newDropSentinel),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.background,
                  borderRadius: AppRadius.borderLg,
                  border: Border.all(
                    color: colors.brand.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: colors.brand.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: HugeIcon(
                          icon: HugeIcons.strokeRoundedAdd01,
                          size: 16,
                          color: colors.brand,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Add a new drop',
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.brand,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DropRow extends StatelessWidget {
  const _DropRow({
    required this.drop,
    required this.index,
    required this.colors,
    required this.selected,
    required this.onTap,
  });

  final DestinationGroup drop;
  final int index;
  final AppColorSet colors;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadius.borderLg,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected
              ? colors.brand.withValues(alpha: 0.10)
              : colors.background,
          borderRadius: AppRadius.borderLg,
          border: Border.all(
            color: selected
                ? colors.brand.withValues(alpha: 0.6)
                : colors.outline.withValues(alpha: 0.35),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: selected
                    ? colors.brand
                    : colors.brand.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedLocation01,
                  size: 18,
                  color: selected ? colors.background : colors.brand,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    drop.label,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    drop.addressId == null
                        ? 'No address yet'
                        : 'Address #${drop.addressId}',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              HugeIcon(
                icon: HugeIcons.strokeRoundedTick02,
                size: 18,
                color: colors.brand,
              ),
          ],
        ),
      ),
    );
  }
}
