import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/utils/formatters.dart';

typedef AcceptQuoteCallback =
    Future<void> Function(
      String orderId,
      int supplierAssignmentId,
      PaymentMethod paymentMethod,
    );

class QuoteCard extends ConsumerStatefulWidget {
  const QuoteCard({
    super.key,
    required this.order,
    required this.isOwner,
    this.onAccept,
    this.onRefresh,
  });

  final Order order;
  final bool isOwner;
  final AcceptQuoteCallback? onAccept;
  final VoidCallback? onRefresh;

  @override
  ConsumerState<QuoteCard> createState() => _QuoteCardState();
}

class _QuoteCardState extends ConsumerState<QuoteCard> {
  PaymentMethod _paymentMethod = PaymentMethod.gridCredits;
  bool _accepting = false;
  QuoteAcceptanceException? _quoteError;
  String? _genericError;

  bool get _hasCompleteQuote =>
      widget.order.quotedTotalMinor != null &&
      widget.order.promisedCompletionAt != null &&
      widget.order.quoteAssignmentId != null;

  Future<void> _accept() async {
    if (_accepting || !_hasCompleteQuote) return;
    final assignmentId = widget.order.quoteAssignmentId!;
    setState(() {
      _accepting = true;
      _quoteError = null;
      _genericError = null;
    });
    try {
      final callback =
          widget.onAccept ?? ref.read(ordersProvider.notifier).acceptQuote;
      await callback(widget.order.id, assignmentId, _paymentMethod);
    } on QuoteAcceptanceException catch (error) {
      if (mounted) setState(() => _quoteError = error);
    } catch (_) {
      if (mounted) {
        setState(
          () => _genericError =
              'Unable to accept this quote. Your selection is still saved.',
        );
      }
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  void _refresh() {
    final callback = widget.onRefresh;
    if (callback != null) {
      callback();
    } else {
      unawaited(ref.read(ordersProvider.notifier).refreshOrders());
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final status = widget.order.pricingStatus;
    final heading = status == PricingStatus.accepted
        ? 'Quote accepted'
        : status == PricingStatus.quoted
        ? 'Supplier quote'
        : 'Price and turnaround pending review';
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            container: true,
            label: heading,
            child: ExcludeSemantics(
              child: Text(
                heading,
                style: AppTypography.h3.copyWith(color: colors.onSurface),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (status == PricingStatus.pendingQuote)
            Text(
              'GRIDGO Operations and an eligible supplier are reviewing '
              'your requirements. Payment is unavailable until a quote is ready.',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            )
          else ...[
            _quoteTerms(colors),
            if (status == PricingStatus.accepted) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                'Payment method: ${widget.order.paymentMethod.displayName}',
                style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
              ),
              Text(
                'GRIDGO Operations will authorize payment before production starts.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ] else if (widget.isOwner && _hasCompleteQuote) ...[
              const SizedBox(height: AppSpacing.md),
              Semantics(
                container: true,
                label: widget.order.codEligible
                    ? 'Choose payment method. '
                          '${_paymentMethod == PaymentMethod.gridCredits ? 'Pilot Credits selected. Cash on Delivery available' : 'Cash on Delivery selected. Pilot Credits available'}'
                    : 'Choose payment method. Pilot Credits selected',
                child: ExcludeSemantics(
                  child: Text(
                    'Choose payment method',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ),
              RadioGroup<PaymentMethod>(
                groupValue: _paymentMethod,
                onChanged: _accepting
                    ? (_) {}
                    : (value) {
                        if (value != null) {
                          setState(() => _paymentMethod = value);
                        }
                      },
                child: Column(
                  children: [
                    Semantics(
                      container: true,
                      label: 'Pilot Credits',
                      checked: _paymentMethod == PaymentMethod.gridCredits,
                      inMutuallyExclusiveGroup: true,
                      onTap: _accepting
                          ? null
                          : () => setState(
                              () => _paymentMethod = PaymentMethod.gridCredits,
                            ),
                      excludeSemantics: true,
                      child: RadioListTile<PaymentMethod>(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Pilot Credits'),
                        value: PaymentMethod.gridCredits,
                      ),
                    ),
                    if (widget.order.codEligible)
                      Semantics(
                        container: true,
                        label: 'Cash on Delivery',
                        checked: _paymentMethod == PaymentMethod.cod,
                        inMutuallyExclusiveGroup: true,
                        onTap: _accepting
                            ? null
                            : () => setState(
                                () => _paymentMethod = PaymentMethod.cod,
                              ),
                        excludeSemantics: true,
                        child: RadioListTile<PaymentMethod>(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Cash on Delivery'),
                          value: PaymentMethod.cod,
                        ),
                      ),
                  ],
                ),
              ),
              if (_quoteError != null || _genericError != null) ...[
                Text(
                  _quoteError?.message ?? _genericError!,
                  style: AppTypography.caption.copyWith(color: colors.error),
                ),
                if (_quoteError?.refreshRecommended == true)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _refresh,
                      child: const Text('Refresh quote'),
                    ),
                  ),
                const SizedBox(height: AppSpacing.sm),
              ],
              Semantics(
                container: true,
                button: true,
                enabled: !_accepting,
                label: 'Accept quote',
                onTap: _accepting ? null : _accept,
                excludeSemantics: true,
                child: AppButton(
                  label: 'Accept quote',
                  isFullWidth: true,
                  isLoading: _accepting,
                  onTap: _accept,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _quoteTerms(AppColorSet colors) {
    final rows = <({String label, String value})>[];
    final goods = widget.order.quotedGoodsMinor;
    final delivery = widget.order.deliveryFeeMinor;
    final total = widget.order.quotedTotalMinor;
    if (goods != null) {
      rows.add((label: 'Goods', value: formatMinorCurrency(goods)));
    }
    if (delivery != null) {
      rows.add((label: 'Delivery', value: formatMinorCurrency(delivery)));
    }
    if (total != null) {
      rows.add((label: 'Total', value: formatMinorCurrency(total)));
    }
    final promised = widget.order.promisedCompletionAt;
    if (promised != null) {
      rows.add((label: 'Promised completion', value: formatDate(promised)));
    }

    return Column(
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  row.label,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Flexible(
                  child: Text(
                    row.value,
                    textAlign: TextAlign.end,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
