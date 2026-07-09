import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';

/// Photo upload card with a compact empty state and a 4:5 social-ready preview.
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
    this.shareImageKey,
    this.isSaving = false,
    // --- callbacks -----------------------------------------------------------
    required this.onPick,
    required this.onReplace,
    this.onRetry,
    this.onSave,
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

  /// Boundary used to render the branded 4:5 image for saving or sharing.
  final GlobalKey? shareImageKey;

  final bool isSaving;
  final VoidCallback onPick;
  final VoidCallback onReplace;
  final VoidCallback? onRetry;
  final VoidCallback? onSave;

  bool get _hasPhoto =>
      (kIsWeb ? photoBytes != null : photoFile != null) ||
      // Tolerate the other being set on non-primary platform (edge cases)
      photoBytes != null ||
      photoFile != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    if (!_hasPhoto) {
      return AspectRatio(aspectRatio: 16 / 9, child: _emptyState(colors));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(aspectRatio: 4 / 5, child: _selectedState(colors)),
        if (onSave != null) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              key: const ValueKey('beta-photo-save'),
              onPressed: isSaving || uploadProgress != null ? null : onSave,
              icon: isSaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      kIsWeb ? Icons.download_rounded : Icons.ios_share_rounded,
                      size: 19,
                    ),
              label: const Text(
                kIsWeb ? 'Download share image' : 'Save / share image',
                style: AppTypography.button,
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.onBackground,
                side: BorderSide(color: colors.outline),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
        ],
      ],
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
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: RepaintBoundary(key: shareImageKey, child: _shareTemplate()),
        ),

        // Dim overlay while uploading or errored
        if (isUploading || hasError)
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
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

  Widget _shareTemplate() {
    return ColoredBox(
      color: const Color(0xFF0A0A0A),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  color: const Color(0xFFFFDE58),
                  child: const Text(
                    'BETA TESTER',
                    style: TextStyle(
                      fontFamily: 'Satoshi',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0A0A0A),
                    ),
                  ),
                ),
                const Spacer(),
                const GridLogo(size: 28, foregroundColor: Color(0xFFF4F4F4)),
              ],
            ),
            const SizedBox(height: 14),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: SizedBox.expand(child: _thumbnail()),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'PRINTED WITH GRIDGO',
              style: TextStyle(
                fontFamily: 'Poppins',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Color(0xFFF4F4F4),
              ),
            ),
            const SizedBox(height: 4),
            const Row(
              children: [
                Expanded(
                  child: Text(
                    "Davao's print delivery, simplified.",
                    style: TextStyle(
                      fontFamily: 'Satoshi',
                      fontSize: 12,
                      color: Color(0xFF9A9A9A),
                    ),
                  ),
                ),
                Text(
                  '#GRIDGOprint',
                  style: TextStyle(
                    fontFamily: 'Satoshi',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFFFDE58),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
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
