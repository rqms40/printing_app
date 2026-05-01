import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class PrinterLimitsCard extends StatelessWidget {
  const PrinterLimitsCard({
    super.key,
    required this.printerName,
    required this.widthMm,
    required this.depthMm,
    required this.heightMm,
    this.modelWidthMm,
    this.modelDepthMm,
    this.modelHeightMm,
    required this.fits,
  });

  final String printerName;
  final int widthMm;
  final int depthMm;
  final int heightMm;
  final double? modelWidthMm;
  final double? modelDepthMm;
  final double? modelHeightMm;
  final bool fits;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final widthCm = (widthMm / 10).toStringAsFixed(0);
    final depthCm = (depthMm / 10).toStringAsFixed(0);
    final heightCm = (heightMm / 10).toStringAsFixed(0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.brand, width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedPrinter,
            size: 28,
            color: colors.brand,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Temporary',
                  style: AppTypography.caption.copyWith(
                    color: colors.brand,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '3D Printer Limitations',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Our printer can only print $widthCm × $depthCm × $heightCm cm '
                  '($widthMm × $depthMm × $heightMm mm).',
                  style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
                if (modelWidthMm != null &&
                    modelDepthMm != null &&
                    modelHeightMm != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Your file: ${(modelWidthMm! / 10).toStringAsFixed(1)} × '
                    '${(modelDepthMm! / 10).toStringAsFixed(1)} × '
                    '${(modelHeightMm! / 10).toStringAsFixed(1)} cm',
                    style: AppTypography.caption.copyWith(
                      color: fits ? colors.success : colors.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
