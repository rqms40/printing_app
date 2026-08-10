import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/edit_item_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/utils/file_helpers.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutItemsCard extends ConsumerWidget {
  const CheckoutItemsCard({super.key, this.tutorialKey});

  final GlobalKey? tutorialKey;

  void _viewItem(BuildContext context, CartItem item) {
    FilePreviewSheet.show(
      context,
      fileId: item.fileMetadataId,
      fileName: item.fileName,
      mimeType: mimeTypeForExtension(getFileExtension(item.fileName)),
      fileSize: item.fileSize,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final notifier = ref.read(checkoutProvider.notifier);

    return CheckoutSectionCard(
      titleKey: tutorialKey,
      title: 'Order summary',
      trailing: GestureDetector(
        onTap: () => context.push('/customer/order/new?mode=add'),
        child: Text(
          'Add Items',
          style: AppTypography.body.copyWith(
            color: colors.brand,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ),
      child: Column(
        children: [
          for (var i = 0; i < state.items.length; i++) ...[
            if (i > 0)
              Divider(color: colors.outline.withValues(alpha: 0.2), height: 1),
            Dismissible(
              key: ValueKey('cart-${state.items[i].id}'),
              direction: DismissDirection.endToStart,
              background: const SizedBox.shrink(),
              secondaryBackground: _SwipeRemoveBg(colors: colors),
              onDismissed: (_) => notifier.removeItem(state.items[i].id),
              child: _ItemRow(
                item: state.items[i],
                colors: colors,
                onEdit: state.items[i].quoteRequired
                    ? null
                    : () async {
                        final updated = await EditItemSheet.show(
                          context,
                          item: state.items[i],
                        );
                        if (updated != null) notifier.replaceItem(updated);
                      },
                onView: state.items[i].fileMetadataId > 0
                    ? () => _viewItem(context, state.items[i])
                    : null,
                onDecrement: () {
                  final current = state.items[i];
                  if (current.quantity <= 1) {
                    notifier.removeItem(current.id);
                  } else {
                    notifier.setQuantity(current.id, current.quantity - 1);
                  }
                },
                onIncrement: () => notifier.setQuantity(
                  state.items[i].id,
                  state.items[i].quantity + 1,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SwipeRemoveBg extends StatelessWidget {
  const _SwipeRemoveBg({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      color: colors.error.withValues(alpha: 0.12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedDelete02,
            size: 18,
            color: colors.error,
          ),
          const SizedBox(width: 6),
          Text(
            'Remove',
            style: AppTypography.bodyBold.copyWith(
              color: colors.error,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    required this.item,
    required this.colors,
    required this.onEdit,
    required this.onView,
    required this.onDecrement,
    required this.onIncrement,
  });

  final CartItem item;
  final AppColorSet colors;
  final VoidCallback? onEdit;
  final VoidCallback? onView;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  String _specSummary() {
    if (item.category == 'paper') return _paperSpecSummary();
    if (item.category == '3d') return _threeDSpecSummary();
    final values = item.specDisplayValues.values
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    return values.isEmpty
        ? (item.categoryName ?? item.category)
        : values.join(' · ');
  }

  String _paperSpecSummary() {
    final values = _displayValuesFor(const [
      'paper_size',
      'color_mode',
      'media_type',
      'print_sides',
      'binding',
    ]);
    final pageDisplay = item.specDisplayValues['page_count']?.trim();
    values.add(
      pageDisplay != null && pageDisplay.isNotEmpty
          ? pageDisplay
          : '${item.pageCount} pages',
    );
    if (values.isNotEmpty) return values.join(' · ');

    final specs = item.paperSpecs;
    if (specs != null) {
      return '${specs.paperSize.displayName} · ${specs.colorMode.displayName} · ${specs.mediaType.displayName} · ${specs.printSides.displayName} · ${specs.binding.displayName} · ${item.pageCount} pages';
    }
    return 'Paper';
  }

  String _threeDSpecSummary() {
    final values = _displayValuesFor(const [
      'file_format',
      'material',
      'color',
      'infill_percentage',
      'layer_height',
      'supports',
    ]);
    if (values.isNotEmpty) return values.join(' · ');

    final specs = item.threeDSpecs;
    if (specs != null) {
      return '${specs.fileFormat.displayName} · ${specs.material.displayName} · ${specs.infillPercentage}% infill · ${specs.layerHeight}mm';
    }
    return '3D';
  }

  List<String> _displayValuesFor(List<String> keys) {
    return [
      for (final key in keys)
        if ((item.specDisplayValues[key]?.trim() ?? '').isNotEmpty)
          item.specDisplayValues[key]!.trim(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: AppRadius.borderMd,
              border: Border.all(color: colors.outline.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: HugeIcon(
                icon: item.category == '3d'
                    ? HugeIcons.strokeRoundedCube
                    : HugeIcons.strokeRoundedFile02,
                size: 18,
                color: colors.onSurfaceDim,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _specSummary(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      item.printSubtotal == null
                          ? 'Price pending review'
                          : formatCurrency(item.printSubtotal!),
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.brand,
                        fontSize: 13,
                      ),
                    ),
                    _RowAction(label: 'View', onTap: onView, colors: colors),
                    _RowAction(label: 'Edit', onTap: onEdit, colors: colors),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          _Stepper(
            quantity: item.quantity,
            colors: colors,
            onDecrement: onDecrement,
            onIncrement: onIncrement,
          ),
        ],
      ),
    );
  }
}

class _RowAction extends StatelessWidget {
  const _RowAction({
    required this.label,
    required this.onTap,
    required this.colors,
  });

  final String label;
  final VoidCallback? onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final color = enabled ? colors.onSurfaceDim : colors.disabled;

    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
          decoration: enabled ? TextDecoration.underline : TextDecoration.none,
          decorationColor: color,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.quantity,
    required this.colors,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int quantity;
  final AppColorSet colors;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    final canDec = quantity > 1;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints.tightFor(width: 28, height: 28),
            padding: EdgeInsets.zero,
            onPressed: canDec ? onDecrement : null,
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedMinusSign,
              size: 14,
              color: canDec ? colors.onBackground : colors.disabled,
            ),
          ),
          SizedBox(
            width: 22,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                fontSize: 13,
              ),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints.tightFor(width: 28, height: 28),
            padding: EdgeInsets.zero,
            onPressed: onIncrement,
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedAdd01,
              size: 14,
              color: colors.onBackground,
            ),
          ),
        ],
      ),
    );
  }
}
