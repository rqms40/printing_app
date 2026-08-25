import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:share_plus/share_plus.dart';

/// GRIDGO Maya InstaPay QR.
///
/// Key is `images/…` (file at `apps/mobile/images/Payment_QR.jpg`) so Flutter
/// web fetches `assets/images/Payment_QR.jpg` — not the doubled
/// `assets/assets/images/…` path that 404s when the key starts with `assets/`.
const kPaymentQrAsset = 'images/Payment_QR.jpg';

/// Scan/download panel for QR Ph (Instapay). Receipt upload stays with the
/// parent (checkout vs order-details have different confirmation APIs).
class PaymentQrCode extends StatefulWidget {
  const PaymentQrCode({
    super.key,
    this.caption,
  });

  final String? caption;

  @override
  State<PaymentQrCode> createState() => _PaymentQrCodeState();
}

class _PaymentQrCodeState extends State<PaymentQrCode> {
  bool _sharing = false;

  Future<void> _shareOrDownloadQr() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      final data = await rootBundle.load(kPaymentQrAsset);
      final bytes = data.buffer.asUint8List();
      // XFile.fromData works on web and native — avoid dart:io (breaks Flutter web).
      await Share.shareXFiles([
        XFile.fromData(
          bytes,
          name: 'GRIDGO_QR_Ph_Instapay.jpg',
          mimeType: 'image/jpeg',
        ),
      ], text: 'GRIDGO QR Ph (Instapay) — scan to pay');
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

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.caption != null && widget.caption!.trim().isNotEmpty) ...[
          Text(
            widget.caption!,
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 11,
              height: 1.35,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
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
      ],
    );
  }
}
