import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/features/customer/order/sheets/assign_drop_sheet.dart';
import 'package:uuid/uuid.dart';

class MultidropGroups extends ConsumerWidget {
  const MultidropGroups({super.key});

  /// Returns a list of (item, copyIndex) refs assigned to [dropId].
  List<_UnitRef> _unitsForDrop(
    String dropId,
    List<CartItem> items,
    Map<String, List<String?>> assignments,
  ) {
    final result = <_UnitRef>[];
    for (final item in items) {
      final list = assignments[item.id] ?? const <String?>[];
      for (var i = 0; i < list.length; i++) {
        if (list[i] == dropId) result.add(_UnitRef(item: item, copyIndex: i));
      }
    }
    return result;
  }

  /// Returns refs whose dropId is null (unassigned because their old drop was deleted
  /// and there's no fallback). Should only ever appear if drops list is empty.
  List<_UnitRef> _unassigned(
    List<CartItem> items,
    Map<String, List<String?>> assignments,
  ) {
    final result = <_UnitRef>[];
    for (final item in items) {
      final list = assignments[item.id] ?? const <String?>[];
      for (var i = 0; i < list.length; i++) {
        if (list[i] == null) result.add(_UnitRef(item: item, copyIndex: i));
      }
    }
    return result;
  }

  Future<void> _handleAssignTap({
    required BuildContext context,
    required WidgetRef ref,
    required _UnitRef unit,
    required String? currentDropId,
  }) async {
    final state = ref.read(checkoutProvider);
    final notifier = ref.read(checkoutProvider.notifier);

    final result = await AssignDropSheet.show(
      context,
      drops: state.drops,
      itemFileName: unit.item.fileName,
      copyIndex: unit.copyIndex,
      totalCopies: unit.item.quantity,
      currentDropId: currentDropId,
    );
    if (result == null) return;

    if (result == AssignDropSheet.newDropSentinel) {
      final newDrop = DestinationGroup(
        id: const Uuid().v4(),
        label: 'Drop ${state.drops.length + 1}',
        itemIds: const [],
      );
      notifier.setDrops([...state.drops, newDrop]);
      notifier.assignUnit(unit.item.id, unit.copyIndex, newDrop.id);
    } else {
      notifier.assignUnit(unit.item.id, unit.copyIndex, result);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final unassigned = _unassigned(state.items, state.unitAssignments);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Hint banner ─────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: colors.brand.withValues(alpha: 0.10),
            borderRadius: AppRadius.borderMd,
          ),
          child: Row(
            children: [
              HugeIcon(
                icon: HugeIcons.strokeRoundedInformationCircle,
                size: 16,
                color: colors.brand,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Tap a copy to send it to another drop.',
                  style: AppTypography.caption.copyWith(
                    color: colors.onBackground,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── Unassigned tray (rare) ──────────────────────────────────────
        if (unassigned.isNotEmpty) ...[
          _DropCard(
            title: 'Unassigned',
            subtitle: 'Tap each to send to a drop',
            colors: colors,
            isWarning: true,
            trailing: const SizedBox.shrink(),
            children: [
              for (final u in unassigned)
                _UnitChip(
                  unit: u,
                  colors: colors,
                  onTap: () => _handleAssignTap(
                    context: context,
                    ref: ref,
                    unit: u,
                    currentDropId: null,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        // ── Drop cards ─────────────────────────────────────────────────
        for (var di = 0; di < state.drops.length; di++) ...[
          if (di > 0) const SizedBox(height: AppSpacing.md),
          Builder(
            builder: (_) {
              final drop = state.drops[di];
              final units = _unitsForDrop(
                drop.id,
                state.items,
                state.unitAssignments,
              );
              return _DropCard(
                title: drop.label,
                subtitle: drop.addressId == null
                    ? 'No address yet'
                    : 'Address chosen',
                colors: colors,
                trailing: state.drops.length > 1
                    ? GestureDetector(
                        onTap: () => ref
                            .read(checkoutProvider.notifier)
                            .setDrops(state.drops
                                .where((d) => d.id != drop.id)
                                .toList()),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 4,
                          ),
                          child: HugeIcon(
                            icon: HugeIcons.strokeRoundedDelete02,
                            size: 16,
                            color: colors.error,
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
                onPickAddress: () async {
                  final addr = await AddressPickerSheet.show(context);
                  if (addr == null) return;
                  ref.read(checkoutProvider.notifier).setDrops([
                    for (final d in state.drops)
                      if (d.id == drop.id)
                        d.copyWith(
                          addressId: int.tryParse(addr.id) ?? 0,
                          label: addr.label,
                        )
                      else
                        d,
                  ]);
                },
                children: [
                  if (units.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        'No copies sent here yet',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontSize: 12,
                        ),
                      ),
                    )
                  else
                    for (final u in units)
                      _UnitChip(
                        unit: u,
                        colors: colors,
                        onTap: () => _handleAssignTap(
                          context: context,
                          ref: ref,
                          unit: u,
                          currentDropId: drop.id,
                        ),
                      ),
                ],
              );
            },
          ),
        ],

        const SizedBox(height: AppSpacing.md),

        // ── Add another drop ────────────────────────────────────────────
        InkWell(
          borderRadius: AppRadius.borderLg,
          onTap: () {
            ref.read(checkoutProvider.notifier).setDrops([
              ...state.drops,
              DestinationGroup(
                id: const Uuid().v4(),
                label: 'Drop ${state.drops.length + 1}',
                itemIds: const [],
              ),
            ]);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: 12,
            ),
            decoration: BoxDecoration(
              borderRadius: AppRadius.borderLg,
              border: Border.all(
                color: colors.brand.withValues(alpha: 0.4),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedAdd01,
                  size: 16,
                  color: colors.brand,
                ),
                const SizedBox(width: 6),
                Text(
                  'Add another drop',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.brand,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _UnitRef {
  const _UnitRef({required this.item, required this.copyIndex});
  final CartItem item;
  final int copyIndex;
}

class _DropCard extends StatelessWidget {
  const _DropCard({
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.children,
    required this.trailing,
    this.onPickAddress,
    this.isWarning = false,
  });

  final String title;
  final String subtitle;
  final AppColorSet colors;
  final List<Widget> children;
  final Widget trailing;
  final VoidCallback? onPickAddress;
  final bool isWarning;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: isWarning
              ? colors.error.withValues(alpha: 0.5)
              : colors.outline.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HugeIcon(
                icon: isWarning
                    ? HugeIcons.strokeRoundedAlert02
                    : HugeIcons.strokeRoundedLocation01,
                size: 16,
                color: isWarning ? colors.error : colors.brand,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 14,
                  ),
                ),
              ),
              trailing,
            ],
          ),
          const SizedBox(height: 4),
          if (onPickAddress != null)
            GestureDetector(
              onTap: onPickAddress,
              child: Text(
                subtitle == 'Address chosen' ? 'Change address' : 'Pick address',
                style: AppTypography.caption.copyWith(
                  color: colors.brand,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            )
          else
            Text(
              subtitle,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 12,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: children,
          ),
        ],
      ),
    );
  }
}

class _UnitChip extends StatelessWidget {
  const _UnitChip({
    required this.unit,
    required this.colors,
    required this.onTap,
  });

  final _UnitRef unit;
  final AppColorSet colors;
  final VoidCallback onTap;

  String _shortName(String name) {
    if (name.length <= 14) return name;
    final dot = name.lastIndexOf('.');
    if (dot <= 0 || dot >= name.length - 1) return '${name.substring(0, 11)}…';
    final ext = name.substring(dot);
    final stem = name.substring(0, name.length - ext.length);
    if (stem.length <= 10) return name;
    return '${stem.substring(0, 9)}…$ext';
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: colors.outline.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              HugeIcon(
                icon: unit.item.category == '3d'
                    ? HugeIcons.strokeRoundedCube
                    : HugeIcons.strokeRoundedFile02,
                size: 12,
                color: colors.onSurfaceDim,
              ),
              const SizedBox(width: 5),
              Text(
                _shortName(unit.item.fileName),
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (unit.item.quantity > 1) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: colors.brand.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${unit.copyIndex + 1}/${unit.item.quantity}',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
              const SizedBox(width: 4),
              HugeIcon(
                icon: HugeIcons.strokeRoundedExchange01,
                size: 12,
                color: colors.onSurfaceDim,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
