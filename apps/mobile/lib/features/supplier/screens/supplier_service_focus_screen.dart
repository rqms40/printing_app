import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/models/supplier_service_focus.dart';
import 'package:printing_app/features/supplier/providers/supplier_access_provider.dart';
import 'package:printing_app/features/supplier/providers/supplier_profile_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Rank service focuses (1st / 2nd / 3rd …) for supplier onboarding + settings.
class SupplierServiceFocusScreen extends ConsumerStatefulWidget {
  const SupplierServiceFocusScreen({
    super.key,
    this.requiredSetup = false,
    this.initialRanks = const [],
  });

  /// When true, user cannot leave without saving at least one focus.
  final bool requiredSetup;

  final List<String> initialRanks;

  @override
  ConsumerState<SupplierServiceFocusScreen> createState() =>
      _SupplierServiceFocusScreenState();
}

class _SupplierServiceFocusScreenState
    extends ConsumerState<SupplierServiceFocusScreen> {
  late List<String> _rankedKeys;
  bool _seeded = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _rankedKeys = List<String>.from(widget.initialRanks);
  }

  void _seedFromProfile() {
    if (_seeded) return;
    final profile = ref.read(supplierProfileProvider).profile;
    final access = ref.read(supplierAccessProvider);
    final fromProfile = profile?.serviceFocusRanks ?? const <String>[];
    final fromAccess = access.serviceFocusRanks;
    final seed = fromProfile.isNotEmpty
        ? fromProfile
        : (fromAccess.isNotEmpty ? fromAccess : widget.initialRanks);
    if (seed.isNotEmpty && _rankedKeys.isEmpty) {
      _rankedKeys = List<String>.from(seed);
    }
    _seeded = true;
    // After onboarding, skip ranking if already configured.
    if (widget.requiredSetup &&
        seed.isNotEmpty &&
        !access.needsServiceFocusSetup) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (access.canAccess) {
          context.go('/supplier/jobs');
        } else {
          context.go('/supplier/pending');
        }
      });
    }
  }

  void _toggleKey(String key) {
    setState(() {
      if (_rankedKeys.contains(key)) {
        _rankedKeys.remove(key);
      } else {
        _rankedKeys.add(key);
      }
    });
  }

  Future<void> _save() async {
    if (_rankedKeys.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select at least one service focus to continue'),
        ),
      );
      return;
    }

    final ok = await ref
        .read(supplierProfileProvider.notifier)
        .updateServiceFocusRanks(_rankedKeys);
    if (!mounted) return;

    final msg = ref.read(supplierProfileProvider).successMessage ??
        ref.read(supplierProfileProvider).errorMessage;
    if (msg != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
    if (!ok) return;

    await ref.read(supplierAccessProvider.notifier).refresh();
    if (!mounted) return;

    if (widget.requiredSetup || !Navigator.of(context).canPop()) {
      final access = ref.read(supplierAccessProvider);
      if (access.canAccess) {
        context.go('/supplier/jobs');
      } else {
        context.go('/supplier/pending');
      }
    } else {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final saving = ref.watch(supplierProfileProvider).isSaving;
    _seedFromProfile();

    final selected = {
      for (final k in _rankedKeys) k,
    };

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          widget.requiredSetup ? 'Your services' : 'Service focus',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
        automaticallyImplyLeading: !widget.requiredSetup,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.md,
                AppSpacing.xl,
                AppSpacing.xxl,
              ),
              children: [
                Text(
                  'What does your shop focus on?',
                  style: AppTypography.h2.copyWith(color: colors.onBackground),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Tap services to add them, then drag to rank priority '
                  '(1st = main focus). You can change this anytime in Profile.',
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  'AVAILABLE SERVICES',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final focus in SupplierServiceFocusCatalog.all)
                      FilterChip(
                        selected: selected.contains(focus.key),
                        label: Text(focus.label),
                        onSelected: (_) => _toggleKey(focus.key),
                        selectedColor: colors.accent.withValues(alpha: 0.2),
                        checkmarkColor: colors.accent,
                        labelStyle: AppTypography.caption.copyWith(
                          color: selected.contains(focus.key)
                              ? colors.accent
                              : colors.onBackground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  'YOUR RANKING',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                if (_rankedKeys.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: AppRadius.borderMd,
                    ),
                    child: Text(
                      'No services selected yet. Tap chips above to add them.',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  )
                else
                  ReorderableListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _rankedKeys.length,
                    onReorder: (oldIndex, newIndex) {
                      setState(() {
                        if (newIndex > oldIndex) newIndex -= 1;
                        final item = _rankedKeys.removeAt(oldIndex);
                        _rankedKeys.insert(newIndex, item);
                      });
                    },
                    itemBuilder: (context, index) {
                      final key = _rankedKeys[index];
                      final focus = SupplierServiceFocusCatalog.byKey(key);
                      final rank = index + 1;
                      final rankLabel = switch (rank) {
                        1 => '1st',
                        2 => '2nd',
                        3 => '3rd',
                        _ => '${rank}th',
                      };
                      return Material(
                        key: ValueKey(key),
                        color: colors.surface,
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: colors.accent.withValues(
                              alpha: 0.15,
                            ),
                            child: Text(
                              rankLabel,
                              style: AppTypography.caption.copyWith(
                                color: colors.accent,
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                              ),
                            ),
                          ),
                          title: Text(
                            focus?.label ?? key,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                          subtitle: Text(
                            focus?.description ?? '',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'Remove',
                                onPressed: () => _toggleKey(key),
                                icon: HugeIcon(
                                  icon: HugeIcons.strokeRoundedDelete02,
                                  color: colors.error,
                                  size: 18,
                                ),
                              ),
                              ReorderableDragStartListener(
                                index: index,
                                child: Icon(
                                  Icons.drag_handle_rounded,
                                  color: colors.onSurfaceDim,
                                  size: 22,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.sm,
                AppSpacing.xl,
                AppSpacing.md,
              ),
              child: AppButton(
                label: widget.requiredSetup
                    ? 'Save & continue'
                    : 'Save service focus',
                isFullWidth: true,
                isLoading: saving,
                onTap: saving ? null : _save,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
