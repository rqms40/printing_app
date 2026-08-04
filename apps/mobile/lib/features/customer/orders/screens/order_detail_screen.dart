import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart'
    show ordersProvider, cancellableStatuses;
import 'package:printing_app/features/customer/orders/widgets/order_status_timeline.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/features/customer/orders/widgets/admin_status_banner.dart';
import 'package:printing_app/features/customer/orders/widgets/marketplace_order_actions.dart';
import 'package:printing_app/features/customer/tracking/widgets/rider_info_card.dart';
import 'package:printing_app/utils/formatters.dart';

Order? _findOrderByRouteId(List<Order> orders, String routeId) {
  for (final order in orders) {
    if (order.id == routeId ||
        order.orderId == routeId ||
        order.batchId == routeId ||
        order.batchOrderId == routeId) {
      return order;
    }

    for (final item in order.lineItems) {
      if (item.id == routeId || item.orderId == routeId) {
        return order;
      }
    }
  }

  return null;
}

/// Detailed view of a single order.
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  /// The internal order id (e.g. 'ord_001').
  final String orderId;

  Future<void> _openOrderChat(
    BuildContext context,
    WidgetRef ref,
    Order order,
  ) async {
    final orderRef = int.tryParse(order.id) == null ? order.orderId : order.id;

    final conv = await ref
        .read(chatProvider.notifier)
        .openRiderOrderConversation(
          orderRef,
          hasAssignedRider: order.assignedRiderId != null,
        );
    if (!context.mounted) return;
    if (conv == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ref.read(chatProvider).createError ??
                'Could not open rider chat. Please try again.',
          ),
        ),
      );
      return;
    }

    final uri = Uri(
      path: '/customer/chat/${conv.id}',
      queryParameters: {
        'type': conv.type.name,
        'orderRef': order.orderId,
        'orderStatus': order.orderStatus.displayName,
      },
    );
    context.push(uri.toString());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final orders = ref.watch(ordersProvider);
    final order = _findOrderByRouteId(orders, orderId);

    if (order == null) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: Text(
            'Order not found',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Text(
              'We could not find order $orderId.',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
          ),
        ),
      );
    }

    final statusHistory =
        MockData.orderStatusHistory.where((h) => h.orderId == order.id).toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final isCancellable = cancellableStatuses.contains(order.orderStatus);

    final isOnTheWay = order.orderStatus == OrderStatus.outForDelivery;

    // Find the delivery address if applicable.
    Address? address;
    if (order.deliveryAddressId != null) {
      final matches = MockData.addresses.where(
        (a) => a.id == order.deliveryAddressId,
      );
      if (matches.isNotEmpty) address = matches.first;
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Order #${order.orderId}',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.md,
          bottom: MediaQuery.of(context).padding.bottom + AppSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // --- Admin Status Banner ---
            if (order.adminStatusNote != null) ...[
              AdminStatusBanner(
                note: order.adminStatusNote!,
                estimatedCompletionAt: order.estimatedCompletionAt,
              ),
              const SizedBox(height: 16),
            ],

            // --- Marketplace QA / payment actions (Phases 3–4) ---
            MarketplaceOrderActions(order: order)
                .animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
            if (order.orderStatus == OrderStatus.clientCorrection ||
                order.orderStatus == OrderStatus.proofApproval ||
                order.orderStatus == OrderStatus.awaitingPayment ||
                order.orderStatus == OrderStatus.supplierAccepted)
              const SizedBox(height: AppSpacing.md),

            // --- Status Timeline ---
            AppCard(
                  child: OrderStatusTimeline(
                    order: order,
                    statusHistory: statusHistory,
                  ),
                )
                .animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.md),

            // --- Estimated Completion ---
            if (order.estimatedCompletionAt != null) ...[
              AppCard(
                    child: Row(
                      children: [
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedClock01,
                          size: 20,
                          color: colors.info,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            'Estimated ready by ${formatDate(order.estimatedCompletionAt!)}',
                            style: AppTypography.body.copyWith(
                              color: colors.onSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 80.ms, curve: Curves.easeOut)
                  .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 80.ms,
                    curve: Curves.easeOut,
                  ),
              const SizedBox(height: AppSpacing.md),
            ],

            // --- Order Items ---
            _buildItemsSection(context, order, colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 160.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 160.ms,
                  curve: Curves.easeOut,
                ),
            const SizedBox(height: AppSpacing.md),

            // --- Price Breakdown ---
            _buildPriceSection(order, colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 320.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 320.ms,
                  curve: Curves.easeOut,
                ),
            const SizedBox(height: AppSpacing.md),

            // --- Payment Info ---
            _buildPaymentSection(order, colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 400.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 400.ms,
                  curve: Curves.easeOut,
                ),
            const SizedBox(height: AppSpacing.md),

            // --- Delivery Info ---
            _buildDeliverySection(order, address, colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 480.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 480.ms,
                  curve: Curves.easeOut,
                ),
            const SizedBox(height: AppSpacing.lg),

            // --- Assigned Rider ---
            RiderInfoCard(
              rider: order.assignedRider,
              onChat: order.assignedRiderId == null
                  ? null
                  : () => _openOrderChat(context, ref, order),
            ),
            const SizedBox(height: AppSpacing.md),

            // --- Action Buttons ---
            if (isOnTheWay)
              AppButton(
                label: 'Track Delivery',
                onTap: () {
                  context.push('/customer/orders/${order.id}/track');
                },
                isFullWidth: true,
                icon: HugeIcons.strokeRoundedLocation01,
              ),
            if (isCancellable)
              AppButton(
                label: 'Cancel Order',
                variant: AppButtonVariant.ghost,
                onTap: () {
                  ConfirmationDialog.show(
                    context,
                    title: 'Cancel Order',
                    message:
                        'Are you sure you want to cancel order ${order.orderId}? This action cannot be undone.',
                    confirmLabel: 'Cancel Order',
                    cancelLabel: 'Keep Order',
                    onConfirm: () async {
                      await ref
                          .read(ordersProvider.notifier)
                          .cancelOrder(order.id);
                      await ref.read(authProvider.notifier).refreshProfile();
                      if (!context.mounted) return;
                      Navigator.of(context).pop(); // close dialog
                    },
                    onCancel: () => Navigator.of(context).pop(),
                  );
                },
                isFullWidth: true,
              ),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }

  Widget _buildItemsSection(
    BuildContext context,
    Order order,
    AppColorSet colors,
  ) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${order.orderTypeLabel} · ${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'}',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...order.lineItems.asMap().entries.map((entry) {
            final index = entry.key + 1;
            final item = entry.value;
            return Padding(
              padding: EdgeInsets.only(
                bottom: index == order.itemCount ? 0 : AppSpacing.md,
              ),
              child: _buildOrderItem(context, item, index, colors),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildOrderItem(
    BuildContext context,
    OrderLineItem item,
    int index,
    AppColorSet colors,
  ) {
    final fileName = item.fileName;
    final extension = fileName?.split('.').last.toUpperCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            HugeIcon(
              icon: item.category == '3d'
                  ? HugeIcons.strokeRoundedCube
                  : HugeIcons.strokeRoundedFile02,
              size: 20,
              color: colors.onSurfaceDim,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                fileName ?? 'Print job $index',
                style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (extension != null)
              StatusBadge(
                label: extension,
                variant: StatusBadgeVariant.neutral,
              ),
            if (item.fileMetadataId != null && fileName != null)
              TextButton.icon(
                onPressed: () => FilePreviewSheet.show(
                  context,
                  fileId: item.fileMetadataId!,
                  fileName: fileName,
                  mimeType: _mimeFromExtension(
                    fileName.split('.').last.toLowerCase(),
                  ),
                ),
                icon: Icon(
                  Icons.visibility_outlined,
                  size: 16,
                  color: colors.accent,
                ),
                label: Text(
                  'Preview',
                  style: AppTypography.caption.copyWith(color: colors.accent),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        _specRow('Type', _itemCategoryLabel(item.category), colors),
        _specRow('Quantity', '${item.quantity}', colors),
        ..._itemSpecRows(item, colors),
        if (item.specialInstructions != null)
          _specRow(
            'Special Instructions / Notes',
            item.specialInstructions!,
            colors,
            multiline: true,
          ),
        _specRow('Item Subtotal', formatCurrency(item.totalPrice), colors),
      ],
    );
  }

  Widget _specRow(
    String label,
    String value,
    AppColorSet colors, {
    bool multiline = false,
  }) {
    if (multiline) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: AppTypography.body.copyWith(color: colors.onSurface),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(width: AppSpacing.md),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTypography.body.copyWith(color: colors.onSurface),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _itemSpecRows(OrderLineItem item, AppColorSet colors) {
    if (item.specDisplayValues.isNotEmpty) {
      return item.specDisplayValues.entries
          .where((entry) => entry.value.trim().isNotEmpty)
          .map(
            (entry) =>
                _specRow(_humanizeSpecKey(entry.key), entry.value, colors),
          )
          .toList();
    }

    final paperSpecs = item.paperSpecs;
    if (paperSpecs != null) {
      return [
        _specRow('Paper Size', paperSpecs.paperSize.displayName, colors),
        _specRow('Color Mode', paperSpecs.colorMode.displayName, colors),
        _specRow('Media Type', paperSpecs.mediaType.displayName, colors),
        _specRow('Print Sides', paperSpecs.printSides.displayName, colors),
        _specRow('Binding', paperSpecs.binding.displayName, colors),
      ];
    }

    final threeDSpecs = item.threeDSpecs;
    if (threeDSpecs != null) {
      return [
        _specRow('File Format', threeDSpecs.fileFormat.displayName, colors),
        _specRow('Material', threeDSpecs.material.displayName, colors),
        _specRow('Color', threeDSpecs.color, colors),
        _specRow('Infill', '${threeDSpecs.infillPercentage}%', colors),
        _specRow('Layer Height', '${threeDSpecs.layerHeight}mm', colors),
        _specRow('Supports', threeDSpecs.supports ? 'Yes' : 'No', colors),
        if (threeDSpecs.notes != null)
          _specRow('Notes', threeDSpecs.notes!, colors),
      ];
    }

    return const [];
  }

  String _itemCategoryLabel(String category) {
    if (category == '3d') return '3D Print';
    if (category == 'paper') return 'Paper Print';
    return category;
  }

  String _humanizeSpecKey(String key) {
    return key
        .split('_')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }

  String _mimeFromExtension(String ext) {
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'tif':
      case 'tiff':
        return 'image/tiff';
      case 'pdf':
        return 'application/pdf';
      case 'stl':
        return 'model/stl';
      case 'obj':
        return 'model/obj';
      case '3mf':
        return 'model/3mf';
      case 'glb':
        return 'model/gltf-binary';
      case 'gltf':
        return 'model/gltf+json';
      default:
        return 'application/octet-stream';
    }
  }

  Widget _buildPriceSection(Order order, AppColorSet colors) {
    final printingCost = order.totalPrice;
    final total = order.totalPrice + order.deliveryFee;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Price Breakdown',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          _specRow('Printing Cost', formatCurrency(printingCost), colors),
          _specRow('Delivery Fee', formatCurrency(order.deliveryFee), colors),
          const Divider(),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Total',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                Text(
                  formatCurrency(total),
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentSection(Order order, AppColorSet colors) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              StatusBadge(
                label: order.paymentMethod.displayName,
                variant: StatusBadgeVariant.neutral,
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusBadge(
                label: order.paymentStatus.displayName,
                variant: _paymentBadgeVariant(order.paymentStatus),
              ),
            ],
          ),
        ],
      ),
    );
  }

  StatusBadgeVariant _paymentBadgeVariant(PaymentStatus status) {
    switch (status) {
      case PaymentStatus.paid:
        return StatusBadgeVariant.success;
      case PaymentStatus.pending:
        return StatusBadgeVariant.warning;
      case PaymentStatus.failed:
        return StatusBadgeVariant.error;
      case PaymentStatus.refunded:
        return StatusBadgeVariant.info;
    }
  }

  Widget _buildDeliverySection(
    Order order,
    Address? address,
    AppColorSet colors,
  ) {
    final isPickup = order.deliveryOption == 'pickup';
    final temporaryAddress = order.deliveryAddress;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isPickup ? 'Pickup' : 'Delivery',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (isPickup)
            Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedStore01,
                  size: 20,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Pickup at GRIDGO Print shop',
                    style: AppTypography.body.copyWith(color: colors.onSurface),
                  ),
                ),
              ],
            )
          else if (temporaryAddress != null || address != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedLocation01,
                  size: 20,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        temporaryAddress?.fullAddress ?? address!.fullAddress,
                        style: AppTypography.body.copyWith(
                          color: colors.onSurface,
                        ),
                      ),
                      if ((temporaryAddress?.landmark ?? address?.landmark) !=
                          null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Landmark: ${temporaryAddress?.landmark ?? address?.landmark}',
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ] else
            Text(
              'Delivery address not available',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
        ],
      ),
    );
  }
}
