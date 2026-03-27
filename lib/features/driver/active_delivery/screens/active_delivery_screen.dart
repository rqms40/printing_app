import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/active_delivery/widgets/delivery_map_view.dart';
import 'package:printing_app/features/driver/active_delivery/widgets/status_action_bar.dart';
import 'package:printing_app/features/driver/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Full-screen active delivery view with map, customer info, and checkpoint actions.
class ActiveDeliveryScreen extends ConsumerWidget {
  const ActiveDeliveryScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final deliveriesState = ref.watch(deliveriesProvider);
    final notifier = ref.read(deliveriesProvider.notifier);
    final activeDelivery = deliveriesState.activeDelivery;

    if (activeDelivery == null) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: Text(
            'Active Delivery',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          elevation: 0,
        ),
        body: const EmptyState(
          heading: 'No active delivery',
          body: 'Accept a delivery assignment to start tracking.',
          icon: HugeIcons.strokeRoundedDeliveryTruck02,
        ),
      );
    }

    final order = MockData.orders.firstWhere(
      (o) => o.id == activeDelivery.orderId,
      orElse: () => MockData.orders.first,
    );

    final Address? address = order.deliveryAddressId != null
        ? MockData.addresses.cast<dynamic>().firstWhere(
              (a) => a.id == order.deliveryAddressId,
              orElse: () => null,
            )
        : null;

    // Find the customer user
    final customer = MockData.users.firstWhere(
      (u) => u.id == order.userId,
      orElse: () => MockData.customerMaria,
    );

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          order.orderId,
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Map placeholder (takes up available space)
          const Expanded(
            child: DeliveryMapView(),
          ),

          // Bottom overlay card with customer info
          AppCard(
            shadow: const [],
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Customer name
                Row(
                  children: [
                    Icon(HugeIcons.strokeRoundedUser, size: 18, color: colors.onSurface),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      customer.fullName ?? 'Customer',
                      style: AppTypography.bodyBold
                          .copyWith(color: colors.onBackground),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),

                // Phone
                Row(
                  children: [
                    Icon(HugeIcons.strokeRoundedCall, size: 18, color: colors.onSurface),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      customer.phoneNumber ?? 'No phone',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurface),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),

                // Address
                if (address != null) ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(HugeIcons.strokeRoundedLocation01,
                          size: 18, color: colors.onSurface),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          address.fullAddress,
                          style: AppTypography.body
                              .copyWith(color: colors.onSurface),
                        ),
                      ),
                    ],
                  ),
                  if (address.landmark != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Padding(
                      padding: const EdgeInsets.only(left: 26),
                      child: Text(
                        address.landmark!,
                        style: AppTypography.bodyBold
                            .copyWith(color: colors.onBackground),
                      ),
                    ),
                  ],
                ],
                const SizedBox(height: AppSpacing.sm),

                // Current status indicator
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.info.withValues(alpha: 0.12),
                    borderRadius: AppRadius.borderFull,
                  ),
                  child: Text(
                    activeDelivery.status.displayName,
                    style: AppTypography.caption.copyWith(
                      color: colors.info,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                // Swipe-to-confirm for "Delivered" status
                if (activeDelivery.status == DeliveryStatus.arrived) ...[
                  const SizedBox(height: AppSpacing.md),
                  _SwipeToConfirm(
                    onConfirmed: () =>
                        notifier.advanceCheckpoint(activeDelivery.id),
                  ),
                ],
              ],
            ),
          ),

          // Status action bar
          if (activeDelivery.status != DeliveryStatus.arrived)
            StatusActionBar(
              currentStatus: activeDelivery.status,
              onAdvance: () =>
                  notifier.advanceCheckpoint(activeDelivery.id),
            ),
        ],
      ),
    );
  }
}

/// Swipe-to-confirm widget for the final delivery step.
class _SwipeToConfirm extends StatefulWidget {
  const _SwipeToConfirm({required this.onConfirmed});

  final VoidCallback onConfirmed;

  @override
  State<_SwipeToConfirm> createState() => _SwipeToConfirmState();
}

class _SwipeToConfirmState extends State<_SwipeToConfirm> {
  double _dragExtent = 0;
  static const double _threshold = 0.7;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxDrag = constraints.maxWidth - 64;
        final progress = (_dragExtent / maxDrag).clamp(0.0, 1.0);

        return Container(
          height: 56,
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: AppRadius.borderFull,
          ),
          child: Stack(
            children: [
              // Background progress
              FractionallySizedBox(
                widthFactor: progress,
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.success.withValues(alpha: 0.2),
                    borderRadius: AppRadius.borderFull,
                  ),
                ),
              ),

              // Label
              Center(
                child: Text(
                  'Swipe to Confirm Delivery',
                  style: AppTypography.button
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ),

              // Draggable thumb
              Positioned(
                left: _dragExtent,
                top: 4,
                child: GestureDetector(
                  onHorizontalDragUpdate: (details) {
                    setState(() {
                      _dragExtent =
                          (_dragExtent + details.delta.dx).clamp(0, maxDrag);
                    });
                  },
                  onHorizontalDragEnd: (details) {
                    if (progress >= _threshold) {
                      widget.onConfirmed();
                    }
                    setState(() {
                      _dragExtent = 0;
                    });
                  },
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: colors.accent,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      HugeIcons.strokeRoundedCheckmarkBadge01,
                      color: colors.background,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
