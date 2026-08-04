import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

class SupplierJobCard extends StatelessWidget {
  const SupplierJobCard({
    super.key,
    required this.job,
    this.onTap,
  });

  final SupplierJobListItem job;
  final VoidCallback? onTap;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  StatusBadgeVariant _statusVariant(OrderStatus status) {
    return switch (status) {
      OrderStatus.supplierAssigned => StatusBadgeVariant.warning,
      OrderStatus.supplierAccepted ||
      OrderStatus.awaitingPayment => StatusBadgeVariant.info,
      OrderStatus.paymentAuthorized ||
      OrderStatus.production => StatusBadgeVariant.info,
      OrderStatus.supplierSelfQc => StatusBadgeVariant.warning,
      OrderStatus.readyForDispatch => StatusBadgeVariant.success,
      _ => StatusBadgeVariant.neutral,
    };
  }

  Color? _accent(AppColorSet colors) {
    if (job.isPendingAccept) return colors.warning;
    if (job.isWaitingPayment) return colors.info;
    if (job.orderStatus == OrderStatus.readyForDispatch) return colors.success;
    return colors.accent;
  }

  String? _deadlineLabel() {
    final deadline = job.acceptanceDeadline;
    if (deadline == null || !job.isPendingAccept) return null;
    final remaining = deadline.difference(DateTime.now());
    if (remaining.isNegative) return 'Acceptance window expired';
    final hours = remaining.inHours;
    final mins = remaining.inMinutes.remainder(60);
    if (hours > 0) return 'Accept within ${hours}h ${mins}m';
    return 'Accept within ${mins}m';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final deadlineLabel = _deadlineLabel();

    return AppCard(
      onTap: onTap,
      accentColor: _accent(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.orderPublicId,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              ),
              StatusBadge(
                label: job.orderStatus.displayName,
                variant: _statusVariant(job.orderStatus),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${job.category} · qty ${job.quantity}',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          if (job.finalPriceMinor != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Committed: ${formatMinorAsCurrency(job.finalPriceMinor)}',
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (deadlineLabel != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedClock01,
                  size: 14,
                  color: colors.warning,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    deadlineLabel,
                    style: AppTypography.caption.copyWith(
                      color: colors.warning,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (job.isWaitingPayment) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              SupplierPaymentGateCopy.needsPaymentAuthorized,
              style: AppTypography.caption.copyWith(
                color: colors.info,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (job.createdAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Assigned ${formatDateTime(job.createdAt!)}',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
