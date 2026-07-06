import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

class ProofOfDeliverySheet extends StatefulWidget {
  const ProofOfDeliverySheet({super.key, required this.orderRef});

  final String orderRef;

  @override
  State<ProofOfDeliverySheet> createState() => _ProofOfDeliverySheetState();
}

class _ProofOfDeliverySheetState extends State<ProofOfDeliverySheet> {
  final _points = <Offset?>[];
  var _mode = 'signature';
  var _isUploading = false;
  String? _error;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool get _hasSignature => _points.whereType<Offset>().length >= 2;

  Future<void> _submitSignature() async {
    if (!_hasSignature) return;
    final payload = {
      'format': 'gridgo-signature-v1',
      'points': _points
          .map((point) => point == null ? null : [point.dx, point.dy])
          .toList(),
    };
    Navigator.of(
      context,
    ).pop({'type': 'signature', 'signatureData': jsonEncode(payload)});
  }

  Future<void> _capturePhoto() async {
    setState(() {
      _error = null;
      _isUploading = true;
    });
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
      );
      if (picked == null) {
        if (mounted) setState(() => _isUploading = false);
        return;
      }

      final form = FormData.fromMap({
        'purpose': 'proof-of-delivery',
        'file': await MultipartFile.fromFile(
          picked.path,
          filename: picked.name,
        ),
      });
      final response = await ApiClient.instance.post<Map<String, dynamic>>(
        '/files/upload',
        data: form,
        options: Options(contentType: 'multipart/form-data'),
      );
      final data = response.data ?? const <String, dynamic>{};
      final fileId = data['id'];
      if (fileId == null) {
        throw StateError('Upload did not return a file id');
      }
      if (!mounted) return;
      Navigator.of(context).pop({
        'type': 'photo',
        'fileId': fileId is int ? fileId : int.tryParse(fileId.toString()),
        'objectKey': data['objectKey'] ?? data['object_key'],
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not upload proof photo. Try a signature or retake it.';
        _isUploading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.md,
          bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Proof of Delivery',
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: HugeIcon(
                    icon: HugeIcons.strokeRoundedCancel01,
                    color: colors.onSurfaceDim,
                    size: 20,
                  ),
                ),
              ],
            ),
            Text(
              widget.orderRef,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
            const SizedBox(height: AppSpacing.md),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'signature',
                  icon: Icon(Icons.draw_rounded),
                  label: Text('Signature'),
                ),
                ButtonSegment(
                  value: 'photo',
                  icon: Icon(Icons.photo_camera_rounded),
                  label: Text('Photo'),
                ),
              ],
              selected: {_mode},
              onSelectionChanged: (value) =>
                  setState(() => _mode = value.first),
            ),
            const SizedBox(height: AppSpacing.md),
            if (_mode == 'signature') ...[
              Container(
                height: 190,
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: AppRadius.borderMd,
                  border: Border.all(color: colors.outline),
                ),
                child: GestureDetector(
                  onPanStart: (details) {
                    setState(() {
                      _points.add(details.localPosition);
                    });
                  },
                  onPanUpdate: (details) {
                    setState(() {
                      _points.add(details.localPosition);
                    });
                  },
                  onPanEnd: (_) => setState(() => _points.add(null)),
                  child: CustomPaint(
                    painter: _SignaturePainter(
                      points: _points,
                      color: colors.onBackground,
                    ),
                    child: Center(
                      child: _hasSignature
                          ? null
                          : Text(
                              'Sign here',
                              style: AppTypography.body.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Clear',
                      variant: AppButtonVariant.secondary,
                      onTap: () => setState(_points.clear),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppButton(
                      label: 'Submit proof',
                      onTap: _hasSignature ? _submitSignature : null,
                      isDisabled: !_hasSignature,
                    ),
                  ),
                ],
              ),
            ] else ...[
              AppButton(
                label: 'Take photo proof',
                icon: HugeIcons.strokeRoundedCamera01,
                isLoading: _isUploading,
                isFullWidth: true,
                onTap: _isUploading ? null : _capturePhoto,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: AppTypography.caption.copyWith(color: colors.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter({required this.points, required this.color});

  final List<Offset?> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < points.length - 1; i += 1) {
      final current = points[i];
      final next = points[i + 1];
      if (current != null && next != null) {
        canvas.drawLine(current, next, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) =>
      oldDelegate.points != points || oldDelegate.color != color;
}
