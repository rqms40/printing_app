import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/order_concern_helpers.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Compact post-delivery action box for list cards / detail footers.
///
/// Shows side-by-side **Refund/Return** and **Order Received** when the order
/// is in the post-delivery concern window (`delivered` / `issue_window_open` /
/// `collected_by_customer`).
class OrderPostDeliveryActions extends ConsumerStatefulWidget {
  const OrderPostDeliveryActions({
    super.key,
    required this.order,
    this.showIntro = true,
  });

  final Order order;

  /// When false, only the button row is rendered (for nested cards).
  final bool showIntro;

  @override
  ConsumerState<OrderPostDeliveryActions> createState() =>
      _OrderPostDeliveryActionsState();
}

class _OrderPostDeliveryActionsState
    extends ConsumerState<OrderPostDeliveryActions> {
  bool _busy = false;
  final _concernNotesController = TextEditingController();
  String? _concernCategory;

  @override
  void dispose() {
    _concernNotesController.dispose();
    super.dispose();
  }

  Future<void> _snack(String message, {bool error = false}) async {
    if (!mounted) return;
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? colors.error : colors.success,
      ),
    );
  }

  Future<void> _run(Future<void> Function() action, String okMessage) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      await _snack(okMessage);
    } catch (e) {
      if (!mounted) return;
      await _snack('Action failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitConcern() async {
    final category = _concernCategory;
    if (category == null || category.isEmpty) {
      await _snack('Pick a concern category first', error: true);
      return;
    }
    final notes = _concernNotesController.text.trim();
    await _run(
      () => ref.read(ordersProvider.notifier).reportConcern(
            widget.order.id,
            category: category,
            notes: notes.isEmpty ? null : notes,
          ),
      'Concern reported — ops will review',
    );
    if (mounted) Navigator.of(context).maybePop();
  }

  Future<void> _showRefundModal() async {
    _concernCategory = null;
    _concernNotesController.clear();
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.md,
                right: AppSpacing.md,
                top: AppSpacing.md,
                bottom:
                    MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Refund / Return',
                      style: AppTypography.h3.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Report a quality, damage, or packing issue within the '
                      '24-hour concern window. GRIDGO ops will review your claim.',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final cat in reportConcernCategories)
                          FilterChip(
                            selected: _concernCategory == cat.value,
                            label: Text(cat.label),
                            onSelected: (_) {
                              setModalState(() => _concernCategory = cat.value);
                            },
                            selectedColor: colors.brand.withValues(alpha: 0.22),
                            checkmarkColor: colors.brand,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: _concernNotesController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: 'Describe the issue (optional)',
                        hintText: 'What should ops know?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    AppButton(
                      label: 'Submit refund / return request',
                      isFullWidth: true,
                      icon: HugeIcons.strokeRoundedAlert02,
                      isLoading: _busy,
                      onTap: _submitConcern,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!canReportConcern(widget.order.orderStatus)) {
      return const SizedBox.shrink();
    }

    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final width = MediaQuery.sizeOf(context).width;
    // Tighter padding/gap on small phones so labels stay readable.
    final isNarrow = width < 360;
    final gap = isNarrow ? 6.0 : 8.0;
    final pad = isNarrow ? 10.0 : 12.0;

    final buttonRow = _busy
        ? const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        : LayoutBuilder(
            builder: (context, constraints) {
              final stackVertically = constraints.maxWidth < 300;
              final refund = _CompactActionButton(
                label: 'Refund/Return',
                icon: HugeIcons.strokeRoundedAlert02,
                filled: false,
                colors: colors,
                onTap: _showRefundModal,
              );
              final received = _CompactActionButton(
                label: 'Order Received',
                icon: HugeIcons.strokeRoundedCheckmarkBadge01,
                filled: true,
                colors: colors,
                onTap: () => _run(
                  () => ref
                      .read(ordersProvider.notifier)
                      .confirmReceipt(widget.order.id),
                  'Order successfully completed',
                ),
              );

              if (stackVertically) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    refund,
                    SizedBox(height: gap),
                    received,
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(child: refund),
                  SizedBox(width: gap),
                  Expanded(child: received),
                ],
              );
            },
          );

    if (!widget.showIntro) {
      return buttonRow;
    }

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(pad),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'How was your order?',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Confirm receipt or request a refund / return within 24 hours.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 11,
              height: 1.3,
            ),
          ),
          SizedBox(height: isNarrow ? 10 : 12),
          buttonRow,
        ],
      ),
    );
  }
}

/// Small, width-aware action chip used in the post-delivery row.
class _CompactActionButton extends StatelessWidget {
  const _CompactActionButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final dynamic icon;
  final bool filled;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isNarrow = width < 360;
    final fontSize = isNarrow ? 11.0 : 12.0;
    final iconSize = isNarrow ? 13.0 : 14.0;
    final height = isNarrow ? 34.0 : 36.0;
    final hPad = isNarrow ? 6.0 : 8.0;

    final fg = filled ? colors.accentOnColor : colors.onBackground;
    final bg = filled ? colors.brand : Colors.transparent;
    final border = filled
        ? Border.all(color: Colors.transparent)
        : Border.all(color: colors.outline.withValues(alpha: 0.9));

    return Material(
      color: bg,
      borderRadius: AppRadius.borderMd,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderMd,
        child: Container(
          height: height,
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(horizontal: hPad),
          decoration: BoxDecoration(
            borderRadius: AppRadius.borderMd,
            border: border,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.max,
            children: [
              HugeIcon(icon: icon, size: iconSize, color: fg),
              SizedBox(width: isNarrow ? 4 : 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    color: fg,
                    fontSize: fontSize,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.1,
                    height: 1.1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
