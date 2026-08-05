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
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';

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

/// Client-facing marketplace gates visible after Ops QA (correction / proof / pay).
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
  final _rejectReasonController = TextEditingController();
  final _correctionNotesController = TextEditingController();

  @override
  void dispose() {
    _rejectReasonController.dispose();
    _correctionNotesController.dispose();
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

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final status = order.orderStatus;

    final showCorrection = status == OrderStatus.clientCorrection;
    final showProof = status == OrderStatus.proofApproval;
    final showPay =
        status == OrderStatus.awaitingPayment ||
        status == OrderStatus.supplierAccepted;

    if (!showCorrection && !showProof && !showPay) {
      return const SizedBox.shrink();
    }

    final title = showCorrection
        ? 'Artwork correction needed'
        : showProof
        ? 'Proof approval needed'
        : 'Authorize payment to start production';
    final body = showCorrection
        ? 'Ops listed issues below. Upload a revised file to send the job back to QA.'
        : showProof
        ? 'Review the proof notes, then approve for matching or request changes.'
        : 'Supplier accepted this job. You have 24 hours to authorize Pilot Credits or eligible COD before the hold expires.';

    final checklist = showCorrection || showProof
        ? correctionChecklistItems(order)
        : const <String>[];

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
                  icon: showPay
                      ? HugeIcons.strokeRoundedCreditCard
                      : showProof
                      ? HugeIcons.strokeRoundedCheckmarkCircle02
                      : HugeIcons.strokeRoundedFileEdit,
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
          if (showPay) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: colors.warning.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HugeIcon(
                    icon: HugeIcons.strokeRoundedClock01,
                    size: 18,
                    color: colors.warning,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      '24-hour payment window after supplier accept. Authorize now to keep production on schedule.',
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
          ] else if (showPay)
            AppButton(
              label: 'Authorize payment',
              isFullWidth: true,
              icon: HugeIcons.strokeRoundedCreditCard,
              onTap: () => _run(() async {
                await ApiClient.instance.post(
                  '/orders/${order.id}/authorize-payment',
                );
                await ref.read(ordersProvider.notifier).refreshOrders();
              }, 'Payment authorized — production can start'),
            ),
        ],
      ),
    );
  }
}
