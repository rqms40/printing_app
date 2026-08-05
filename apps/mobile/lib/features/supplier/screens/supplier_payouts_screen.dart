import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/providers/supplier_payouts_provider.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Supplier payout notices — held during issue window, frozen on timely claims.
class SupplierPayoutsScreen extends ConsumerWidget {
  const SupplierPayoutsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final state = ref.watch(supplierPayoutsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Payouts',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        actions: [
          IconButton(
            onPressed: () =>
                ref.read(supplierPayoutsProvider.notifier).refresh(),
            icon: Icon(Icons.refresh, color: colors.onBackground),
          ),
        ],
      ),
      body: SafeArea(
        child: state.isLoading && state.payouts.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : state.errorMessage != null && state.payouts.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Could not load payouts',
                            style: AppTypography.h3
                                .copyWith(color: colors.onBackground),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            state.errorMessage!,
                            textAlign: TextAlign.center,
                            style: AppTypography.body
                                .copyWith(color: colors.onSurfaceDim),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          FilledButton(
                            onPressed: () => ref
                                .read(supplierPayoutsProvider.notifier)
                                .refresh(),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : state.payouts.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(AppSpacing.xl),
                        child: EmptyState(
                          heading: 'No payouts yet',
                          body:
                              'When a job is delivered, a held payout appears here '
                              'for 24 hours (issue window). Timely claims freeze settlement.',
                          icon: HugeIcons.strokeRoundedWallet01,
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () =>
                            ref.read(supplierPayoutsProvider.notifier).refresh(),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          itemCount: state.payouts.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: AppSpacing.md),
                          itemBuilder: (context, index) {
                            final p = state.payouts[index];
                            return _PayoutCard(payout: p, colors: colors);
                          },
                        ),
                      ),
      ),
    );
  }
}

class _PayoutCard extends StatelessWidget {
  const _PayoutCard({required this.payout, required this.colors});

  final SupplierPayout payout;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  payout.orderRef,
                  style: AppTypography.bodyBold
                      .copyWith(color: colors.onBackground),
                ),
              ),
              StatusBadge(
                label: payout.settlementState,
                variant: _variantFor(payout.settlementState),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '₱${payout.netPesos.toStringAsFixed(2)} net',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (payout.holdReason != null) ...[
            Text(
              'Hold: ${payout.holdReason}',
              style: AppTypography.caption.copyWith(color: colors.warning),
            ),
            if (payout.holdExpiresAt != null)
              Text(
                'Window ends ${_fmt(payout.holdExpiresAt!)}',
                style: AppTypography.caption
                    .copyWith(color: colors.onSurfaceDim),
              ),
          ] else
            Text(
              'No active hold',
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
        ],
      ),
    );
  }

  StatusBadgeVariant _variantFor(String state) {
    switch (state) {
      case 'held':
        return StatusBadgeVariant.warning;
      case 'released':
      case 'settled':
        return StatusBadgeVariant.success;
      case 'cancelled':
        return StatusBadgeVariant.error;
      default:
        return StatusBadgeVariant.info;
    }
  }

  String _fmt(DateTime d) {
    final local = d.toLocal();
    final mm = local.month.toString().padLeft(2, '0');
    final dd = local.day.toString().padLeft(2, '0');
    final hh = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    return '$mm/$dd ${hh}:$min';
  }
}
