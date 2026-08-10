import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

Future<MultipartFile> buildProofPhotoMultipart(XFile picked) async {
  final bytes = await picked.readAsBytes();
  final filename = picked.name.trim().isEmpty
      ? 'delivery-proof.jpg'
      : picked.name;
  return MultipartFile.fromBytes(bytes, filename: filename);
}

/// Rider handoff proof sheet for pickup or delivery.
///
/// Always requires a 6-digit OTP. Pickup requires a photo; delivery allows
/// photo or signature (photo preferred; optional signature with photo).
class ProofOfDeliverySheet extends StatefulWidget {
  const ProofOfDeliverySheet({
    super.key,
    required this.orderRef,
    this.kind = ProofSheetKind.delivery,
    this.initialOtp,
  });

  final String orderRef;
  final ProofSheetKind kind;

  /// Server-issued OTP to prefill (visible to rider for pilot handoff).
  final String? initialOtp;

  @override
  State<ProofOfDeliverySheet> createState() => _ProofOfDeliverySheetState();
}

enum ProofSheetKind { pickup, delivery }

class _ProofOfDeliverySheetState extends State<ProofOfDeliverySheet> {
  final _points = <Offset?>[];
  late final TextEditingController _otpController;
  late var _mode = widget.kind == ProofSheetKind.pickup ? 'photo' : 'signature';
  var _isUploading = false;
  String? _error;
  XFile? _pendingPhoto;
  Uint8List? _pendingPhotoBytes;

  @override
  void initState() {
    super.initState();
    final seed = widget.initialOtp?.trim() ?? '';
    _otpController = TextEditingController(text: seed);
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool get _hasSignature => _points.whereType<Offset>().length >= 2;

  bool get _otpValid =>
      RegExp(r'^\d{4,8}$').hasMatch(_otpController.text.trim());

  String get _title => widget.kind == ProofSheetKind.pickup
      ? 'Pickup proof'
      : 'Proof of Delivery';

  String get _otpHint => widget.kind == ProofSheetKind.pickup
      ? 'Pickup OTP (prefilled from server)'
      : 'Delivery OTP (prefilled from server)';

  bool get _otpPrefixed => (widget.initialOtp?.trim().isNotEmpty ?? false);

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _withOtp(Map<String, dynamic> proof) {
    return {...proof, 'otp': _otpController.text.trim()};
  }

  Future<void> _submitSignature() async {
    if (!_hasSignature || !_otpValid) return;
    final payload = {
      'format': 'gridgo-signature-v1',
      'points': _points
          .map((point) => point == null ? null : [point.dx, point.dy])
          .toList(),
    };
    Navigator.of(context).pop(
      _withOtp({'type': 'signature', 'signatureData': jsonEncode(payload)}),
    );
  }

  Future<void> _pickPhoto() async {
    setState(() => _error = null);
    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 82,
    );
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() {
      _pendingPhoto = picked;
      _pendingPhotoBytes = bytes;
    });
  }

  Future<void> _uploadPendingPhoto() async {
    final picked = _pendingPhoto;
    if (picked == null || !_otpValid) {
      setState(() => _error = 'Enter a valid OTP before uploading photo proof');
      return;
    }
    setState(() {
      _error = null;
      _isUploading = true;
    });
    try {
      final form = FormData.fromMap({
        'purpose': 'proof_of_delivery',
        'file': await buildProofPhotoMultipart(picked),
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
      Navigator.of(context).pop(
        _withOtp({
          'type': 'photo',
          'fileId': fileId is int ? fileId : int.tryParse(fileId.toString()),
        }),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Could not upload proof photo. Retry the upload, retake it, '
            'or use a signature.';
        _isUploading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isPickup = widget.kind == ProofSheetKind.pickup;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.md,
          bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.md,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _title,
                      style: AppTypography.h3.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Close',
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
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'OTP',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                isPickup
                    ? (_otpPrefixed
                          ? 'Pickup OTP is prefilled from the server. Confirm with the print shop, then capture the photo.'
                          : 'Ask the print shop or ops for the pickup OTP shown on the admin order.')
                    : (_otpPrefixed
                          ? 'Delivery OTP is prefilled and also shown to the customer on their order. Confirm at the door, then capture proof.'
                          : 'Use the delivery OTP shared with the customer after pickup.'),
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              if (_otpPrefixed) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: colors.primary.withValues(alpha: 0.12),
                    borderRadius: AppRadius.borderMd,
                    border: Border.all(
                      color: colors.primary.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isPickup ? 'Pickup OTP' : 'Delivery OTP',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _otpController.text,
                        key: const Key('proof-otp-display'),
                        style: AppTypography.h2.copyWith(
                          color: colors.onBackground,
                          letterSpacing: 4,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              TextField(
                key: const Key('proof-otp-field'),
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 8,
                readOnly: _otpPrefixed,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: _otpHint,
                  labelText: _otpPrefixed ? 'OTP (auto-filled)' : 'OTP',
                  counterText: '',
                  filled: true,
                  fillColor: colors.surfaceVariant,
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.borderMd,
                    borderSide: BorderSide(color: colors.outline),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.borderMd,
                    borderSide: BorderSide(color: colors.outline),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (!isPickup)
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
                )
              else
                Text(
                  'Photo proof is required for pickup',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              if (_mode == 'signature' && !isPickup) ...[
                Semantics(
                  container: true,
                  explicitChildNodes: true,
                  focusable: true,
                  label: 'Signature pad',
                  hint: 'Draw the recipient signature here',
                  child: Container(
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
                          points: List<Offset?>.of(_points),
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
                        onTap: (_hasSignature && _otpValid)
                            ? _submitSignature
                            : null,
                        isDisabled: !(_hasSignature && _otpValid),
                      ),
                    ),
                  ],
                ),
              ] else if (_pendingPhotoBytes == null) ...[
                AppButton(
                  label: isPickup ? 'Take pickup photo' : 'Take photo proof',
                  icon: HugeIcons.strokeRoundedCamera01,
                  isFullWidth: true,
                  onTap: _pickPhoto,
                ),
              ] else ...[
                ClipRRect(
                  borderRadius: AppRadius.borderMd,
                  child: Image.memory(
                    _pendingPhotoBytes!,
                    key: const Key('proof-photo-preview'),
                    height: 190,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: 'Retake',
                        variant: AppButtonVariant.secondary,
                        onTap: _isUploading ? null : _pickPhoto,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: AppButton(
                        label: _error == null ? 'Use photo' : 'Retry upload',
                        isLoading: _isUploading,
                        onTap: (_isUploading || !_otpValid)
                            ? null
                            : _uploadPendingPhoto,
                        isDisabled: !_otpValid,
                      ),
                    ),
                  ],
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
