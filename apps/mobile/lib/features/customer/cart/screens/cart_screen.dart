import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/utils/formatters.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  static const routeName = '/customer/cart';

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final cart = ref.watch(cartProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: colors.onBackground),
          onPressed: () => context.go('/customer/home'),
        ),
        title: Text(
          'The Queue',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        actions: [
          if (cart.isNotEmpty)
            TextButton(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              child: Text(
                'Clear',
                style: AppTypography.bodyBold.copyWith(color: colors.error),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: cart.isEmpty
            ? _EmptyQueue(colors: colors)
            : _QueuedJobs(cart: cart, colors: colors),
      ),
    );
  }
}

class _QueuedJobs extends ConsumerWidget {
  const _QueuedJobs({required this.cart, required this.colors});

  final CartState cart;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.sm,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              Text(
                'Batch order',
                style: AppTypography.h1.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${cart.itemCount} print job${cart.itemCount == 1 ? '' : 's'} • 1 delivery checkout',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Swipe left on a job to remove',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              ...cart.items.indexed.map((entry) {
                final index = entry.$1;
                final item = entry.$2;
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Dismissible(
                    key: Key('cart-item-${item.fileName}'),
                    direction: DismissDirection.endToStart,
                    background: const SizedBox.shrink(),
                    secondaryBackground: _RemoveBackground(colors: colors),
                    onDismissed: (_) {
                      final cartNotifier = ref.read(cartProvider.notifier);
                      cartNotifier.removeItem(item.id);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Removed ${item.fileName}'),
                          action: SnackBarAction(
                            label: 'Undo',
                            onPressed: () =>
                                cartNotifier.restoreItem(item, index),
                          ),
                        ),
                      );
                    },
                    child: _QueueItemTile(
                      item: item,
                      colors: colors,
                      onIncrement: () => ref
                          .read(cartProvider.notifier)
                          .incrementQuantity(item.id),
                      onDecrement: () => ref
                          .read(cartProvider.notifier)
                          .decrementQuantity(item.id),
                    ),
                  ),
                );
              }),
              TextButton.icon(
                onPressed: () => context.go('/customer/order/new'),
                icon: HugeIcon(
                  icon: HugeIcons.strokeRoundedPlusSign,
                  size: 18,
                  color: colors.brand,
                ),
                label: Text(
                  'Add another print job',
                  style: AppTypography.bodyBold.copyWith(color: colors.brand),
                ),
                style: TextButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 44),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Divider(color: colors.outline),
              const SizedBox(height: AppSpacing.md),
              _QueueTotals(colors: colors, subtotal: cart.subtotal),
            ],
          ),
        ),
        _QueueActionBar(colors: colors),
      ],
    );
  }
}

class _RemoveBackground extends StatelessWidget {
  const _RemoveBackground({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.error,
        borderRadius: AppRadius.borderMd,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const HugeIcon(
            icon: HugeIcons.strokeRoundedDelete02,
            size: 24,
            color: Colors.white,
          ),
          const SizedBox(height: 2),
          Text(
            'Remove',
            style: AppTypography.caption.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _QueueItemTile extends StatelessWidget {
  const _QueueItemTile({
    required this.item,
    required this.colors,
    required this.onIncrement,
    required this.onDecrement,
  });

  final CartItem item;
  final AppColorSet colors;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline.withValues(alpha: 0.45)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: AppRadius.borderMd,
                border: Border.all(color: colors.onBackground, width: 2),
              ),
              child: HugeIcon(
                icon: item.category == 'paper'
                    ? HugeIcons.strokeRoundedFile01
                    : HugeIcons.strokeRoundedCube,
                size: 24,
                color: colors.onBackground,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.fileName,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _specSummary(item),
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          formatCurrency(item.printSubtotal),
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.brand,
                          ),
                        ),
                      ),
                      _QuantityStepper(
                        quantity: item.quantity,
                        colors: colors,
                        onIncrement: onIncrement,
                        onDecrement: onDecrement,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _specSummary(CartItem item) {
    if (item.category == 'paper' && item.paperSpecs != null) {
      final specs = item.paperSpecs!;
      return '${specs.paperSize.displayName}, ${item.pageCount} pages';
    }
    if (item.threeDSpecs != null) {
      final specs = item.threeDSpecs!;
      return '${specs.material.displayName}, ${specs.infillPercentage}% infill';
    }
    return item.category == 'paper' ? 'Paper printing' : '3D printing';
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.colors,
    required this.onIncrement,
    required this.onDecrement,
  });

  final int quantity;
  final AppColorSet colors;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final canDecrement = quantity > 1;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _stepperButton(
            key: const Key('cart-item-decrement'),
            icon: HugeIcons.strokeRoundedMinusSign,
            onTap: canDecrement ? onDecrement : null,
            color: canDecrement ? colors.onBackground : colors.onSurfaceDim,
          ),
          SizedBox(
            width: 32,
            child: Text(
              '$quantity',
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          _stepperButton(
            key: const Key('cart-item-increment'),
            icon: HugeIcons.strokeRoundedPlusSign,
            onTap: onIncrement,
            color: colors.onBackground,
          ),
        ],
      ),
    );
  }

  Widget _stepperButton({
    required Key key,
    required List<List<dynamic>> icon,
    required VoidCallback? onTap,
    required Color color,
  }) {
    return IconButton(
      key: key,
      onPressed: onTap,
      icon: HugeIcon(icon: icon, size: 16, color: color),
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints.tightFor(width: 32, height: 32),
      style: IconButton.styleFrom(
        backgroundColor: colors.surface,
        disabledBackgroundColor: colors.surface.withValues(alpha: 0.45),
      ),
    );
  }
}

class _QueueTotals extends StatelessWidget {
  const _QueueTotals({required this.colors, required this.subtotal});

  final AppColorSet colors;
  final double subtotal;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _totalRow('Base price', formatCurrency(subtotal), colors),
        _totalRow('Delivery fee', 'Calculated next', colors),
        const SizedBox(height: AppSpacing.sm),
        Divider(color: colors.outline),
        const SizedBox(height: AppSpacing.sm),
        _totalRow('Total', formatCurrency(subtotal), colors, isStrong: true),
      ],
    );
  }

  Widget _totalRow(
    String label,
    String value,
    AppColorSet colors, {
    bool isStrong = false,
  }) {
    final style = isStrong ? AppTypography.h3 : AppTypography.body;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: style.copyWith(
              color: isStrong ? colors.onBackground : colors.onSurfaceDim,
            ),
          ),
          Text(value, style: style.copyWith(color: colors.onBackground)),
        ],
      ),
    );
  }
}

class _QueueActionBar extends StatelessWidget {
  const _QueueActionBar({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline, width: 0.5)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppButton(
            label: 'Continue to Delivery',
            variant: AppButtonVariant.brand,
            isFullWidth: true,
            onTap: () => context.push('/customer/order/delivery'),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Back to Home',
            variant: AppButtonVariant.ghost,
            isFullWidth: true,
            onTap: () => context.go('/customer/home'),
          ),
        ],
      ),
    );
  }
}

class _EmptyQueue extends StatelessWidget {
  const _EmptyQueue({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedShoppingCart01,
              size: 56,
              color: colors.brand,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Your queue is empty',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Start a print job, add it here, then check out everything together.',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: 'Start Printing',
              variant: AppButtonVariant.brand,
              isFullWidth: true,
              onTap: () => context.go('/customer/order/new'),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Back to Home',
              variant: AppButtonVariant.secondary,
              isFullWidth: true,
              onTap: () => context.go('/customer/home'),
            ),
          ],
        ),
      ),
    );
  }
}
