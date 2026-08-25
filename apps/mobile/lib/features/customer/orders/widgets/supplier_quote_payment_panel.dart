import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/order/widgets/payment_qr_code.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/utils/formatters.dart';

/// Pay / QR / receipt UI after the supplier sends a final price.
class SupplierQuotePaymentPanel extends ConsumerStatefulWidget {
  const SupplierQuotePaymentPanel({
    super.key,
    required this.order,
    this.showIntro = true,
  });

  final Order order;
  final bool showIntro;

  @override
  ConsumerState<SupplierQuotePaymentPanel> createState() =>
      _SupplierQuotePaymentPanelState();
}

class _SupplierQuotePaymentPanelState
    extends ConsumerState<SupplierQuotePaymentPanel> {
  bool _busy = false;
  int? _qrReceiptFileId;

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
      final id =
          data['id'] ?? data['fileMetadataId'] ?? data['file_metadata_id'];
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
    final settings =
        ref.watch(deliveryFeeSettingsProvider).asData?.value ??
        DeliveryFeeSettings.fallback;
    final printCost = settings.printingCostOf(order);
    final totalDue = settings.customerFacingTotalOf(order);
    final needsQrReceipt = order.paymentMethod.requiresPaymentReceipt;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.showIntro) ...[
          Text(
            'The supplier quoted ${formatCurrency(printCost)}'
            '${order.deliveryFee > 0 ? ' plus ${formatCurrency(order.deliveryFee)} delivery' : ''}. '
            'Pay ${formatCurrency(totalDue)} now so they can accept the job.',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (needsQrReceipt) ...[
          const PaymentQrCode(
            caption:
                'Scan or download the QR, pay the quoted amount with any '
                'InstaPay bank or e-wallet, then upload your receipt.',
          ),
          const SizedBox(height: AppSpacing.sm),
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
        if (_busy)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: CircularProgressIndicator(),
            ),
          )
        else
          AppButton(
            label: order.paymentMethod == PaymentMethod.cod
                ? 'Confirm ${formatCurrency(totalDue)} COD'
                : 'Pay ${formatCurrency(totalDue)}',
            isFullWidth: true,
            icon: HugeIcons.strokeRoundedCheckmarkCircle02,
            onTap: () async {
              if (needsQrReceipt && _qrReceiptFileId == null) {
                await _snack(
                  'Upload your QR payment receipt first',
                  error: true,
                );
                return;
              }
              if (_busy) return;
              setState(() => _busy = true);
              try {
                await ref.read(ordersProvider.notifier).confirmSupplierQuote(
                      order.id,
                      qrReceiptFileId: _qrReceiptFileId,
                    );
                if (!mounted) return;
                await _snack(
                  'Payment received. The supplier can now accept.',
                );
              } catch (e) {
                if (!mounted) return;
                await _snack('Action failed: $e', error: true);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
      ],
    );
  }
}
