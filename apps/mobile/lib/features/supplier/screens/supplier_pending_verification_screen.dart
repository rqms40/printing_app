import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/supplier/providers/supplier_access_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';

/// Shown when a supplier role user is not yet verified by Super Admin.
class SupplierPendingVerificationScreen extends ConsumerWidget {
  const SupplierPendingVerificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final access = ref.watch(supplierAccessProvider);
    final statusLabel = access.verificationStatus.replaceAll('_', ' ');

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Supplier verification',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/auth/login');
            },
            child: Text(
              'Log out',
              style: AppTypography.body.copyWith(color: colors.onSurface),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: access.isLoading
              ? const Center(child: CircularProgressIndicator())
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          HugeIcon(
                            icon: HugeIcons.strokeRoundedSecurityCheck,
                            size: 40,
                            color: colors.warning,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            'Access locked until verified',
                            style: AppTypography.h2.copyWith(
                              color: colors.onSurface,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Status: $statusLabel',
                            style: AppTypography.body.copyWith(
                              color: colors.warning,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            access.message ??
                                'Your supplier account is pending Super Admin '
                                    'verification. You cannot open jobs, accept '
                                    'orders, or view payouts until status is verified.',
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    AppButton(
                      label: 'Refresh status',
                      isFullWidth: true,
                      onTap: () =>
                          ref.read(supplierAccessProvider.notifier).refresh(),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: 'Log out',
                      variant: AppButtonVariant.ghost,
                      isFullWidth: true,
                      onTap: () async {
                        await ref.read(authProvider.notifier).logout();
                        if (context.mounted) context.go('/auth/login');
                      },
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
