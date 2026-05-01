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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Delete after',
                      style: AppTypography.body.copyWith(color: colors.onSurface),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _PresetChips(
                      value: settings.fileRetentionDays!,
                      colors: colors,
                      onChanged: (days) =>
                          ref.read(storageSettingsProvider.notifier).update(days),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _CustomDurationInput(
                      value: settings.fileRetentionDays!,
                      colors: colors,
                      onChanged: (days) =>
                          ref.read(storageSettingsProvider.notifier).update(days),
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

enum _Unit { days, weeks }

// ─── Preset chips ────────────────────────────────────────────────────────────

class _PresetChips extends StatelessWidget {
  const _PresetChips({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  static const _presets = [(1, '1 day'), (7, '7 days'), (30, '30 days')];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: _presets.map((p) {
        final selected = value == p.$1;
        return ChoiceChip(
          label: Text(p.$2),
          selected: selected,
          selectedColor: colors.accent.withValues(alpha: 0.15),
          labelStyle: AppTypography.caption.copyWith(
            color: selected ? colors.accent : colors.onSurfaceDim,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
          side: BorderSide(color: selected ? colors.accent : colors.outline),
          backgroundColor: Colors.transparent,
          onSelected: (_) => onChanged(p.$1),
        );
      }).toList(),
    );
  }
}

// ─── Custom duration input ────────────────────────────────────────────────────

class _CustomDurationInput extends StatefulWidget {
  const _CustomDurationInput({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final int value;
  final AppColorSet colors;
  final ValueChanged<int> onChanged;

  @override
  State<_CustomDurationInput> createState() => _CustomDurationInputState();
}

class _CustomDurationInputState extends State<_CustomDurationInput> {
  late final TextEditingController _ctrl;
  _Unit _unit = _Unit.days;
  String? _error;

  static const _presets = {1, 7, 30};

  @override
  void initState() {
    super.initState();
    final isPreset = _presets.contains(widget.value);
    _ctrl = TextEditingController(text: isPreset ? '' : '${widget.value}');
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_CustomDurationInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      final isPreset = _presets.contains(widget.value);
      _ctrl.text = isPreset ? '' : '${widget.value}';
      _error = null;
      _unit = _Unit.days;
    }
  }

  void _submit() {
    final raw = int.tryParse(_ctrl.text.trim());
    if (raw == null || raw < 1) {
      setState(() => _error = 'Enter a number from 1 to 999');
      return;
    }
    final days = _unit == _Unit.weeks ? raw * 7 : raw;
    if (days > 999) {
      setState(() => _error = 'Maximum is 999 days (142 weeks)');
      return;
    }
    setState(() => _error = null);
    widget.onChanged(days);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            SizedBox(
              width: 80,
              child: TextField(
                controller: _ctrl,
                keyboardType: TextInputType.number,
                maxLength: 3,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'e.g. 45',
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  border: OutlineInputBorder(
                      borderRadius: AppRadius.borderSm),
                ),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(width: 8),
            _UnitToggle(
              value: _unit,
              colors: widget.colors,
              onChanged: (u) => setState(() => _unit = u),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: _submit,
              icon: Icon(Icons.check_rounded, color: widget.colors.accent),
              tooltip: 'Save',
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              _error!,
              style: AppTypography.caption
                  .copyWith(color: Colors.red.shade600),
            ),
          ),
      ],
    );
  }
}

// ─── Unit toggle (Days / Weeks) ───────────────────────────────────────────────

class _UnitToggle extends StatelessWidget {
  const _UnitToggle({
    required this.value,
    required this.colors,
    required this.onChanged,
  });

  final _Unit value;
  final AppColorSet colors;
  final ValueChanged<_Unit> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: colors.outline),
        borderRadius: AppRadius.borderSm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _seg('Days', _Unit.days),
          Container(width: 1, height: 28, color: colors.outline),
          _seg('Weeks', _Unit.weeks),
        ],
      ),
    );
  }

  Widget _seg(String label, _Unit unit) {
    final selected = value == unit;
    return GestureDetector(
      onTap: () => onChanged(unit),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? colors.accent.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: unit == _Unit.days
              ? const BorderRadius.horizontal(
                  left: Radius.circular(AppRadius.sm))
              : const BorderRadius.horizontal(
                  right: Radius.circular(AppRadius.sm)),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: selected ? colors.accent : colors.onSurfaceDim,
            fontWeight:
                selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
