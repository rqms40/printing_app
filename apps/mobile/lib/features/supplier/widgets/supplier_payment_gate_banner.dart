import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';

/// Banner shown when a job is accepted but production is blocked until
/// ops authorizes payment (`payment_authorized`).
///
/// Widget tests assert [SupplierPaymentGateCopy.needsPaymentAuthorized]
/// and related copy here.
class SupplierPaymentGateBanner extends StatelessWidget {
  const SupplierPaymentGateBanner({
    super.key,
    this.compact = false,
    this.orderStatusLabel,
  });

  /// When true, shows only the compact gate line (for inline action panels).
  final bool compact;

  /// Optional current status label (e.g. "Awaiting Payment").
  final String? orderStatusLabel;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    if (compact) {
      return Semantics(
        label: SupplierPaymentGateCopy.needsPaymentAuthorized,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.warning.withValues(alpha: 0.12),
            borderRadius: AppRadius.borderMd,
            border: Border.all(color: colors.warning.withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              HugeIcon(
                icon: HugeIcons.strokeRoundedLockPassword,
                color: colors.warning,
                size: 18,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  SupplierPaymentGateCopy.needsPaymentAuthorized,
                  style: AppTypography.caption.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Semantics(
      label: SupplierPaymentGateCopy.waitingTitle,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.info.withValues(alpha: 0.12),
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.info.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedClock01,
                  color: colors.info,
                  size: 20,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    SupplierPaymentGateCopy.waitingTitle,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              SupplierPaymentGateCopy.waitingBody,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              SupplierPaymentGateCopy.needsPaymentAuthorized,
              style: AppTypography.caption.copyWith(
                color: colors.info,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (orderStatusLabel != null && orderStatusLabel!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Current status: $orderStatusLabel',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
