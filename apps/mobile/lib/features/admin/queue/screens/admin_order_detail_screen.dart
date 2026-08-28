import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/rider_management/widgets/assignment_dialog.dart';
import 'package:printing_app/features/admin/queue/providers/queue_provider.dart';
import 'package:printing_app/features/admin/queue/widgets/status_picker.dart';
import 'package:printing_app/features/customer/orders/widgets/order_status_timeline.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/order_status_history.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/section_header.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/utils/file_helpers.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';

/// Admin detail screen for a single order.
class AdminOrderDetailScreen extends ConsumerStatefulWidget {
  const AdminOrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<AdminOrderDetailScreen> createState() =>
      _AdminOrderDetailScreenState();
}

class _AdminOrderDetailScreenState
    extends ConsumerState<AdminOrderDetailScreen> {
  final _declineReasonController = TextEditingController();

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _declineReasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final queueState = ref.watch(queueProvider);
    final order = queueState.orders.firstWhere((o) => o.id == widget.orderId);
    final history = order.statusHistory.isNotEmpty
        ? (List.of(order.statusHistory)
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)))
        : (MockData.orderStatusHistory
              .where((h) => h.orderId == order.id)
              .toList()
            ..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
    final timelineHistory = order.statusHistory.isNotEmpty
        ? List.of(order.statusHistory)
        : (MockData.orderStatusHistory
              .where((h) => h.orderId == order.id)
              .toList()
            ..sort((a, b) => a.createdAt.compareTo(b.createdAt)));

    final showAssignRider =
        order.orderStatus == OrderStatus.readyForDispatch ||
        order.orderStatus == OrderStatus.riderAssigned;
    final showAuthorizePayment =
        order.orderStatus == OrderStatus.supplierAccepted ||
        order.orderStatus == OrderStatus.awaitingPayment;
    final showAuthorizeCompletionPayment =
        (order.orderStatus == OrderStatus.delivered ||
            order.orderStatus == OrderStatus.collectedByCustomer ||
            order.orderStatus == OrderStatus.issueWindowOpen ||
            order.orderStatus == OrderStatus.completed) &&
        order.assignedSupplier != null &&
        order.assignedSupplier!.payoutDepositAuthorizedAt != null &&
        order.assignedSupplier!.payoutCompletionAuthorizedAt == null;
    final showPayRider =
        order.assignedSupplier?.payoutCompletionAuthorizedAt != null &&
        order.assignedRider != null &&
        order.assignedRider!.riderProfileId.trim().isNotEmpty;
    final lineItems = order.lineItems;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        foregroundColor: colors.onBackground,
        elevation: 0,
        title: Text(
          order.orderId,
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xl,
          vertical: AppSpacing.lg,
        ),
        children: [
          // Status and ETA
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder: (context, constraints) {
                    final picker = StatusPicker(
                      currentStatus: order.orderStatus,
                      onStatusSelected: (newStatus) {
                        ref
                            .read(queueProvider.notifier)
                            .updateOrderStatus(order.id, newStatus);
                      },
                    );
                    final label = Text(
                      'Status',
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                    );

                    if (constraints.maxWidth < 300) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          label,
                          const SizedBox(height: AppSpacing.sm),
                          SizedBox(width: double.infinity, child: picker),
                        ],
                      );
                    }

                    return Row(
                      children: [
                        label,
                        const SizedBox(width: AppSpacing.md),
                        Flexible(child: picker),
                      ],
                    );
                  },
                ),
                if (order.estimatedCompletionAt != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedClock01,
                        size: 16,
                        color: colors.onSurfaceDim,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'ETA: ${formatDateTime(order.estimatedCompletionAt!)}',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Action buttons
          if (showAuthorizePayment) ...[
            AppButton(
              label: 'Authorize Payment',
              icon: HugeIcons.strokeRoundedCreditCard,
              isFullWidth: true,
              onTap: () => _openAuthorizePayment(
                context,
                order,
                completion: false,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (showAuthorizeCompletionPayment) ...[
            AppButton(
              label: 'Authorize Payment',
              icon: HugeIcons.strokeRoundedCreditCard,
              isFullWidth: true,
              onTap: () => _openAuthorizePayment(
                context,
                order,
                completion: true,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (showPayRider) ...[
            AppButton(
              label: 'Payment for Rider',
              icon: HugeIcons.strokeRoundedDeliveryTruck02,
              isFullWidth: true,
              onTap: () {
                final riderId = order.assignedRider!.riderProfileId.trim();
                context.push('/admin/riders/payouts?riderId=$riderId');
              },
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (showAssignRider) ...[
            AppButton(
              label: 'Assign Rider',
              icon: HugeIcons.strokeRoundedDeliveryTruck02,
              isFullWidth: true,
              onTap: () {
                AssignmentDialog.show(context, orderId: order.id);
              },
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (order.orderStatus != OrderStatus.cancelled &&
              order.orderStatus != OrderStatus.delivered &&
              order.orderStatus != OrderStatus.collectedByCustomer &&
              order.orderStatus != OrderStatus.fileRejected) ...[
            AppButton(
              label: 'Decline',
              variant: AppButtonVariant.secondary,
              isFullWidth: true,
              onTap: () => _showDeclineDialog(context, order),
            ),
            const SizedBox(height: AppSpacing.md),
          ],

          SectionHeader(
            title:
                '${order.orderTypeLabel} · ${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'}',
          ),
          ...lineItems.asMap().entries.map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _buildOrderItemCard(
                context,
                entry.value,
                entry.key + 1,
                colors,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Price breakdown
          const SectionHeader(title: 'Price Breakdown'),
          AppCard(
            child: Column(
              children: [
                _priceRow('Subtotal', formatCurrency(order.totalPrice), colors),
                const SizedBox(height: AppSpacing.xs),
                _priceRow(
                  'Delivery Fee',
                  formatCurrency(order.deliveryFee),
                  colors,
                ),
                const Divider(),
                _priceRow(
                  'Total',
                  formatCurrency(order.totalPrice + order.deliveryFee),
                  colors,
                  isBold: true,
                ),
                const SizedBox(height: AppSpacing.xs),
                _priceRow(
                  'Payment',
                  '${order.paymentMethod.displayName} \u00B7 ${order.paymentStatus.displayName}',
                  colors,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Full marketplace + logistics progress (after Ready for Dispatch).
          const SectionHeader(title: 'Order progress'),
          AppCard(
            child: OrderStatusTimeline(
              order: order,
              statusHistory: timelineHistory,
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Status history
          const SectionHeader(title: 'Status History'),
          if (history.isEmpty)
            AppCard(
              child: Text(
                'No status changes recorded.',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
            )
          else
            ...history.map((h) => _buildHistoryEntry(context, h, colors)),

          const SizedBox(height: AppSpacing.xl),
        ],
      ),
    );
  }

  Widget _buildOrderItemCard(
    BuildContext context,
    OrderLineItem item,
    int index,
    AppColorSet colors,
  ) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.accent.withValues(alpha: 0.1),
                  borderRadius: AppRadius.borderSm,
                ),
                child: Center(
                  child: HugeIcon(
                    icon: item.category == '3d'
                        ? HugeIcons.strokeRoundedCube
                        : HugeIcons.strokeRoundedFile02,
                    size: 18,
                    color: colors.accent,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.fileName ?? 'Print job $index',
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_itemCategoryLabel(item.category)} · Qty ${item.quantity}',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.fileMetadataId != null && item.fileName != null)
                TextButton.icon(
                  onPressed: () => FilePreviewSheet.show(
                    context,
                    fileId: item.fileMetadataId!,
                    fileName: item.fileName!,
                    mimeType: _mimeFromExtension(
                      item.fileName!.split('.').last.toLowerCase(),
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
          ..._itemSpecRows(item, colors),
          if (item.specialInstructions != null)
            _specRow(
              'Special Instructions / Notes',
              item.specialInstructions!,
              colors,
              multiline: true,
            ),
          const Divider(),
          _specRow('Item Subtotal', formatCurrency(item.totalPrice), colors),
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
        _specRow('Media', paperSpecs.mediaType.displayName, colors),
        _specRow('Sides', paperSpecs.printSides.displayName, colors),
        _specRow('Binding', paperSpecs.binding.displayName, colors),
      ];
    }

    final threeDSpecs = item.threeDSpecs;
    if (threeDSpecs != null) {
      return [
        _specRow('Format', threeDSpecs.fileFormat.displayName, colors),
        _specRow('Material', threeDSpecs.material.displayName, colors),
        _specRow('Color', threeDSpecs.color, colors),
        _specRow('Infill', '${threeDSpecs.infillPercentage}%', colors),
        _specRow('Layer Height', '${threeDSpecs.layerHeight}mm', colors),
        _specRow('Supports', threeDSpecs.supports ? 'Yes' : 'No', colors),
        if (threeDSpecs.notes != null)
          _specRow('Notes', threeDSpecs.notes!, colors),
      ];
    }

    return [_specRow('Category', _itemCategoryLabel(item.category), colors)];
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

  Widget _specRow(
    String label,
    String value,
    AppColorSet colors, {
    bool multiline = false,
  }) {
    if (multiline) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
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
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
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

  Widget _priceRow(
    String label,
    String value,
    AppColorSet colors, {
    bool isBold = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: (isBold ? AppTypography.bodyBold : AppTypography.body)
                .copyWith(color: colors.onSurface),
          ),
          Text(
            value,
            style: (isBold ? AppTypography.bodyBold : AppTypography.body)
                .copyWith(color: colors.onBackground),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryEntry(
    BuildContext context,
    OrderStatusHistory entry,
    AppColorSet colors,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6),
              decoration: BoxDecoration(
                color: colors.accent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${entry.fromStatus.displayName} \u2192 ${entry.toStatus.displayName}',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    formatDateTime(entry.createdAt),
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  if (entry.changedByUserId != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'By: ${entry.changedByUserId}',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                  if (entry.notes != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      entry.notes!,
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

  Future<void> _openAuthorizePayment(
    BuildContext context,
    Order order, {
    bool completion = false,
  }) async {
    String? qrUrl = order.assignedSupplier?.payoutQrUrl;
    AssignedSupplierContact? supplier = order.assignedSupplier;
    try {
      final res = await ApiClient.instance.get('/admin/orders/${order.id}');
      final data = res.data;
      if (data is Map) {
        final raw = data['assigned_supplier_contact'] ??
            data['assignedSupplierContact'];
        if (raw is Map) {
          final contact = AssignedSupplierContact.fromJson(
            Map<String, dynamic>.from(raw),
          );
          supplier = contact;
          if (contact.payoutQrUrl != null &&
              contact.payoutQrUrl!.trim().isNotEmpty) {
            qrUrl = contact.payoutQrUrl;
          }
        }
      }
    } catch (_) {
      /* use list snapshot */
    }
    if (!context.mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        int? receiptFileId;
        String? receiptName;
        var uploading = false;
        var authorizing = false;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final colors = _colors(ctx);
            Future<void> uploadReceipt() async {
              final picked = await ImagePicker().pickImage(
                source: ImageSource.gallery,
                imageQuality: 85,
                maxWidth: 1600,
              );
              if (picked == null) return;
              setSheetState(() => uploading = true);
              try {
                final filename = picked.name.trim().isEmpty
                    ? 'payout-receipt.jpg'
                    : picked.name;
                final mime = DioMediaType.parse(
                  mimeTypeForExtension(getFileExtension(filename)),
                );
                final FormData form;
                if (kIsWeb) {
                  form = FormData.fromMap({
                    'purpose': 'payout_receipt',
                    'file': MultipartFile.fromBytes(
                      await picked.readAsBytes(),
                      filename: filename,
                      contentType: mime,
                    ),
                  });
                } else {
                  form = FormData.fromMap({
                    'purpose': 'payout_receipt',
                    'file': await MultipartFile.fromFile(
                      picked.path,
                      filename: filename,
                      contentType: mime,
                    ),
                  });
                }
                final uploadRes = await ApiClient.instance.post(
                  '/files/upload',
                  data: form,
                  options: Options(contentType: 'multipart/form-data'),
                );
                final idRaw = uploadRes.data is Map
                    ? (uploadRes.data as Map)['id']
                    : null;
                final id = idRaw is int
                    ? idRaw
                    : int.tryParse(idRaw?.toString() ?? '');
                if (id == null || id <= 0) {
                  throw StateError('Upload did not return a file id');
                }
                setSheetState(() {
                  receiptFileId = id;
                  receiptName = filename;
                  uploading = false;
                });
              } catch (_) {
                setSheetState(() => uploading = false);
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Receipt upload failed')),
                  );
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.xl,
                right: AppSpacing.xl,
                top: AppSpacing.lg,
                bottom:
                    MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.xl,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Authorize payment',
                      style: AppTypography.h3
                          .copyWith(color: colors.onBackground),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      completion
                          ? 'Pay the remaining 50% (${formatCurrency(((supplier?.payoutCompletionAmountMinor ?? 0) / 100).toDouble())}) to ${supplier?.businessName ?? 'the supplier'} with their QR, then upload the GRIDGO receipt.'
                          : 'Pay 50% (${formatCurrency(((supplier?.payoutDepositAmountMinor ?? 0) / 100).toDouble())}) to ${supplier?.businessName ?? 'the supplier'} with their QR, then upload the GRIDGO receipt. This starts production.',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (qrUrl != null && qrUrl.isNotEmpty) ...[
                      ClipRRect(
                        borderRadius: AppRadius.borderMd,
                        child: Image.network(
                          qrUrl,
                          height: 220,
                          width: double.infinity,
                          fit: BoxFit.contain,
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () async {
                          final uri = Uri.tryParse(qrUrl!);
                          if (uri == null) return;
                          await launchUrl(
                            uri,
                            mode: LaunchMode.externalApplication,
                          );
                        },
                        icon: const Icon(Icons.download_outlined),
                        label: const Text('Download QR'),
                      ),
                    ] else
                      Text(
                        'Supplier payout QR is missing. Ask the shop to upload it on Payouts.',
                        style: AppTypography.body
                            .copyWith(color: colors.warning),
                      ),
                    const SizedBox(height: AppSpacing.md),
                    OutlinedButton.icon(
                      onPressed: uploading ? null : uploadReceipt,
                      icon: uploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.upload_file),
                      label: Text(
                        receiptName == null
                            ? 'Upload receipt'
                            : 'Replace receipt',
                      ),
                    ),
                    if (receiptName != null)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          '$receiptName uploaded',
                          style: AppTypography.caption
                              .copyWith(color: colors.accent),
                        ),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                    AppButton(
                      label: 'Authorize payment',
                      icon: HugeIcons.strokeRoundedCreditCard,
                      isFullWidth: true,
                      isLoading: authorizing,
                      onTap: receiptFileId == null ||
                              qrUrl == null ||
                              qrUrl.isEmpty ||
                              authorizing
                          ? null
                          : () async {
                              setSheetState(() => authorizing = true);
                              final ok = await ref
                                  .read(queueProvider.notifier)
                                  .authorizePayment(
                                    order.id,
                                    receiptFileId: receiptFileId!,
                                    completion: completion,
                                  );
                              if (!ctx.mounted) return;
                              if (ok) {
                                Navigator.of(ctx).pop();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        completion
                                            ? 'Final 50% authorized — supplier is fully paid'
                                            : 'Payment authorized — production can start',
                                      ),
                                    ),
                                  );
                                }
                              } else {
                                setSheetState(() => authorizing = false);
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Could not authorize payment',
                                    ),
                                  ),
                                );
                              }
                            },
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

  void _showDeclineDialog(BuildContext context, Order order) {
    ConfirmationDialog.show(
      context,
      title: 'Decline Order',
      message: 'Are you sure you want to decline ${order.orderId}?',
      confirmLabel: 'Decline',
      cancelLabel: 'Cancel',
      content: TextField(
        controller: _declineReasonController,
        decoration: InputDecoration(
          hintText: 'Enter decline reason...',
          border: OutlineInputBorder(borderRadius: AppRadius.borderMd),
        ),
        maxLines: 3,
      ),
      onConfirm: () {
        ref
            .read(queueProvider.notifier)
            .updateOrderStatus(order.id, OrderStatus.fileRejected);
        Navigator.of(context).pop();
      },
      onCancel: () => Navigator.of(context).pop(),
    );
  }
}
