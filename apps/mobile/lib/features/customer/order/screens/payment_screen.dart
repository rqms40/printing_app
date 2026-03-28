import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/formatters.dart';

/// Step 6/6 -- Payment method selection and order placement.
class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key});

  static const routeName = '/order/payment';

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  PaymentMethod? _selectedMethod;
  bool _isProcessing = false;
  bool _isSuccess = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(orderFlowProvider);
    final total = state.totalPrice + state.deliveryFee;

    if (_isSuccess) {
      return _buildSuccessView(colors);
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Payment',
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
                  const StepIndicator(totalSteps: 6, currentStep: 5),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Payment',
                    style:
                        AppTypography.h1.copyWith(color: colors.onBackground),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Payment method cards
                  _paymentCard(
                    method: PaymentMethod.gcash,
                    icon: 'G',
                    label: 'GCash',
                    subtitle: 'Pay with GCash e-wallet',
                    colors: colors,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _paymentCard(
                    method: PaymentMethod.maya,
                    icon: 'M',
                    label: 'Maya',
                    subtitle: 'Pay with Maya e-wallet',
                    colors: colors,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _paymentCard(
                    method: PaymentMethod.cod,
                    icon: null,
                    iconData: HugeIcons.strokeRoundedMoney03,
                    label: 'Cash on Delivery',
                    subtitle: 'Pay when you receive your order',
                    colors: colors,
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Total display
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: AppRadius.borderMd,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Order Total',
                          style: AppTypography.bodyLarge
                              .copyWith(color: colors.onSurface),
                        ),
                        Text(
                          formatCurrency(total),
                          style: AppTypography.h2
                              .copyWith(color: colors.onBackground),
                        ),
                      ],
                    ),
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
              child: AppButton(
                label: 'Pay ${formatCurrency(total)}',
                isFullWidth: true,
                isLoading: _isProcessing,
                isDisabled: _selectedMethod == null,
                onTap: _selectedMethod == null ? null : _onPay,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentCard({
    required PaymentMethod method,
    String? icon,
    dynamic iconData,
    required String label,
    required String subtitle,
    required AppColorSet colors,
  }) {
    final isSelected = _selectedMethod == method;

    return AppCard(
      onTap: () {
        setState(() => _selectedMethod = method);
        ref.read(orderFlowProvider.notifier).setPaymentMethod(method);
      },
      accentColor: isSelected ? colors.accent : null,
      child: Row(
        children: [
          // Premium letter/icon container with subtle border ring
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
              border: Border.all(
                color: isSelected
                    ? colors.accent.withValues(alpha: 0.3)
                    : colors.outline.withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: Center(
              child: icon != null
                  ? Text(
                      icon,
                      style: AppTypography.h1.copyWith(
                        color: colors.accent,
                        fontSize: 22,
                      ),
                    )
                  : HugeIcon(icon: iconData!, size: 24, color: colors.accent),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTypography.bodyBold
                      .copyWith(color: colors.onBackground),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle,
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ),
          ),
          if (isSelected)
            Icon(Icons.check_circle_rounded, size: 24, color: colors.accent),
        ],
      ),
    );
  }

  Future<void> _onPay() async {
    setState(() => _isProcessing = true);

    try {
      // Build the new order from flow state
      final flowState = ref.read(orderFlowProvider);
      final authState = ref.read(authProvider);
      final userId = authState.user?.id ?? 'unknown';

      final newOrder = Order(
        id: 'ord_${DateTime.now().millisecondsSinceEpoch}',
        orderId:
            'ORD-${(10000 + DateTime.now().millisecond).toString().padLeft(5, '0')}',
        userId: userId,
        category: flowState.category ?? 'paper',
        fileName: flowState.fileName,
        fileUrl: flowState.filePath,
        paperSpecs: flowState.paperSpecs,
        threeDSpecs: flowState.threeDSpecs,
        quantity: flowState.quantity,
        totalPrice: flowState.totalPrice + flowState.deliveryFee,
        deliveryFee: flowState.deliveryFee,
        paymentMethod: flowState.paymentMethod ?? PaymentMethod.cod,
        paymentStatus: PaymentStatus.pending,
        orderStatus: OrderStatus.orderPlaced,
        deliveryOption: flowState.deliveryOption,
        deliveryAddressId: flowState.deliveryAddress?.id,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // 1. Create the order via API
      await ref.read(ordersProvider.notifier).addOrder(newOrder);

      // 2. Create payment intent for non-COD methods
      final paymentMethod = flowState.paymentMethod?.name ?? 'cod';
      if (paymentMethod != 'cod') {
        try {
          await ApiClient.instance.post('/payments/intent', data: {
            'paymentMethod': paymentMethod,
            'amount': flowState.totalPrice + flowState.deliveryFee,
          });
        } catch (_) {
          // Payment API unavailable -- proceed with demo mode
        }
      }

      if (!mounted) return;
      setState(() {
        _isProcessing = false;
        _isSuccess = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order failed: $e')),
      );
    }
  }

  Widget _buildSuccessView(AppColorSet colors) {
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.success.withValues(alpha: 0.15),
                  ),
                  child: Icon(
                    Icons.check_circle_rounded,
                    size: 56,
                    color: colors.success,
                  ),
                )
                    .animate()
                    .scale(
                      begin: const Offset(0.3, 0.3),
                      end: const Offset(1.0, 1.0),
                      duration: 600.ms,
                      curve: Curves.elasticOut,
                    )
                    .fadeIn(duration: 300.ms),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  'Order Placed!',
                  style:
                      AppTypography.h1.copyWith(color: colors.onBackground),
                )
                    .animate()
                    .fadeIn(delay: 300.ms, duration: 400.ms)
                    .slideY(begin: 0.3, end: 0),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Your order has been placed successfully.\nWe will notify you once printing begins.',
                  style: AppTypography.body
                      .copyWith(color: colors.onSurfaceDim),
                  textAlign: TextAlign.center,
                )
                    .animate()
                    .fadeIn(delay: 500.ms, duration: 400.ms),
                const SizedBox(height: AppSpacing.xxl),
                AppButton(
                  label: 'Back to Home',
                  isFullWidth: true,
                  onTap: () {
                    ref.read(orderFlowProvider.notifier).reset();
                    Navigator.of(context)
                        .popUntil((route) => route.isFirst);
                  },
                )
                    .animate()
                    .fadeIn(delay: 700.ms, duration: 400.ms),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
