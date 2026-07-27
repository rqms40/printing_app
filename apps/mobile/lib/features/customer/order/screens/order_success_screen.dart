import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

class OrderSuccessPayload {
  OrderSuccessPayload({required List<Order> createdOrders})
    : createdOrders = List<Order>.unmodifiable(createdOrders);

  final List<Order> createdOrders;
}

class OrderSuccessScreen extends ConsumerStatefulWidget {
  const OrderSuccessScreen({super.key, this.payload});

  final OrderSuccessPayload? payload;

  @override
  ConsumerState<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends ConsumerState<OrderSuccessScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final pipeline = ref.read(pipelineTutorialProvider);
      if (pipeline.active && pipeline.step == PipelineStep.placeOrderButton) {
        ref.read(pipelineTutorialProvider.notifier).finish();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final snapshotOrders = widget.payload?.createdOrders ?? const <Order>[];
    final liveOrders = ref.watch(ordersProvider);
    final orders = [
      for (final snapshot in snapshotOrders)
        _findLiveOrder(liveOrders, snapshot) ?? snapshot,
    ];
    final orderRefs = orders.map((order) => order.orderId).toList();
    final isMulti = orders.length > 1;
    final firstOrder = orders.firstOrNull;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            children: [
              const Spacer(flex: 2),
              _SuccessGlyph(colors: colors),
              const SizedBox(height: AppSpacing.xl),
              Text(
                    'Order placed',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.6,
                    ),
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 200.ms)
                  .slideY(begin: 0.1, duration: 400.ms, delay: 200.ms),
              const SizedBox(height: 8),
              Text(
                isMulti
                    ? "We've queued ${orders.length} print jobs."
                    : "We're on it. We'll notify you when the file is verified.",
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 14,
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 320.ms),
              const SizedBox(height: AppSpacing.xl),
              _ReferenceChips(
                refs: orderRefs,
                colors: colors,
              ).animate().fadeIn(duration: 400.ms, delay: 420.ms),
              if (firstOrder != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _DeliveryStateCard(
                  order: firstOrder,
                  orderCount: orders.length,
                  colors: colors,
                ),
              ],
              const Spacer(flex: 2),
              if (firstOrder != null) ...[
                _PrimaryButton(
                  label: isMulti
                      ? 'View orders'
                      : firstOrder.canTrackDelivery
                      ? 'Track delivery'
                      : 'View order',
                  icon: isMulti || !firstOrder.canTrackDelivery
                      ? HugeIcons.strokeRoundedShoppingBag03
                      : HugeIcons.strokeRoundedLocation01,
                  colors: colors,
                  onTap: () {
                    if (!isMulti && firstOrder.canTrackDelivery) {
                      context.go('/customer/orders/${firstOrder.id}/track');
                      return;
                    }
                    if (!isMulti) {
                      context.go('/customer/orders/${firstOrder.id}');
                      return;
                    }
                    context.go('/customer/orders');
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              _GhostButton(
                label: 'Back to home',
                colors: colors,
                onTap: () => context.go('/customer/home'),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

Order? _findLiveOrder(List<Order> liveOrders, Order snapshot) {
  for (final order in liveOrders) {
    if (order.id == snapshot.id ||
        order.orderId == snapshot.orderId ||
        (snapshot.batchId != null && order.batchId == snapshot.batchId)) {
      return order;
    }
  }
  return null;
}

class _DeliveryStateCard extends StatelessWidget {
  const _DeliveryStateCard({
    required this.order,
    required this.orderCount,
    required this.colors,
  });

  final Order order;
  final int orderCount;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final slot = order.assignedSlot;
    final method = order.deliveryOption == 'pickup' ? 'Pickup' : 'Delivery';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            orderCount > 1 ? 'Current batch status' : 'Current status',
            style: AppTypography.overline.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            order.orderStatus.displayName,
            style: AppTypography.h3.copyWith(
              color: colors.onBackground,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            method,
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          if (slot != null) ...[
            const SizedBox(height: 4),
            Text(
              '${slot.date} · ${slot.startTime.substring(0, 5)}–${slot.endTime.substring(0, 5)}',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ],
      ),
    );
  }
}

class _SuccessGlyph extends StatelessWidget {
  const _SuccessGlyph({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 140,
          height: 140,
          decoration: BoxDecoration(
            color: colors.brand.withValues(alpha: 0.10),
            shape: BoxShape.circle,
          ),
        ).animate().scale(
          begin: const Offset(0.6, 0.6),
          duration: 500.ms,
          curve: Curves.easeOutBack,
        ),
        Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: colors.brand,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: colors.brand.withValues(alpha: 0.45),
                    blurRadius: 24,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedTick02,
                  size: 48,
                  color: colors.background,
                ),
              ),
            )
            .animate()
            .scale(
              begin: const Offset(0.4, 0.4),
              duration: 500.ms,
              delay: 100.ms,
              curve: Curves.easeOutBack,
            )
            .fadeIn(duration: 300.ms, delay: 100.ms),
      ],
    );
  }
}

class _ReferenceChips extends StatelessWidget {
  const _ReferenceChips({required this.refs, required this.colors});
  final List<String> refs;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    if (refs.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        for (final ref in refs)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedShoppingBag03,
                  size: 13,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: 6),
                Text(
                  ref,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.colors,
    required this.onTap,
  });
  final String label;
  final List<List<dynamic>> icon;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: Container(
          height: 56,
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.brand,
            borderRadius: AppRadius.borderXl,
            boxShadow: [
              BoxShadow(
                color: colors.brand.withValues(alpha: 0.4),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              HugeIcon(icon: icon, size: 18, color: colors.background),
              const SizedBox(width: 8),
              Text(
                label,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.background,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GhostButton extends StatelessWidget {
  const _GhostButton({
    required this.label,
    required this.colors,
    required this.onTap,
  });
  final String label;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: Container(
          height: 52,
          width: double.infinity,
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppTypography.bodyBold.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
