import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Payout notices stub — full payout UI lands in a later phase.
class SupplierPayoutsScreen extends StatelessWidget {
  const SupplierPayoutsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Payouts',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.xl),
          child: EmptyState(
            heading: 'Payouts coming soon',
            body:
                'When a job is delivered and payment settles, payout notices '
                'will show here. Production milestones still work without this screen.',
            icon: HugeIcons.strokeRoundedWallet01,
          ),
        ),
      ),
    );
  }
}
