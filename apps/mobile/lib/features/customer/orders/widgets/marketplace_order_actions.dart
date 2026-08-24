import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/order_concern_helpers.dart';
import 'package:printing_app/features/customer/orders/widgets/order_post_delivery_actions.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/utils/formatters.dart';

export 'package:printing_app/features/customer/orders/widgets/order_concern_helpers.dart';

/// Split free-text Ops notes into checklist-style bullets for client review.
List<String> correctionChecklistItems(Order order) {
  final chunks = <String>[];
  void add(String? raw) {
    final text = raw?.trim();
    if (text == null || text.isEmpty) return;
    for (final line in text.split(RegExp(r'[\r\n]+'))) {
      final cleaned = line
          .replaceFirst(RegExp(r'^[\s\-\*\u2022\u00b7]+'), '')
          .trim();
      if (cleaned.isNotEmpty && !chunks.contains(cleaned)) {
        chunks.add(cleaned);
      }
    }
  }

  add(order.adminNotes);
  add(order.adminStatusNote);
  return chunks;
}

/// Client-facing marketplace gates: correction / proof / pay wait / report concern.
class MarketplaceOrderActions extends ConsumerStatefulWidget {
  const MarketplaceOrderActions({super.key, required this.order});

  final Order order;

  @override
  ConsumerState<MarketplaceOrderActions> createState() =>
      _MarketplaceOrderActionsState();
}

