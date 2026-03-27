import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/utils/formatters.dart';

/// Displays a columnar price breakdown with individual line items,
/// a divider, and a bold total.
class PriceBreakdown extends StatelessWidget {
  const PriceBreakdown({
    super.key,
    required this.basePrice,
    required this.quantity,
    required this.deliveryFee,
    required this.total,
    this.multiplierLabel,
    this.multiplierAmount,
    this.bindingFee,
  });

  /// Base printing cost before multipliers.
  final double basePrice;

  /// Order quantity.
  final int quantity;

  /// Delivery fee (₱0 for pickup).
  final double deliveryFee;

  /// Final total.
  final double total;

  /// Optional label for combined multipliers (e.g. "Size + Color + Media").
  final String? multiplierLabel;

  /// The amount after multipliers are applied (before binding).
  final double? multiplierAmount;

  /// Binding fee if applicable.
  final double? bindingFee;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _lineItem('Base price', basePrice, colors),
        if (multiplierLabel != null && multiplierAmount != null)
          _lineItem(multiplierLabel!, multiplierAmount!, colors),
        if (bindingFee != null && bindingFee! > 0)
          _lineItem('Binding fee', bindingFee!, colors),
        if (quantity > 1) _lineItem('Quantity', quantity.toDouble(), colors, isQuantity: true),
        _lineItem('Delivery fee', deliveryFee, colors),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Divider(color: colors.outline, height: 1),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Total',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            Text(
              formatCurrency(total),
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
          ],
        ),
      ],
    );
  }

  Widget _lineItem(
    String label,
    double amount,
    AppColorSet colors, {
    bool isQuantity = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          Text(
            isQuantity ? 'x${amount.toInt()}' : formatCurrency(amount),
            style: AppTypography.body.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }
}
