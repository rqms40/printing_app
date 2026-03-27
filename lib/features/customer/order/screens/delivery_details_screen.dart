import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/screens/payment_screen.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/formatters.dart';

/// Step 5/6 -- Delivery option (pickup vs. delivery) and address selection.
class DeliveryDetailsScreen extends ConsumerStatefulWidget {
  const DeliveryDetailsScreen({super.key});

  static const routeName = '/order/delivery';

  @override
  ConsumerState<DeliveryDetailsScreen> createState() =>
      _DeliveryDetailsScreenState();
}

class _DeliveryDetailsScreenState
    extends ConsumerState<DeliveryDetailsScreen> {
  String _deliveryOption = 'pickup';
  Address? _selectedAddress;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    final state = ref.read(orderFlowProvider);
    _deliveryOption = state.deliveryOption;
    _selectedAddress = state.deliveryAddress;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final addresses = MockData.addresses;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                children: [
                  const SizedBox(height: AppSpacing.md),
                  const StepIndicator(totalSteps: 6, currentStep: 4),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Delivery Details',
                    style:
                        AppTypography.h1.copyWith(color: colors.onBackground),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Toggle: Pickup / Delivery
                  Container(
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: Row(
                      children: [
                        _toggleOption('pickup', 'Pickup', colors),
                        _toggleOption('delivery', 'Delivery', colors),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  if (_deliveryOption == 'pickup') ...[
                    AppCard(
                      child: Row(
                        children: [
                          Icon(Iconsax.shop, size: 32, color: colors.accent),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'DarkastixPrint Shop',
                                  style: AppTypography.bodyBold
                                      .copyWith(color: colors.onBackground),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  '123 Print Street, Makati City, Metro Manila',
                                  style: AppTypography.caption
                                      .copyWith(color: colors.onSurfaceDim),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _feeRow('Delivery fee', 0, colors),
                  ],

                  if (_deliveryOption == 'delivery') ...[
                    Text(
                      'Select delivery address',
                      style: AppTypography.caption
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ...addresses.map((addr) => Padding(
                          padding:
                              const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: AppCard(
                            onTap: () =>
                                setState(() => _selectedAddress = addr),
                            accentColor: _selectedAddress?.id == addr.id
                                ? colors.accent
                                : null,
                            child: Row(
                              children: [
                                Icon(
                                  addr.label == 'Home'
                                      ? Iconsax.home_2
                                      : addr.label == 'Office'
                                          ? Iconsax.building
                                          : Iconsax.location,
                                  size: 24,
                                  color: colors.onSurface,
                                ),
                                const SizedBox(width: AppSpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        addr.label,
                                        style: AppTypography.bodyBold
                                            .copyWith(
                                                color: colors.onBackground),
                                      ),
                                      const SizedBox(height: AppSpacing.xs),
                                      Text(
                                        addr.fullAddress,
                                        style: AppTypography.caption
                                            .copyWith(
                                                color: colors.onSurfaceDim),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                if (_selectedAddress?.id == addr.id)
                                  Icon(Iconsax.tick_circle,
                                      size: 24, color: colors.accent),
                              ],
                            ),
                          ),
                        )),
                    const SizedBox(height: AppSpacing.sm),
                    AppButton(
                      label: 'Add New Address',
                      variant: AppButtonVariant.secondary,
                      isFullWidth: true,
                      icon: Iconsax.add,
                      onTap: () {
                        // Placeholder for add address flow
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _feeRow('Delivery fee', 50, colors),
                  ],
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
              child: AppButton(
                label: 'Continue to Payment',
                isFullWidth: true,
                isDisabled: _deliveryOption == 'delivery' &&
                    _selectedAddress == null,
                onTap: (_deliveryOption == 'delivery' &&
                        _selectedAddress == null)
                    ? null
                    : _onContinue,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _toggleOption(
      String value, String label, AppColorSet colors) {
    final isSelected = _deliveryOption == value;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _deliveryOption = value);
          ref.read(orderFlowProvider.notifier).setDeliveryOption(value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: isSelected ? colors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              label,
              style: AppTypography.bodyBold.copyWith(
                color: isSelected ? colors.background : colors.onSurface,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _feeRow(String label, double amount, AppColorSet colors) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style:
                AppTypography.body.copyWith(color: colors.onSurfaceDim)),
        Text(
          formatCurrency(amount),
          style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
        ),
      ],
    );
  }

  void _onContinue() {
    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.setDeliveryOption(_deliveryOption);
    if (_deliveryOption == 'delivery' && _selectedAddress != null) {
      notifier.setAddress(_selectedAddress!);
    }
    notifier.nextStep();

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const PaymentScreen()),
    );
  }
}
