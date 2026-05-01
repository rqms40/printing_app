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
import 'package:printing_app/utils/formatters.dart';

class CheckoutItemsCard extends ConsumerWidget {
  const CheckoutItemsCard({super.key, this.tutorialKey});

  final GlobalKey? tutorialKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final notifier = ref.read(checkoutProvider.notifier);

    return KeyedSubtree(
      key: tutorialKey,
      child: CheckoutSectionCard(
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
                onEdit: () async {
                  final updated =
                      await EditItemSheet.show(context, item: state.items[i]);
                  if (updated != null) notifier.replaceItem(updated);
                },
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
    required this.onDecrement,
    required this.onIncrement,
  });

  final CartItem item;
  final AppColorSet colors;
  final VoidCallback onEdit;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  String _specSummary() {
    if (item.category == 'paper' && item.paperSpecs != null) {
      return '${item.paperSpecs!.paperSize.name.toUpperCase()} · ${item.pageCount} pages';
    }
    if (item.threeDSpecs != null) {
      return '${item.threeDSpecs!.material.name.toUpperCase()} · ${item.threeDSpecs!.infillPercentage}% infill';
    }
    return item.category == 'paper' ? 'Paper' : '3D';
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
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      formatCurrency(item.printSubtotal),
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.brand,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    GestureDetector(
                      onTap: onEdit,
                      child: Text(
                        'Edit',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.underline,
                          decorationColor: colors.onSurfaceDim,
                          fontSize: 11,
                        ),
                      ),
                    ),
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
