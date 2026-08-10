import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/widgets/proof_of_delivery_sheet.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Capture failed-delivery evidence + reason (return path).
class FailedDeliverySheet extends StatefulWidget {
  const FailedDeliverySheet({super.key, required this.orderRef});

  final String orderRef;

  @override
  State<FailedDeliverySheet> createState() => _FailedDeliverySheetState();
}

class _FailedDeliverySheetState extends State<FailedDeliverySheet> {
  final _reasonController = TextEditingController();
  XFile? _pendingPhoto;
  Uint8List? _pendingPhotoBytes;
  var _isUploading = false;
  String? _error;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
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

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    final photo = _pendingPhoto;
    if (reason.isEmpty) {
      setState(() => _error = 'Enter a failure reason');
      return;
    }
    if (photo == null) {
      setState(() => _error = 'Photo evidence is required');
      return;
    }
    setState(() {
      _error = null;
      _isUploading = true;
    });
    try {
      final form = FormData.fromMap({
        'purpose': 'proof_of_delivery',
        'file': await buildProofPhotoMultipart(photo),
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
        'reason': reason,
        'proof': {
          'type': 'photo',
          'fileId': fileId is int ? fileId : int.tryParse(fileId.toString()),
        },
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not upload evidence photo. Try again.';
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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Failed delivery',
                style: AppTypography.h3.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Order ${widget.orderRef}: capture evidence and reason. '
                'Order will not be marked delivered. Ops is notified; '
                'redelivery needs a new fee approval.',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Failure reason',
                  hintText: 'Customer unreachable / refused / wrong address…',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (_pendingPhotoBytes != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Image.memory(
                    _pendingPhotoBytes!,
                    height: 140,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              AppButton(
                label: _pendingPhoto == null
                    ? 'Take evidence photo'
                    : 'Retake photo',
                variant: AppButtonVariant.secondary,
                isFullWidth: true,
                onTap: _isUploading ? null : _pickPhoto,
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _error!,
                  style: AppTypography.caption.copyWith(color: colors.error),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: 'Submit failed delivery',
                isFullWidth: true,
                isLoading: _isUploading,
                onTap: _isUploading ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
