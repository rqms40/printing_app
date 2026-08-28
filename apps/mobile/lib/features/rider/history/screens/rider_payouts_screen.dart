import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/history/providers/rider_payouts_provider.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';

class RiderPayoutsScreen extends ConsumerWidget {
  const RiderPayoutsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final state = ref.watch(riderPayoutsProvider);
    final profile = ref.watch(riderProfileProvider);
    final qrUrl = state.payoutQrUrl ?? profile.payoutQrUrl;

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
            onPressed: () {
              ref.read(riderPayoutsProvider.notifier).refresh();
              ref.read(riderProfileProvider.notifier).refresh();
            },
            icon: Icon(Icons.refresh, color: colors.onBackground),
          ),
        ],
      ),
      body: SafeArea(
        child: state.isLoading && state.items.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : state.errorMessage != null && state.items.isEmpty
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
                                .read(riderPayoutsProvider.notifier)
                                .refresh(),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () async {
                      await Future.wait([
                        ref.read(riderPayoutsProvider.notifier).refresh(),
                        ref.read(riderProfileProvider.notifier).refresh(),
                      ]);
                    },
                    child: ListView(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      children: [
                        _PayoutQrCard(colors: colors, qrUrl: qrUrl),
                        const SizedBox(height: AppSpacing.lg),
                        if (state.items.isEmpty)
                          const EmptyState(
                            heading: 'No completed deliveries yet',
                            body:
                                'After you finish a delivery, ops pays this QR and '
                                'the receipt appears here.',
                            icon: HugeIcons.strokeRoundedWallet01,
                          )
                        else
                          for (var i = 0; i < state.items.length; i++) ...[
                            if (i > 0) const SizedBox(height: AppSpacing.md),
                            _PayoutCard(
                              item: state.items[i],
                              colors: colors,
                            ),
                          ],
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _PayoutQrCard extends ConsumerWidget {
  const _PayoutQrCard({required this.colors, required this.qrUrl});

  final AppColorSet colors;
  final String? qrUrl;

  Future<void> _pickQr(BuildContext context, WidgetRef ref) async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
      maxWidth: 1600,
    );
    if (picked == null) return;
    final ok =
        await ref.read(riderProfileProvider.notifier).uploadAndSetPayoutQr(
              picked,
            );
    if (!context.mounted) return;
    await ref.read(riderPayoutsProvider.notifier).refresh();
    if (!context.mounted) return;
    final profile = ref.read(riderProfileProvider);
    final msg = ok
        ? (profile.successMessage ?? 'Payout QR updated')
        : (profile.errorMessage ?? 'Could not upload payout QR');
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(riderProfileProvider);
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
          Text(
            'Payout QR',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Ops/super scans this QR to pay your completed delivery fees.',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          if (qrUrl != null && qrUrl!.isNotEmpty) ...[
            ClipRRect(
              borderRadius: AppRadius.borderMd,
              child: Image.network(
                qrUrl!,
                height: 180,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) => Text(
                  'QR image unavailable',
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: () async {
                final uri = Uri.tryParse(qrUrl!);
                if (uri == null) return;
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              },
              icon: const Icon(Icons.download_outlined, size: 18),
              label: const Text('Download QR'),
            ),
          ] else
            Text(
              'No payout QR uploaded yet.',
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.icon(
            onPressed:
                profile.isUploadingPayoutQr ? null : () => _pickQr(context, ref),
            icon: profile.isUploadingPayoutQr
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.qr_code_2, size: 18),
            label: Text(qrUrl == null ? 'Upload QR' : 'Replace QR'),
          ),
        ],
      ),
    );
  }
}

class _PayoutCard extends StatelessWidget {
  const _PayoutCard({required this.item, required this.colors});

  final RiderPayoutItem item;
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
                  item.orderRef,
                  style: AppTypography.bodyBold
                      .copyWith(color: colors.onBackground),
                ),
              ),
              StatusBadge(
                label: item.isPaid ? 'Paid' : 'Unpaid',
                variant: item.isPaid
                    ? StatusBadgeVariant.success
                    : StatusBadgeVariant.warning,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            formatCurrency(item.amountPesos),
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          if (item.paidAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Paid ${_fmt(item.paidAt!)}',
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
          if (item.adminReceiptUrl != null &&
              item.adminReceiptUrl!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Admin payment receipt',
              style:
                  AppTypography.caption.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.xs),
            GestureDetector(
              onTap: () async {
                final uri = Uri.tryParse(item.adminReceiptUrl!);
                if (uri == null) return;
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              },
              child: ClipRRect(
                borderRadius: AppRadius.borderMd,
                child: Image.network(
                  item.adminReceiptUrl!,
                  height: 140,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Text(
                    'Open receipt',
                    style: AppTypography.caption.copyWith(color: colors.accent),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _fmt(DateTime d) {
    final local = d.toLocal();
    final mm = local.month.toString().padLeft(2, '0');
    final dd = local.day.toString().padLeft(2, '0');
    final hh = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    return '$mm/$dd $hh:$min';
  }
}
