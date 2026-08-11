import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:share_plus/share_plus.dart';

/// GRIDGO Maya InstaPay QR.
///
/// Key is `images/…` (file at `apps/mobile/images/Payment_QR.jpg`) so Flutter
/// web fetches `assets/images/Payment_QR.jpg` — not the doubled
/// `assets/assets/images/…` path that 404s when the key starts with `assets/`.
const kPaymentQrAsset = 'images/Payment_QR.jpg';

/// QR code + download/share + digital receipt upload for QR Ph (Instapay).
class CheckoutQrPaymentSection extends ConsumerStatefulWidget {
  const CheckoutQrPaymentSection({super.key});

  @override
  ConsumerState<CheckoutQrPaymentSection> createState() =>
      _CheckoutQrPaymentSectionState();
}

class _CheckoutQrPaymentSectionState
    extends ConsumerState<CheckoutQrPaymentSection> {
  bool _uploading = false;
  bool _sharing = false;

  Future<void> _shareOrDownloadQr() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      final data = await rootBundle.load(kPaymentQrAsset);
      final bytes = data.buffer.asUint8List();
      if (kIsWeb) {
        // Web: open share sheet with bytes when supported.
        await Share.shareXFiles([
          XFile.fromData(
            bytes,
            name: 'GRIDGO_QR_Ph_Instapay.jpg',
            mimeType: 'image/jpeg',
          ),
        ], text: 'GRIDGO QR Ph (Instapay) — scan to pay');
      } else {
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/GRIDGO_QR_Ph_Instapay.jpg');
        await file.writeAsBytes(bytes, flush: true);
        await Share.shareXFiles([
          XFile(file.path, mimeType: 'image/jpeg'),
        ], text: 'GRIDGO QR Ph (Instapay) — scan to pay');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not share QR: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<void> _pickAndUploadReceipt() async {
    if (_uploading) return;
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (picked == null) return;

    setState(() => _uploading = true);
    try {
      // Ensure a real filename + image extension (web pickers often omit both).
      final rawName = picked.name.trim().isEmpty ? 'receipt.jpg' : picked.name;
      final lower = rawName.toLowerCase();
      final hasExt = lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.png') ||
          lower.endsWith('.webp');
      final filename = hasExt ? rawName : '$rawName.jpg';
      final mime = lower.endsWith('.png')
          ? DioMediaType('image', 'png')
          : lower.endsWith('.webp')
          ? DioMediaType('image', 'webp')
          : DioMediaType('image', 'jpeg');

      final FormData formData;
      if (kIsWeb) {
        final bytes = await picked.readAsBytes();
        formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(
            bytes,
            filename: filename,
            contentType: mime,
          ),
          'purpose': 'payment_receipt',
        });
      } else {
        formData = FormData.fromMap({
          'file': await MultipartFile.fromFile(
            picked.path,
            filename: filename,
            contentType: mime,
          ),
          'purpose': 'payment_receipt',
        });
      }

      final res = await ApiClient.instance.post(
        '/files/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final data = res.data;
      final id = data is Map ? data['id'] : null;
      final fileId = id is int ? id : int.tryParse(id?.toString() ?? '');
      if (fileId == null || fileId <= 0) {
        throw StateError('Upload did not return a file id');
      }

      ref.read(checkoutProvider.notifier).setQrReceipt(
            fileId: fileId,
            localPath: kIsWeb ? picked.name : picked.path,
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment receipt uploaded')),
        );
      }
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? (e.response?.data as Map)['message']?.toString() ??
              'Failed to upload receipt'
          : 'Failed to upload receipt';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload receipt: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final state = ref.watch(checkoutProvider);
    final hasReceipt = state.qrReceiptFileId != null;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: colors.outline.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Pay via QR Ph (Instapay)',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Scan or download the QR, pay with any InstaPay bank/e-wallet, '
            'then upload your digital receipt to place the order. '
            'Ops will verify the receipt before production starts.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 11,
              height: 1.35,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Single asset: assets/images/Payment_QR.jpg (natural aspect, no square crop).
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: ClipRRect(
                borderRadius: AppRadius.borderMd,
                child: Image.asset(
                  kPaymentQrAsset,
                  fit: BoxFit.fitWidth,
                  width: double.infinity,
                  filterQuality: FilterQuality.medium,
                  errorBuilder: (context, error, stackTrace) => Container(
                    height: 200,
                    color: colors.surface,
                    alignment: Alignment.center,
                    child: Text(
                      'QR image missing\n($kPaymentQrAsset)',
                      textAlign: TextAlign.center,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: _sharing ? null : _shareOrDownloadQr,
            icon: _sharing
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.brand,
                    ),
                  )
                : HugeIcon(
                    icon: HugeIcons.strokeRoundedDownload01,
                    size: 18,
                    color: colors.brand,
                  ),
            label: Text(
              _sharing ? 'Preparing…' : 'Download / Share QR',
              style: AppTypography.bodyBold.copyWith(
                color: colors.brand,
                fontSize: 13,
              ),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.brand,
              side: BorderSide(color: colors.brand.withValues(alpha: 0.5)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.icon(
            onPressed: _uploading ? null : _pickAndUploadReceipt,
            icon: _uploading
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.background,
                    ),
                  )
                : HugeIcon(
                    icon: hasReceipt
                        ? HugeIcons.strokeRoundedTick02
                        : HugeIcons.strokeRoundedImageAdd01,
                    size: 18,
                    color: colors.background,
                  ),
            label: Text(
              _uploading
                  ? 'Uploading…'
                  : hasReceipt
                  ? 'Receipt uploaded · tap to replace'
                  : 'Upload digital receipt',
              style: AppTypography.bodyBold.copyWith(
                color: colors.background,
                fontSize: 13,
              ),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: hasReceipt
                  ? const Color(0xFF1B8A4A)
                  : colors.brand,
              foregroundColor: colors.background,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.borderLg),
            ),
          ),
          if (hasReceipt) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Receipt ready. You can place your order. '
              'An admin will verify the payment shortly.',
              style: AppTypography.caption.copyWith(
                color: const Color(0xFF1B8A4A),
                fontSize: 11,
              ),
            ),
          ] else ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Receipt required before Place Order is enabled.',
              style: AppTypography.caption.copyWith(
                color: colors.error,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
