import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/supplier/models/supplier_service_focus.dart';
import 'package:printing_app/features/supplier/providers/supplier_profile_provider.dart';
import 'package:printing_app/shared/app_version.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Supplier profile — shop identity, attributes, edit entry, payouts, sign out.
class SupplierProfileScreen extends ConsumerWidget {
  const SupplierProfileScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final user = ref.watch(authProvider).user;
    final profileState = ref.watch(supplierProfileProvider);
    final profile = profileState.profile;

    final businessName =
        profile?.businessName.trim().isNotEmpty == true
            ? profile!.businessName
            : (user?.fullName ?? 'Supplier');
    final email = profile?.contactEmail?.trim().isNotEmpty == true
        ? profile!.contactEmail!
        : (user?.email ?? '—');
    final initial =
        businessName.isNotEmpty ? businessName[0].toUpperCase() : 'S';
    final logoUrl = profile?.logoUrl;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: () =>
              ref.read(supplierProfileProvider.notifier).refresh(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.xl,
                    AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Profile',
                          style: AppTypography.h1.copyWith(
                            color: colors.onBackground,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Edit profile',
                        onPressed: () =>
                            context.push('/supplier/profile/edit'),
                        icon: HugeIcon(
                          icon: HugeIcons.strokeRoundedEdit02,
                          color: colors.accent,
                          size: 22,
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 350.ms)
                    .slideY(begin: 0.02, duration: 350.ms),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Center(
                    child: Column(
                      children: [
                        Container(
                          width: 88,
                          height: 88,
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            shape: BoxShape.circle,
                            border: Border.all(color: colors.outline),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: logoUrl != null && logoUrl.isNotEmpty
                              ? Image.network(
                                  logoUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) =>
                                      Center(
                                    child: Text(
                                      initial,
                                      style: AppTypography.h1.copyWith(
                                        color: colors.accent,
                                      ),
                                    ),
                                  ),
                                )
                              : Center(
                                  child: Text(
                                    initial,
                                    style: AppTypography.h1.copyWith(
                                      color: colors.accent,
                                    ),
                                  ),
                                ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          businessName,
                          style: AppTypography.h2.copyWith(
                            color: colors.onBackground,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          email,
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        if (profile?.contactPhone?.trim().isNotEmpty ==
                            true) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            profile!.contactPhone!,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.sm),
                        const StatusBadge(
                          label: 'Supplier',
                          variant: StatusBadgeVariant.info,
                        ),
                        if (profile?.description?.trim().isNotEmpty ==
                            true) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            profile!.description!,
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ],
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(duration: 400.ms)
                    .slideY(begin: 0.03, duration: 400.ms),

                const SizedBox(height: AppSpacing.xl),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: AppCard(
                    onTap: () => context.push('/supplier/service-focus'),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderMd,
                          ),
                          child: Center(
                            child: Icon(
                              Icons.format_list_numbered_rounded,
                              color: colors.accent,
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Service focus ranking',
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                profile != null &&
                                        profile.serviceFocusRanks.isNotEmpty
                                    ? profile.serviceFocusRanks
                                        .asMap()
                                        .entries
                                        .map((e) {
                                          final rank = e.key + 1;
                                          final label =
                                              SupplierServiceFocusCatalog
                                                  .labelFor(e.value);
                                          return '$rank. $label';
                                        })
                                        .take(3)
                                        .join(' · ')
                                    : 'Rank Signages, Tarpaulins, Apparel…',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedArrowRight01,
                          color: colors.onSurfaceDim,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.md),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: AppCard(
                    onTap: () => context.push('/supplier/profile/edit'),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderMd,
                          ),
                          child: Center(
                            child: HugeIcon(
                              icon: HugeIcons.strokeRoundedEdit02,
                              color: colors.accent,
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Edit shop profile',
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Picture, details, attributes & capabilities',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                            ],
                          ),
                        ),
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedArrowRight01,
                          color: colors.onSurfaceDim,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),

                if (profile != null && profile.attributes.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                    child: Text(
                      'ATTRIBUTES',
                      style: AppTypography.overline.copyWith(
                        color: colors.onSurfaceDim,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                    child: Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: profile.attributes.entries.map((e) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm,
                          ),
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderFull,
                          ),
                          child: Text(
                            e.value.isEmpty
                                ? e.key
                                : '${e.key}: ${e.value}',
                            style: AppTypography.caption.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],

                if (profile != null && profile.capabilities.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                    child: Text(
                      'CAPABILITIES',
                      style: AppTypography.overline.copyWith(
                        color: colors.onSurfaceDim,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                    child: Column(
                      children: profile.capabilities.map((cap) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: AppCard(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        cap.productFamily,
                                        style: AppTypography.bodyBold.copyWith(
                                          color: colors.onBackground,
                                        ),
                                      ),
                                      if (cap.materials.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          cap.materials.join(', '),
                                          style:
                                              AppTypography.caption.copyWith(
                                            color: colors.onSurfaceDim,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],

                if (profile?.address?.trim().isNotEmpty == true ||
                    (profile?.serviceZones.isNotEmpty ?? false)) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                    child: Text(
                      'LOCATION',
                      style: AppTypography.overline.copyWith(
                        color: colors.onSurfaceDim,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (profile?.address?.trim().isNotEmpty == true)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl,
                      ),
                      child: Text(
                        profile!.address!,
                        style: AppTypography.body.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                    ),
                  if (profile?.serviceZones.isNotEmpty ?? false)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.xs,
                        AppSpacing.xl,
                        0,
                      ),
                      child: Text(
                        'Zones: ${profile!.serviceZones.join(', ')}',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                    ),
                ],

                const SizedBox(height: AppSpacing.lg),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: AppCard(
                    onTap: () => context.push('/supplier/payouts'),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderMd,
                          ),
                          child: Center(
                            child: HugeIcon(
                              icon: HugeIcons.strokeRoundedWallet01,
                              color: colors.accent,
                              size: 20,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Payouts',
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Held after delivery · freeze on timely claims',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                            ],
                          ),
                        ),
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedArrowRight01,
                          color: colors.onSurfaceDim,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.lg),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Text(
                    'APP',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Row(
                    children: [
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedInformationCircle,
                        color: colors.onSurfaceDim,
                        size: 18,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          'GRIDGO Supplier',
                          style: AppTypography.body.copyWith(
                            color: colors.onBackground,
                          ),
                        ),
                      ),
                      Text(
                        AppVersion.display,
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppSpacing.xl),

                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: HugeIcon(
                      icon: HugeIcons.strokeRoundedLogout01,
                      color: colors.error,
                      size: 22,
                    ),
                    title: Text(
                      'Sign Out',
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.error,
                      ),
                    ),
                    onTap: () {
                      ConfirmationDialog.show(
                        context,
                        title: 'Sign Out',
                        message: 'Are you sure you want to sign out?',
                        confirmLabel: 'Sign Out',
                        cancelLabel: 'Cancel',
                        onConfirm: () {
                          ref.read(authProvider.notifier).logout();
                          Navigator.of(context).pop();
                        },
                        onCancel: () => Navigator.of(context).pop(),
                      );
                    },
                  ),
                ),

                if (profileState.errorMessage != null && profile == null)
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Text(
                      profileState.errorMessage!,
                      style: AppTypography.caption.copyWith(
                        color: colors.error,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),

                const SizedBox(height: AppSpacing.xxl),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
