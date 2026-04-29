import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/widgets/price_breakdown.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/formatters.dart';

/// Step 4/6 -- Order summary with price breakdown.
class SummaryScreen extends ConsumerWidget {
  const SummaryScreen({super.key});

  static const routeName = '/order/summary';

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final state = ref.watch(orderFlowProvider);
    final checkout = ref.watch(orderCheckoutProvider);
    final isPaper = state.category == 'paper';

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Summary',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                children: [
                  const SizedBox(height: AppSpacing.md),
                  const StepIndicator(totalSteps: 6, currentStep: 3),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                        'Order Summary',
                        style: AppTypography.h1.copyWith(
                          color: colors.onBackground,
                        ),
                      )
                      .animate()
                      .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.03,
                        duration: 400.ms,
                        curve: Curves.easeOut,
                      ),
                  const SizedBox(height: AppSpacing.lg),

                  // Specs card
                  AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isPaper ? 'Paper Printing' : '3D Printing',
                              style: AppTypography.h3.copyWith(
                                color: colors.onBackground,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            if (isPaper && state.paperSpecs != null) ...[
                              _specRow(
                                'Size',
                                state.paperSpecs!.paperSize.displayName,
                                colors,
                              ),
                              _specRow(
                                'Color',
                                state.paperSpecs!.colorMode.displayName,
                                colors,
                              ),
                              _specRow(
                                'Media',
                                state.paperSpecs!.mediaType.displayName,
                                colors,
                              ),
                              _specRow(
                                'Sides',
                                state.paperSpecs!.printSides.displayName,
                                colors,
                              ),
                              _specRow(
                                'Binding',
                                state.paperSpecs!.binding.displayName,
                                colors,
                              ),
                              _specRow('Pages', '${state.pageCount}', colors),
                            ],
                            if (!isPaper && state.threeDSpecs != null) ...[
                              _specRow(
                                'Format',
                                state.threeDSpecs!.fileFormat.displayName,
                                colors,
                              ),
                              _specRow(
                                'Material',
                                state.threeDSpecs!.material.displayName,
                                colors,
                              ),
                              _specRow(
                                'Color',
                                state.threeDSpecs!.color,
                                colors,
                              ),
                              _specRow(
                                'Infill',
                                '${state.threeDSpecs!.infillPercentage}%',
                                colors,
                              ),
                              _specRow(
                                'Layer',
                                '${state.threeDSpecs!.layerHeight}mm',
                                colors,
                              ),
                              _specRow(
                                'Supports',
                                state.threeDSpecs!.supports ? 'Yes' : 'No',
                                colors,
                              ),
                              if (state.threeDSpecs!.notes != null)
                                _specRow(
                                  'Notes',
                                  state.threeDSpecs!.notes!,
                                  colors,
                                ),
                            ],
                            _specRow('Quantity', '${state.quantity}', colors),
                          ],
                        ),
                      )
                      .animate()
                      .fadeIn(
                        duration: 400.ms,
                        delay: 60.ms,
                        curve: Curves.easeOut,
                      )
                      .slideY(
                        begin: 0.03,
                        duration: 400.ms,
                        delay: 60.ms,
                        curve: Curves.easeOut,
                      ),
                  const SizedBox(height: AppSpacing.md),

                  // File info card
                  if (state.fileName != null)
                    AppCard(
                      child: Row(
                        children: [
                          HugeIcon(
                            icon: HugeIcons.strokeRoundedFileValidation,
                            size: 32,
                            color: colors.accent,
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.fileName!,
                                  style: AppTypography.bodyBold.copyWith(
                                    color: colors.onBackground,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (state.fileSize != null)
                                  Text(
                                    formatFileSize(state.fileSize!),
                                    style: AppTypography.caption.copyWith(
                                      color: colors.onSurfaceDim,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: AppSpacing.lg),

                  // Batch delivery info (destinations / slot / priority)
                  if (checkout.groups.isNotEmpty || checkout.slotTemplateId != null || checkout.priority)
                    _buildBatchDeliveryInfo(checkout, colors)
                        .animate()
                        .fadeIn(
                          duration: 400.ms,
                          delay: 100.ms,
                          curve: Curves.easeOut,
                        )
                        .slideY(
                          begin: 0.03,
                          duration: 400.ms,
                          delay: 100.ms,
                          curve: Curves.easeOut,
                        ),
                  if (checkout.groups.isNotEmpty || checkout.slotTemplateId != null || checkout.priority)
                    const SizedBox(height: AppSpacing.md),

                  // Price breakdown
                  _buildPriceBreakdown(state, isPaper)
                      .animate()
                      .fadeIn(
                        duration: 400.ms,
                        delay: 120.ms,
                        curve: Curves.easeOut,
                      )
                      .slideY(
                        begin: 0.03,
                        duration: 400.ms,
                        delay: 120.ms,
                        curve: Curves.easeOut,
                      ),
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(
                  top: BorderSide(color: colors.outline, width: 0.5),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AppButton(
                    label: 'Add to Cart',
                    variant: AppButtonVariant.secondary,
                    isFullWidth: true,
                    onTap: () {
                      final flow = ref.read(orderFlowProvider);
                      ref.read(cartProvider.notifier).addFromOrderFlow(flow);
                      ref.read(orderFlowProvider.notifier).reset();
                      context.go('/customer/cart');
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: 'Continue to Delivery',
                    isFullWidth: true,
                    onTap: () {
                      ref.read(orderFlowProvider.notifier).nextStep();
                      context.push('/customer/order/delivery');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBatchDeliveryInfo(OrderCheckoutState checkout, AppColorSet colors) {
    String deliveryLabel;
    if (checkout.slotTemplateId != null) {
      final datePart = checkout.slotDate ?? '';
      deliveryLabel = datePart.isNotEmpty
          ? 'Delivery slot reserved · $datePart'
          : 'Delivery slot reserved';
    } else {
      deliveryLabel = 'External courier (admin-managed)';
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Batch Delivery',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.md),
          if (checkout.groups.isNotEmpty)
            _specRow(
              'Destinations',
              '${checkout.groups.length}',
              colors,
            ),
          _specRow('Delivery', deliveryLabel, colors),
          if (checkout.priority)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: colors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Priority drop +\u20b150',
                  style: AppTypography.caption.copyWith(
                    color: colors.accent,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _specRow(String label, String value, AppColorSet colors) {
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
            value,
            style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceBreakdown(OrderFlowState state, bool isPaper) {
    double basePrice = 0;
    String? multiplierLabel;
    double? multiplierAmount;
    double? bindingFee;

    if (isPaper && state.paperSpecs != null) {
      basePrice = 2.0 * state.pageCount;
      multiplierLabel = 'Size + Color + Media + Sides';
      // Calculate the multiplied amount (before binding, for 1 unit)
      multiplierAmount =
          state.totalPrice / state.quantity -
          _getBindingFee(state.paperSpecs!.binding);
      bindingFee = _getBindingFee(state.paperSpecs!.binding);
    } else {
      basePrice = 50.0;
    }

    return PriceBreakdown(
      basePrice: basePrice,
      quantity: state.quantity,
      deliveryFee: state.deliveryFee,
      total: state.totalPrice + state.deliveryFee,
      multiplierLabel: multiplierLabel,
      multiplierAmount: multiplierAmount,
      bindingFee: bindingFee,
    );
  }

  double _getBindingFee(Binding binding) {
    switch (binding) {
      case Binding.none:
        return 0;
      case Binding.spiral:
        return 25;
      case Binding.staple:
        return 10;
      case Binding.premium:
        return 50;
    }
  }
}