class _MarketplaceOrderActionsState
    extends ConsumerState<MarketplaceOrderActions> {
  bool _busy = false;
  int? _qrReceiptFileId;
  final _rejectReasonController = TextEditingController();
  final _correctionNotesController = TextEditingController();
  final _concernNotesController = TextEditingController();
  String? _concernCategory;

  @override
  void dispose() {
    _rejectReasonController.dispose();
    _correctionNotesController.dispose();
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

  Future<int?> _uploadArtwork() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const [
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'ai',
        'psd',
        'zip',
      ],
      withData: kIsWeb,
    );
    if (result == null || result.files.isEmpty) return null;
    final file = result.files.single;
    final MultipartFile multipart;
    if (kIsWeb || file.path == null) {
      final bytes = file.bytes;
      if (bytes == null) return null;
      multipart = MultipartFile.fromBytes(bytes, filename: file.name);
    } else {
      multipart = await MultipartFile.fromFile(
        file.path!,
        filename: file.name,
      );
    }
    final formData = FormData.fromMap({'file': multipart});
    // Do not set Content-Type manually — Dio must attach multipart boundary.
    final response = await ApiClient.instance.post(
      '/files/upload',
      data: formData,
    );
    final data = response.data;
    if (data is Map) {
      final id = data['id'] ?? data['fileMetadataId'] ?? data['file_metadata_id'];
      if (id is num) return id.toInt();
      if (id is String) return int.tryParse(id);
    }
    throw StateError('Upload response missing file id');
  }

  Future<int?> _uploadPaymentReceipt() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.image,
      withData: kIsWeb,
    );
    if (result == null || result.files.isEmpty) return null;
    final file = result.files.single;
    final MultipartFile multipart;
    if (kIsWeb || file.path == null) {
      final bytes = file.bytes;
      if (bytes == null) return null;
      multipart = MultipartFile.fromBytes(bytes, filename: file.name);
    } else {
      multipart = await MultipartFile.fromFile(
        file.path!,
        filename: file.name,
      );
    }
    final formData = FormData.fromMap({
      'file': multipart,
      'purpose': 'payment_receipt',
    });
    final response = await ApiClient.instance.post(
      '/files/upload',
      data: formData,
    );
    final data = response.data;
    if (data is Map) {
      final id = data['id'] ?? data['fileMetadataId'] ?? data['file_metadata_id'];
      if (id is num) return id.toInt();
      if (id is String) return int.tryParse(id);
    }
    throw StateError('Upload response missing file id');
  }

  Future<void> _promptRejectProof() async {
    _rejectReasonController.text = 'Client requested changes';
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final colors = Theme.of(ctx).brightness == Brightness.dark
            ? AppColors.dark
            : AppColors.light;
        return AlertDialog(
          title: const Text('Request proof changes'),
          content: TextField(
            controller: _rejectReasonController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'What should Ops revise?',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
            style: AppTypography.body.copyWith(color: colors.onSurface),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () =>
                  Navigator.of(ctx).pop(_rejectReasonController.text.trim()),
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
    if (reason == null || reason.isEmpty) return;
    await _run(
      () => ref
          .read(ordersProvider.notifier)
          .rejectProof(widget.order.id, reason: reason),
      'Returned for correction',
    );
  }

  Future<void> _submitConcern() async {
    final category = _concernCategory;
    if (category == null || category.isEmpty) {
      await _snack('Choose a concern type to continue', error: true);
      return;
    }
    final notes = _concernNotesController.text.trim();
    await _run(() async {
      await ref.read(ordersProvider.notifier).reportConcern(
            widget.order.id,
            category: category,
            notes: notes.isEmpty ? null : notes,
          );
      if (mounted) {
        setState(() {
          _concernCategory = null;
          _concernNotesController.clear();
        });
        if (Navigator.canPop(context)) Navigator.pop(context);
      }
    }, 'Concern submitted — GRIDGO ops will review it');
  }

  void _showConcernModal() {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    showModalBottomSheet(
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
                bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Check your order',
                        style: AppTypography.h3.copyWith(color: colors.onSurface),
                      ),
                      IconButton(
                        icon: HugeIcon(
                          icon: HugeIcons.strokeRoundedCancel01,
                          size: 24,
                          color: colors.onSurface,
                        ),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: colors.info.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(
                        color: colors.info.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedInformationCircle,
                          size: 18,
                          color: colors.info,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            'You have 24 hours after collection or delivery to report '
                            'a material print or delivery concern. Timely reports are '
                            'reviewed by admin in Claims.',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurface,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'What went wrong?',
                    style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
                  ),
                  const SizedBox(height: AppSpacing.sm),
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
                      hintText: 'What should ops know? Photos can be added later by support.',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: 'Report a Concern',
                    isFullWidth: true,
                    icon: HugeIcons.strokeRoundedAlert02,
                    isLoading: _busy,
                    onTap: () async {
                      await _submitConcern();
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final status = order.orderStatus;

    final showCorrection = status == OrderStatus.clientCorrection;
    final showProof = status == OrderStatus.proofApproval;
    // Payment is authorized by ops/super admin — client only sees wait state.
    final showPayWait =
        status == OrderStatus.awaitingPayment ||
        status == OrderStatus.supplierAccepted;
    final showReportConcern = canReportConcern(status);
    final quoted = order.assignedSupplier?.hasQuotedPrice == true;
    final quoteConfirmed = order.assignedSupplier?.isQuoteConfirmed == true;
    final showQuoteWait =
        status == OrderStatus.supplierAssigned && !quoted;
    final showQuoteConfirm =
        status == OrderStatus.supplierAssigned && quoted && !quoteConfirmed;

    if (!showCorrection &&
        !showProof &&
        !showPayWait &&
        !showReportConcern &&
        !showQuoteWait &&
        !showQuoteConfirm) {
      return const SizedBox.shrink();
    }

    final settings =
        ref.watch(deliveryFeeSettingsProvider).asData?.value ??
        DeliveryFeeSettings.fallback;
    final printCost = settings.printingCostOf(order);
    final totalDue = settings.customerFacingTotalOf(order);
    final needsQrReceipt = order.paymentMethod.requiresPaymentReceipt;
    final title = showCorrection
        ? 'Artwork correction needed'
        : showProof
            ? 'Proof approval needed'
            : showQuoteConfirm
                ? 'Pay the final print price'
                : showQuoteWait
                    ? 'Waiting for the supplier price'
                    : showReportConcern
                        ? 'Check your order'
                        : 'Waiting for payment authorization';
    final body = showCorrection
        ? 'Ops listed issues below. Upload a revised file to send the job back to QA.'
        : showProof
            ? 'Review the proof notes, then approve for matching or request changes.'
            : showQuoteConfirm
                ? 'The supplier quoted ${formatCurrency(printCost)}'
                    '${order.deliveryFee > 0 ? ' plus ${formatCurrency(order.deliveryFee)} delivery' : ''}. '
                    'Pay ${formatCurrency(totalDue)} now so they can accept the job.'
                : showQuoteWait
                    ? 'GRIDGO assigned a supplier. Catalog prices can still change. '
                        'You will pay here when they send the final price.'
                    : showReportConcern
                        ? 'Please inspect your print. If anything is wrong (quality, damage, '
                            'missing pieces, packaging), report a concern within 24 hours. '
                            'GRIDGO ops will review claims in the Claims queue.'
                        : 'The supplier accepted this job. GRIDGO ops will authorize payment '
                            'so production can start. You do not need to take action here.';

    final checklist = showCorrection || showProof
        ? correctionChecklistItems(order)
        : const <String>[];

    final icon = showReportConcern
        ? HugeIcons.strokeRoundedAlert02
        : showQuoteConfirm
            ? HugeIcons.strokeRoundedCheckmarkCircle02
            : showQuoteWait || showPayWait
                ? HugeIcons.strokeRoundedClock01
                : showProof
                    ? HugeIcons.strokeRoundedCheckmarkCircle02
                    : HugeIcons.strokeRoundedFileEdit;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: HugeIcon(
                  icon: icon,
                  size: 22,
                  color: colors.brand,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.h3.copyWith(color: colors.onSurface),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          // Check your order logic moved to bottom sheet (Return/Refund)
          if (showPayWait) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.info.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: colors.info.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HugeIcon(
                    icon: HugeIcons.strokeRoundedInformationCircle,
                    size: 18,
                    color: colors.info,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Ops has a 24-hour window to authorize Pilot Credits or '
                      'eligible COD after supplier accept. Production starts once authorized.',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (checklist.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              showCorrection ? 'Ops checklist' : 'Ops notes',
              style: AppTypography.bodyBold.copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: AppSpacing.sm),
            for (final item in checklist) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedAlert02,
                        size: 16,
                        color: colors.warning,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        item,
                        style: AppTypography.body.copyWith(
                          color: colors.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ] else if ((order.adminStatusNote != null &&
                  order.adminStatusNote!.trim().isNotEmpty) ||
              (order.adminNotes != null &&
                  order.adminNotes!.trim().isNotEmpty)) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              order.adminNotes?.trim().isNotEmpty == true
                  ? order.adminNotes!
                  : order.adminStatusNote!,
              style: AppTypography.caption.copyWith(color: colors.warning),
            ),
          ],
          if (showCorrection) ...[
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _correctionNotesController,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Notes for Ops (optional)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          if (_busy)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: CircularProgressIndicator(),
              ),
            )
          else if (showCorrection)
            AppButton(
              label: 'Upload revised artwork',
              isFullWidth: true,
              icon: HugeIcons.strokeRoundedUpload03,
              onTap: () => _run(() async {
                final fileId = await _uploadArtwork();
                if (fileId == null) return;
                final notes = _correctionNotesController.text.trim();
                await ref.read(ordersProvider.notifier).resubmitCorrection(
                      order.id,
                      fileMetadataId: fileId,
                      notes: notes.isEmpty ? null : notes,
                    );
              }, 'Resubmitted to Ops QA'),
            )
          else if (showQuoteConfirm) ...[
            if (needsQrReceipt) ...[
              AppButton(
                label: _qrReceiptFileId == null
                    ? 'Upload payment receipt'
                    : 'Receipt uploaded',
                variant: AppButtonVariant.secondary,
                isFullWidth: true,
                icon: HugeIcons.strokeRoundedUpload03,
                onTap: () async {
                  if (_busy) return;
                  setState(() => _busy = true);
                  try {
                    final fileId = await _uploadPaymentReceipt();
                    if (fileId == null) return;
                    if (!mounted) return;
                    setState(() => _qrReceiptFileId = fileId);
                    await _snack('Payment receipt uploaded');
                  } catch (e) {
                    await _snack('Action failed: $e', error: true);
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            AppButton(
              label: order.paymentMethod == PaymentMethod.cod
                  ? 'Confirm ${formatCurrency(totalDue)} COD'
                  : 'Pay ${formatCurrency(totalDue)}',
              isFullWidth: true,
              icon: HugeIcons.strokeRoundedCheckmarkCircle02,
              onTap: () {
                if (needsQrReceipt && _qrReceiptFileId == null) {
                  _snack('Upload your QR payment receipt first', error: true);
                  return;
                }
                _run(
                  () => ref.read(ordersProvider.notifier).confirmSupplierQuote(
                        order.id,
                        qrReceiptFileId: _qrReceiptFileId,
                      ),
                  'Payment received. The supplier can now accept.',
                );
              },
            ),
          ]
          else if (showProof) ...[
            AppButton(
              label: 'Approve proof',
              isFullWidth: true,
              icon: HugeIcons.strokeRoundedCheckmarkCircle02,
              onTap: () => _run(
                () => ref.read(ordersProvider.notifier).approveProof(order.id),
                'Proof approved — matching can begin',
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'Request changes',
              variant: AppButtonVariant.ghost,
              isFullWidth: true,
              onTap: _promptRejectProof,
            ),
          ] else if (showReportConcern) ...[
            // Compact responsive buttons (shared with My Orders list).
            OrderPostDeliveryActions(order: order, showIntro: false),
          ]
        ],
      ),
    );
  }
}
