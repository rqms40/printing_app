import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/utils/formatters.dart';

/// Shows customer concerns and the admin action taken on each claim.
class OrderClaimsSection extends StatelessWidget {
  const OrderClaimsSection({super.key, required this.claims});

  final List<OrderClaim> claims;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    if (claims.isEmpty) return const SizedBox.shrink();
    final colors = _colors(context);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HugeIcon(
                icon: HugeIcons.strokeRoundedAlert02,
                size: 20,
                color: colors.brand,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Your concerns',
                  style: AppTypography.h3.copyWith(color: colors.onSurface),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Updates from GRIDGO ops appear here when a claim is reviewed.',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          for (var i = 0; i < claims.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            _ClaimTile(claim: claims[i], colors: colors),
          ],
        ],
      ),
    );
  }
}

class _ClaimTile extends StatelessWidget {
  const _ClaimTile({required this.claim, required this.colors});

  final OrderClaim claim;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final resolved = claim.isResolved;
    final accent = resolved
        ? (claim.status == 'rejected' ? colors.error : colors.success)
        : colors.warning;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: accent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  claim.categoryLabel,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onSurface,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.18),
                  borderRadius: AppRadius.borderSm,
                ),
                child: Text(
                  claim.statusLabel,
                  style: AppTypography.caption.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reported ${formatDateTime(claim.openedAt)}',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          if (claim.actionLabel != null && claim.actionLabel!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Admin action',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              claim.actionLabel!,
              style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
            ),
          ],
          if (claim.resolutionNotes != null &&
              claim.resolutionNotes!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Ops notes',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              claim.resolutionNotes!,
              style: AppTypography.body.copyWith(color: colors.onSurface),
            ),
          ],
          if (claim.resolvedAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Updated ${formatDateTime(claim.resolvedAt!)}',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
          if (!resolved) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'GRIDGO ops is reviewing this concern. You will be notified when an action is taken.',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ],
      ),
    );
  }
}
