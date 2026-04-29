import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class ExternalDeliveryConfirmScreen extends ConsumerWidget {
  const ExternalDeliveryConfirmScreen({super.key});

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/order/destinations');
            }
          },
          icon: HugeIcon(
            icon: HugeIcons.strokeRoundedArrowLeft01,
            size: 22,
            color: colors.onBackground,
          ),
        ),
        title: Text(
          'External delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Card(
                  color: colors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.borderMd,
                    side: BorderSide(color: colors.outline),
                  ),
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedDeliveryTruck01,
                          size: 48,
                          color: colors.brand,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'We deliver this address through a partner courier',
                          style: AppTypography.h3
                              .copyWith(color: colors.onBackground),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Estimated fee: TBD — admin will confirm within 30 min',
                          style: AppTypography.body
                              .copyWith(color: colors.onSurface),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderSm,
                          ),
                          child: Text(
                            'Your order will be tagged for manual courier booking by our team.',
                            style: AppTypography.caption
                                .copyWith(color: colors.onSurfaceDim),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            FilledButton(
              onPressed: () => context.push('/customer/order/summary'),
              style: FilledButton.styleFrom(
                backgroundColor: colors.accent,
                foregroundColor: colors.accentOnColor,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.borderMd,
                ),
              ),
              child: const Text('Confirm'),
            ),
          ],
        ),
      ),
    );
  }
}
