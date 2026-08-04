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
      await _snack(okMessage);
    } catch (e) {
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
    final response = await ApiClient.instance.post(
      '/files/upload',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    final data = response.data;
    if (data is Map) {
      final id = data['id'] ?? data['fileMetadataId'] ?? data['file_metadata_id'];
      if (id is num) return id.toInt();
      if (id is String) return int.tryParse(id);
    }
    throw StateError('Upload response missing file id');
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
                  icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                  size: 22,
                  color: colors.brand,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Marketplace action required',
                  style: AppTypography.h3.copyWith(color: colors.onSurface),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            showCorrection
                ? 'Ops asked for artwork correction. Upload a revised file to send the job back to QA.'
                : showProof
                ? 'Ops flagged this job for proof approval. Review and approve or request changes.'
                : 'Supplier accepted this job. Authorize Pilot Credits or eligible COD to start production.',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          if (order.adminStatusNote != null &&
              order.adminStatusNote!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              order.adminStatusNote!,
              style: AppTypography.caption.copyWith(color: colors.warning),
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
                await ref
                    .read(ordersProvider.notifier)
                    .resubmitCorrection(order.id, fileMetadataId: fileId);
              }, 'Resubmitted to Ops QA'),
            )
          else if (showProof) ...[
            AppButton(
              label: 'Approve proof',
              isFullWidth: true,
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
              onTap: () => _run(
                () => ref
                    .read(ordersProvider.notifier)
                    .rejectProof(order.id, reason: 'Client requested changes'),
                'Returned for correction',
              ),
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
