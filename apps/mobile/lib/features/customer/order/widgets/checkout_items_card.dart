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
    final fees = ref.watch(checkoutFeesProvider);
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
                displayPrice: _itemDisplayPrice(
                  items: state.items,
                  index: i,
                  serviceFee: fees.serviceFee,
                ),
                colors: colors,
                onEdit: () async {
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

double _itemDisplayPrice({
  required List<CartItem> items,
  required int index,
  required double serviceFee,
}) {
  final item = items[index];
  if (items.length == 1) return item.printSubtotal + serviceFee;
  final subtotal = items.fold<double>(0, (sum, i) => sum + i.printSubtotal);
  if (subtotal <= 0) return item.printSubtotal;
  if (index == items.length - 1) {
    final priorShare = items.take(index).fold<double>(
      0,
      (sum, i) => sum + i.printSubtotal / subtotal * serviceFee,
    );
    return item.printSubtotal + (serviceFee - priorShare);
  }
  return item.printSubtotal + (item.printSubtotal / subtotal * serviceFee);
}

class _ItemRow extends StatefulWidget {
  const _ItemRow({
    required this.item,
    required this.displayPrice,
    required this.colors,
    required this.onEdit,
    required this.onView,
    required this.onDecrement,
    required this.onIncrement,
  });

  final CartItem item;
  final double displayPrice;
  final AppColorSet colors;
  final VoidCallback onEdit;
  final VoidCallback? onView;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  State<_ItemRow> createState() => _ItemRowState();
}

class _ItemRowState extends State<_ItemRow> {
  bool _isExpanded = false;

  String _specSummary() {
    if (widget.item.category == 'paper') return _paperSpecSummary();
    if (widget.item.category == '3d') return _threeDSpecSummary();
    return widget.item.category == 'paper' ? 'Paper' : '3D';
  }

  String _paperSpecSummary() {
    final values = _displayValuesFor(const [
      'paper_size',
      'color_mode',
      'media_type',
      'print_sides',
      'binding',
    ]);
    final pageDisplay = widget.item.specDisplayValues['page_count']?.trim();
    values.add(
      pageDisplay != null && pageDisplay.isNotEmpty
          ? pageDisplay
          : '${widget.item.pageCount} pages',
    );
    if (values.isNotEmpty) return values.join(' · ');

    final specs = widget.item.paperSpecs;
    if (specs != null) {
      return '${specs.paperSize.displayName} · ${specs.colorMode.displayName} · ${specs.mediaType.displayName} · ${specs.printSides.displayName} · ${specs.binding.displayName} · ${widget.item.pageCount} pages';
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

    final specs = widget.item.threeDSpecs;
    if (specs != null) {
      return '${specs.fileFormat.displayName} · ${specs.material.displayName} · ${specs.infillPercentage}% infill · ${specs.layerHeight}mm';
    }
    return '3D';
  }

  List<String> _displayValuesFor(List<String> keys) {
    return [
      for (final key in keys)
        if ((widget.item.specDisplayValues[key]?.trim() ?? '').isNotEmpty)
          widget.item.specDisplayValues[key]!.trim(),
    ];
  }

  String _formatKey(String key) {
    if (key.isEmpty) return key;
    return key.split('_').map((word) {
      if (word.isEmpty) return word;
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final detailsMap = <String, String>{};
    if (widget.item.categoryName != null && widget.item.categoryName!.isNotEmpty) {
      detailsMap['Type'] = widget.item.categoryName!;
    }
    detailsMap['Quantity'] = widget.item.quantity.toString();
    for (final entry in widget.item.specDisplayValues.entries) {
      if (entry.value.trim().isNotEmpty) {
        detailsMap[_formatKey(entry.key)] = entry.value.trim();
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: widget.colors.background,
                  borderRadius: AppRadius.borderMd,
                  border: Border.all(color: widget.colors.outline.withValues(alpha: 0.3)),
                ),
                child: Center(
                  child: HugeIcon(
                    icon: widget.item.category == '3d'
                        ? HugeIcons.strokeRoundedCube
                        : HugeIcons.strokeRoundedFile02,
                    size: 18,
                    color: widget.colors.onSurfaceDim,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.item.fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _specSummary(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: widget.colors.onSurfaceDim,
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
                          formatCurrency(widget.displayPrice),
                          style: AppTypography.bodyBold.copyWith(
                            color: widget.colors.brand,
                            fontSize: 13,
                          ),
                        ),
                        _RowAction(label: 'View', onTap: widget.onView, colors: widget.colors),
                        _RowAction(label: 'Edit', onTap: widget.onEdit, colors: widget.colors),
                        _RowAction(
                          label: _isExpanded ? 'Hide Details' : 'Details',
                          onTap: () {
                            setState(() {
                              _isExpanded = !_isExpanded;
                            });
                          },
                          colors: widget.colors,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _Stepper(
                quantity: widget.item.quantity,
                colors: widget.colors,
                onDecrement: widget.onDecrement,
                onIncrement: widget.onIncrement,
              ),
            ],
          ),
          if (_isExpanded) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: widget.colors.background,
                borderRadius: AppRadius.borderMd,
                border: Border.all(color: widget.colors.outline.withValues(alpha: 0.1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < detailsMap.length; i++)
                    Padding(
                      padding: EdgeInsets.only(
                          bottom: i == detailsMap.length - 1 ? 0 : AppSpacing.sm),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            detailsMap.keys.elementAt(i),
                            style: AppTypography.body.copyWith(
                              color: widget.colors.onSurfaceDim,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Text(
                              detailsMap.values.elementAt(i),
                              textAlign: TextAlign.right,
                              style: AppTypography.body.copyWith(
                                color: widget.colors.onBackground,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
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
