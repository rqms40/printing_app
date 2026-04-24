import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';
import 'package:printing_app/features/customer/profile/providers/storage_settings_provider.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';

class StorageSettingsScreen extends ConsumerWidget {
  const StorageSettingsScreen({super.key});

  static const routeName = '/customer/profile/storage-settings';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final settingsAsync = ref.watch(storageSettingsProvider);

    ref.listen<AsyncValue<StorageSettings>>(storageSettingsProvider, (prev, next) {
      if (next.hasError && (prev == null || !prev.hasError)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save — please try again')),
        );
      }
    });

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(context, colors),
            Expanded(
              child: settingsAsync.when(
                loading: () => Center(
                  child: CircularProgressIndicator(color: colors.accent),
                ),
                error: (_, _) => Center(
                  child: TextButton.icon(
                    onPressed: () =>
                        ref.read(storageSettingsProvider.notifier).fetch(),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                  ),
                ),
                data: (settings) =>
                    _buildBody(context, ref, colors, settings),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: AppRadius.borderSm,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedArrowLeft01,
                  size: 20,
                  color: colors.onSurface,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Storage & Files',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AppColorSet colors,
    StorageSettings settings,
  ) {
    final isEnabled = settings.fileRetentionDays != null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.outline, width: 0.75),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Toggle row
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.lg, AppSpacing.md, AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Auto-delete files after order completion',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurface,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Files in your Data Grid will be automatically deleted after the period you choose.',
                          style: AppTypography.caption
                              .copyWith(color: colors.onSurfaceDim),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Switch(
                    value: isEnabled,
                    activeThumbColor: colors.accent,
                    onChanged: (value) =>
                        _onToggle(context, ref, value),
                  ),
                ],
              ),
            ),

            // Period picker (visible only when enabled)
            if (isEnabled) ...[
              Divider(color: colors.outline, height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                child: Row(
                  children: [
                    Text(
                      'Delete after',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurface),
                    ),
                    const Spacer(),
                    _PeriodDropdown(
                      value: settings.fileRetentionDays!,
                      colors: colors,
                      onChanged: (days) => ref.read(storageSettingsProvider.notifier).update(days),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _onToggle(
    BuildContext context,
    WidgetRef ref,
    bool enable,
  ) {
    final notifier = ref.read(storageSettingsProvider.notifier);
    if (!enable) {
      notifier.update(null);
      return;
    }
    ConfirmationDialog.show(
      context,
      title: 'Enable Auto-Delete',
      message:
          'Your files from completed orders will be automatically deleted after the chosen period. You can turn this off any time.',
      confirmLabel: 'Enable',
      cancelLabel: 'Cancel',
      onConfirm: () {
        Navigator.of(context).pop();
        notifier.update(30);
      },
    );
  }
}

class _PeriodDropdown extends StatelessWidget {
  const _PeriodDropdown({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  static const _options = [
    (1, '24 hours'),
    (7, '7 days'),
    (30, '30 days'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderSm,
        border: Border.all(color: colors.outline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isDense: true,
          style: AppTypography.body.copyWith(
            color: colors.onSurface,
            fontWeight: FontWeight.w600,
          ),
          dropdownColor: colors.surface,
          items: _options
              .map(
                (opt) => DropdownMenuItem<int>(
                  value: opt.$1,
                  child: Text(opt.$2),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}
