import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
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
import 'package:printing_app/utils/formatters.dart';

/// Detailed view of a single order.
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  /// The internal order id (e.g. 'ord_001').
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final orders = ref.watch(ordersProvider);
    final order = orders.firstWhere(
      (o) => o.id == orderId,
      orElse: () => orders.first,
    );

    final statusHistory =
        MockData.orderStatusHistory.where((h) => h.orderId == order.id).toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final isCancellable = cancellableStatuses.contains(order.orderStatus);

    final isOnTheWay = order.orderStatus == OrderStatus.onTheWay;

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

            // --- Specs Section ---
            _buildSpecsSection(order, colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 160.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 160.ms,
                  curve: Curves.easeOut,
                ),
            const SizedBox(height: AppSpacing.md),

            // --- File Info ---
            if (order.fileName != null) ...[
              _buildFileSection(context, order, colors)
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: 240.ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 240.ms,
                    curve: Curves.easeOut,
                  ),
              const SizedBox(height: AppSpacing.md),
            ],

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

  Widget _buildSpecsSection(Order order, AppColorSet colors) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Specifications',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (order.paperSpecs != null) ...[
            _specRow(
              'Paper Size',
              order.paperSpecs!.paperSize.displayName,
              colors,
            ),
            _specRow(
              'Color Mode',
              order.paperSpecs!.colorMode.displayName,
              colors,
            ),
            _specRow(
              'Media Type',
              order.paperSpecs!.mediaType.displayName,
              colors,
            ),
            _specRow(
              'Print Sides',
              order.paperSpecs!.printSides.displayName,
              colors,
            ),
            _specRow('Binding', order.paperSpecs!.binding.displayName, colors),
          ],
          if (order.threeDSpecs != null) ...[
            _specRow(
              'File Format',
              order.threeDSpecs!.fileFormat.displayName,
              colors,
            ),
            _specRow(
              'Material',
              order.threeDSpecs!.material.displayName,
              colors,
            ),
            _specRow('Color', order.threeDSpecs!.color, colors),
            _specRow(
              'Infill',
              '${order.threeDSpecs!.infillPercentage}%',
              colors,
            ),
            _specRow(
              'Layer Height',
              '${order.threeDSpecs!.layerHeight}mm',
              colors,
            ),
            _specRow(
              'Supports',
              order.threeDSpecs!.supports ? 'Yes' : 'No',
              colors,
            ),
            if (order.threeDSpecs!.notes != null)
              _specRow('Notes', order.threeDSpecs!.notes!, colors),
          ],
          _specRow('Quantity', '${order.quantity}', colors),
          _specRow('Category', order.category, colors),
        ],
      ),
    );
  }

  Widget _specRow(String label, String value, AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          Text(
            value,
            style: AppTypography.body.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildFileSection(
    BuildContext context,
    Order order,
    AppColorSet colors,
  ) {
    final extension = order.fileName!.split('.').last.toUpperCase();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'File',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              HugeIcon(
                icon: HugeIcons.strokeRoundedFile01,
                size: 20,
                color: colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  order.fileName!,
                  style: AppTypography.body.copyWith(color: colors.onSurface),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              StatusBadge(
                label: extension,
                variant: StatusBadgeVariant.neutral,
              ),
              if (order.fileMetadataId != null)
                TextButton.icon(
                  onPressed: () => FilePreviewSheet.show(
                    context,
                    fileId: order.fileMetadataId!,
                    fileName: order.fileName!,
                    mimeType: _mimeFromExtension(
                      order.fileName!.split('.').last.toLowerCase(),
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
        ],
      ),
    );
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
      case 'pdf':
        return 'application/pdf';
      case 'stl':
        return 'model/stl';
      case 'obj':
        return 'model/obj';
      case '3mf':
        return 'model/3mf';
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
                    'Pickup at GRID Print shop',
                    style: AppTypography.body.copyWith(color: colors.onSurface),
                  ),
                ),
              ],
            )
          else if (address != null) ...[
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
                        address.fullAddress,
                        style: AppTypography.body.copyWith(
                          color: colors.onSurface,
                        ),
                      ),
                      if (address.landmark != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Landmark: ${address.landmark}',
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
