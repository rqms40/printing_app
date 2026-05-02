import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// 16:9 photo upload card.
///
/// Empty state  : dashed border, camera icon + label.
/// Selected state: thumbnail (web: from [photoBytes]; native: from [photoFile])
///                 with a "Replace" pill in the top-right corner.
/// Uploading    : thumbnail dimmed + circular progress overlay showing %.
/// Error        : thumbnail dimmed + inline "Retry" button.
/// Done         : thumbnail + green check badge.
class BetaPhotoUploadCard extends StatelessWidget {
  const BetaPhotoUploadCard({
    super.key,
    // --- photo source (one of the two must be set when a photo is chosen) ---
    this.photoFile,
    this.photoBytes,
    // --- state ---------------------------------------------------------------
    this.uploadProgress, // 0.0–1.0 while uploading; null otherwise
    this.uploadError,
    this.uploadDone = false,
    // --- callbacks -----------------------------------------------------------
    required this.onPick,
    required this.onReplace,
    this.onRetry,
  }) : assert(
          uploadError == null || onRetry != null,
          'onRetry must be provided when uploadError is set',
        );

  /// Native path (non-web).
  final File? photoFile;

  /// Raw bytes (web — dart:io File cannot be read on web).
  final Uint8List? photoBytes;

  /// 0.0–1.0 during upload; null when idle.
  final double? uploadProgress;

  /// Non-null when the upload failed.
  final String? uploadError;

  /// True once upload + submit succeeded.
  final bool uploadDone;

  final VoidCallback onPick;
  final VoidCallback onReplace;
  final VoidCallback? onRetry;

  bool get _hasPhoto =>
      (kIsWeb ? photoBytes != null : photoFile != null) ||
      // Tolerate the other being set on non-primary platform (edge cases)
      photoBytes != null ||
      photoFile != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: _hasPhoto ? _selectedState(colors) : _emptyState(colors),
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  Widget _emptyState(AppColorSet colors) {
    // On dark backgrounds (brand = bright yellow) the dashed border and icon
    // switch to the brand accent so the upload zone is clearly visible.
    final isDark = colors.background.computeLuminance() < 0.05;
    final borderColor = isDark
        ? colors.brand.withValues(alpha: 0.5)
        : colors.outline;
    final iconColor = isDark ? colors.brand : colors.onSurfaceDim;

    return GestureDetector(
      onTap: onPick,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: CustomPaint(
          painter: _DashedBorderPainter(color: borderColor),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.camera_alt_rounded,
                  size: 32,
                  color: iconColor,
                ),
                const SizedBox(height: 8),
                Text(
                  'Tap to add a photo of your prints',
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Selected state ───────────────────────────────────────────────────────────

  Widget _selectedState(AppColorSet colors) {
    final isUploading = uploadProgress != null;
    final hasError = uploadError != null;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Thumbnail
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: _thumbnail(),
        ),

        // Dim overlay while uploading or errored
        if (isUploading || hasError)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(color: Colors.black.withValues(alpha: 0.45)),
          ),

        // Progress indicator
        if (isUploading)
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 48,
                  height: 48,
                  child: CircularProgressIndicator(
                    value: uploadProgress,
                    strokeWidth: 3,
                    color: Colors.white,
                    backgroundColor: Colors.white24,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${((uploadProgress ?? 0) * 100).round()}%',
                  style: AppTypography.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

        // Error state
        if (hasError)
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded,
                    color: Colors.white, size: 28),
                const SizedBox(height: 6),
                Text(
                  uploadError!,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(color: Colors.white),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: onRetry,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Retry',
                      style: AppTypography.caption.copyWith(
                        color: Colors.black,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

        // Success badge
        if (uploadDone && !isUploading && !hasError)
          Positioned(
            bottom: 10,
            right: 10,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.green.shade600,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_rounded,
                      color: Colors.white, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    'Uploaded',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Replace pill (hidden while uploading)
        if (!isUploading && !hasError)
          Positioned(
            top: 10,
            right: 10,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onReplace,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Replace',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _thumbnail() {
    // Web: use Image.memory from bytes
    if (kIsWeb && photoBytes != null) {
      return Image.memory(photoBytes!, fit: BoxFit.cover);
    }
    // Native: use Image.file
    if (photoFile != null) {
      return Image.file(photoFile!, fit: BoxFit.cover);
    }
    // Fallback: bytes on native (shouldn't normally happen)
    if (photoBytes != null) {
      return Image.memory(photoBytes!, fit: BoxFit.cover);
    }
    return const SizedBox.shrink();
  }
}

/// Draws a dashed border around the widget's bounds.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dashWidth = 8.0;
    const dashSpace = 6.0;
    const strokeWidth = 1.5;
    const radius = 12.0;

    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(0, 0, size.width, size.height),
          const Radius.circular(radius),
        ),
      );

    final pathMetrics = path.computeMetrics().toList();
    for (final metric in pathMetrics) {
      double distance = 0;
      bool draw = true;
      while (distance < metric.length) {
        final step = draw ? dashWidth : dashSpace;
        if (draw) {
          canvas.drawPath(
            metric.extractPath(
              distance,
              distance + step < metric.length
                  ? distance + step
                  : metric.length,
            ),
            paint,
          );
        }
        distance += step;
        draw = !draw;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter old) =>
      old.color != color;
}
