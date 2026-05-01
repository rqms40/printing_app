import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/widgets/payment_method_glyph.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/formatters.dart';

class PaymentMethodSheet {
  static Future<PaymentMethod?> show(
    BuildContext context, {
    PaymentMethod? current,
  }) {
    return showModalBottomSheet<PaymentMethod>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentSheetBody(initial: current),
    );
  }
}

class _PaymentSheetBody extends ConsumerStatefulWidget {
  const _PaymentSheetBody({required this.initial});
  final PaymentMethod? initial;

  @override
  ConsumerState<_PaymentSheetBody> createState() => _PaymentSheetBodyState();
}

class _PaymentSheetBodyState extends ConsumerState<_PaymentSheetBody> {
  PaymentMethod? _chosen;
  bool _setDefault = false;

  @override
  void initState() {
    super.initState();
    _chosen = widget.initial;
  }

  String _wireValue(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gridCredits:
        return 'credits';
      default:
        return m.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final authState = ref.watch(authProvider);
    final creditsBalance =
        double.tryParse(authState.user?.credits ?? '0') ?? 0.0;

    return SafeArea(
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Choose payment',
              style: AppTypography.h3.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Pick how you want to pay',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            for (var i = 0; i < PaymentMethod.values.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              _MethodRow(
                method: PaymentMethod.values[i],
                selected: _chosen == PaymentMethod.values[i],
                colors: colors,
                creditsBalance: creditsBalance,
                onTap: PaymentMethod.values[i] == PaymentMethod.gridCredits &&
                        creditsBalance == 0
                    ? null
                    : () =>
                        setState(() => _chosen = PaymentMethod.values[i]),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            InkWell(
              onTap: () => setState(() => _setDefault = !_setDefault),
              borderRadius: AppRadius.borderMd,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 140),
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: _setDefault ? colors.brand : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: _setDefault
                              ? colors.brand
                              : colors.outline,
                          width: 1.5,
                        ),
                      ),
                      child: _setDefault
                          ? Icon(Icons.check, size: 14, color: colors.background)
                          : null,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Save as default for future orders',
                      style: AppTypography.body.copyWith(
                        color: colors.onBackground,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _UseThisButton(
              enabled: _chosen != null,
              colors: colors,
              onTap: _chosen == null
                  ? null
                  : () async {
                      if (_setDefault) {
                        try {
                          await ApiClient.instance.dio.patch(
                            '/users/me/default-payment-method',
                            data: {'method': _wireValue(_chosen!)},
                          );
                        } catch (_) {
                          // non-fatal — selection still applied for this order
                        }
                      }
                      if (!context.mounted) return;
                      Navigator.of(context).pop(_chosen);
                    },
            ),
          ],
        ),
      ),
    );
  }
}

class _MethodRow extends StatelessWidget {
  const _MethodRow({
    required this.method,
    required this.selected,
    required this.colors,
    required this.onTap,
    this.creditsBalance = 0.0,
  });
  final PaymentMethod method;
  final bool selected;
  final AppColorSet colors;
  final VoidCallback? onTap;
  final double creditsBalance;

  bool get _isCredits => method == PaymentMethod.gridCredits;
  bool get _disabled => _isCredits && creditsBalance == 0;

  String _label(PaymentMethod m) {
    switch (m) {
      case PaymentMethod.gcash:
        return 'GCash';
      case PaymentMethod.maya:
        return 'Maya';
      case PaymentMethod.cod:
        return 'Cash on Delivery';
      case PaymentMethod.gridCredits:
        return 'GRID Credits';
    }
  }

  String _subtitle(PaymentMethod m) {
    if (m == PaymentMethod.gridCredits) {
      if (creditsBalance > 0) {
        return '${formatCurrency(creditsBalance)} available';
      } else {
        return 'No credits — top up to use';
      }
    }
    switch (m) {
      case PaymentMethod.gcash:
        return 'e-wallet · instant';
      case PaymentMethod.maya:
        return 'e-wallet · instant';
      case PaymentMethod.cod:
        return 'Pay cash to the rider';
      case PaymentMethod.gridCredits:
        return 'Use your GRID balance';
    }
  }

  @override
  Widget build(BuildContext context) {
    final labelColor =
        _disabled ? colors.onSurfaceDim : colors.onBackground;
    final subtitleColor = _disabled
        ? colors.onSurfaceDim.withValues(alpha: 0.55)
        : colors.onSurfaceDim;

    return Opacity(
      opacity: _disabled ? 0.55 : 1.0,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderLg,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: selected
                ? colors.brand.withValues(alpha: 0.10)
                : colors.background,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: selected
                  ? colors.brand.withValues(alpha: 0.6)
                  : colors.outline.withValues(alpha: 0.35),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              PaymentMethodGlyph(method: method, size: 36),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _label(method),
                      style: AppTypography.bodyBold.copyWith(
                        color: labelColor,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _subtitle(method),
                      style: AppTypography.caption.copyWith(
                        color: subtitleColor,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              if (_disabled) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).pop();
                    context.push('/customer/profile/top-up');
                  },
                  child: Text(
                    'Top up',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      decoration: TextDecoration.underline,
                      decorationColor: colors.brand,
                    ),
                  ),
                ),
              ] else ...[
                AnimatedContainer(
                  duration: const Duration(milliseconds: 140),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: selected ? colors.brand : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? colors.brand : colors.outline,
                      width: 1.5,
                    ),
                  ),
                  child: selected
                      ? Icon(Icons.check, size: 14, color: colors.background)
                      : null,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _UseThisButton extends StatelessWidget {
  const _UseThisButton({
    required this.enabled,
    required this.onTap,
    required this.colors,
  });
  final bool enabled;
  final VoidCallback? onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: 52,
          decoration: BoxDecoration(
            color: enabled
                ? colors.brand
                : colors.brand.withValues(alpha: 0.4),
            borderRadius: AppRadius.borderXl,
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Use this',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.background,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 6),
                HugeIcon(
                  icon: HugeIcons.strokeRoundedArrowRight01,
                  size: 18,
                  color: colors.background,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
