import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/utils/formatters.dart';

/// Dashed-border upload card for file selection.
///
/// Shows an upload prompt when no file is selected; once a file is chosen it
/// displays the file name, size and a "Change" button.
class FileUploadCard extends StatelessWidget {
  const FileUploadCard({
    super.key,
    required this.onTap,
    this.fileName,
    this.fileSize,
    this.errorText,
    this.isUploading = false,
    this.uploadProgress = 0,
  });

  /// Called when the card is tapped (to open file picker).
  final VoidCallback onTap;

  /// Name of the selected file, or null if none.
  final String? fileName;

  /// Size in bytes of the selected file.
  final int? fileSize;

  /// Validation error message to display below the card.
  final String? errorText;

  /// Whether an upload animation is in progress.
  final bool isUploading;

  /// Upload progress from 0.0 to 1.0.
  final double uploadProgress;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final hasFile = fileName != null;
    final hasError = errorText != null && errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          onTap: isUploading ? null : onTap,
          child: CustomPaint(
            painter: _DashedBorderPainter(
              color: hasError ? colors.error : colors.outline,
              borderRadius: AppRadius.md,
            ),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                color: colors.surfaceVariant.withValues(alpha: 0.3),
                borderRadius: AppRadius.borderMd,
              ),
              child: hasFile ? _buildFileInfo(colors) : _buildPrompt(colors),
            ),
          ),
        ),
        if (isUploading) ...[
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: AppRadius.borderSm,
            child: LinearProgressIndicator(
              value: uploadProgress,
              backgroundColor: colors.surfaceDim,
              valueColor: AlwaysStoppedAnimation(colors.accent),
              minHeight: 4,
            ),
          ),
        ],
        if (hasError) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            errorText!,
            style: AppTypography.caption.copyWith(color: colors.error),
          ),
        ],
      ],
    );
  }

  Widget _buildPrompt(AppColorSet colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        HugeIcon(icon: HugeIcons.strokeRoundedFileUpload, size: 48, color: colors.onSurfaceDim),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Tap to select file',
          style: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Supported formats will be validated',
          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
      ],
    );
  }

  Widget _buildFileInfo(AppColorSet colors) {
    return Row(
      children: [
        HugeIcon(icon: HugeIcons.strokeRoundedFileValidation, size: 40, color: colors.accent),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                fileName!,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (fileSize != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  formatFileSize(fileSize!),
                  style:
                      AppTypography.caption.copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          'Change',
          style: AppTypography.bodyBold.copyWith(color: colors.accent),
        ),
      ],
    );
  }
}

/// Paints a dashed rectangular border using [CustomPainter].
class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({
    required this.color,
    required this.borderRadius,
  });

  final Color color;
  final double borderRadius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0;
      bool draw = true;
      while (distance < metric.length) {
        const dashLength = 8.0;
        const gapLength = 5.0;
        final length = draw ? dashLength : gapLength;
        final end = (distance + length).clamp(0.0, metric.length);
        if (draw) {
          final extractedPath = metric.extractPath(distance, end);
          canvas.drawPath(extractedPath, paint);
        }
        distance = end;
        draw = !draw;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      color != oldDelegate.color || borderRadius != oldDelegate.borderRadius;
}
