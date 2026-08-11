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
import 'package:printing_app/utils/formatters.dart';

enum CodCollectionSheetMode { collect, fail }

/// Rider COD cash collection or failure proof sheet.
class CodCollectionSheet extends StatefulWidget {
  const CodCollectionSheet({
    super.key,
    required this.orderRef,
    required this.amountMajor,
    this.mode = CodCollectionSheetMode.collect,
  });

  final String orderRef;
  final double amountMajor;
  final CodCollectionSheetMode mode;

  @override
  State<CodCollectionSheet> createState() => _CodCollectionSheetState();
}

class _CodCollectionSheetState extends State<CodCollectionSheet> {
  final _reasonController = TextEditingController();
  XFile? _pendingPhoto;
  Uint8List? _pendingPhotoBytes;
  var _isUploading = false;
  String? _error;

  bool get _isFail => widget.mode == CodCollectionSheetMode.fail;

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
    final photo = _pendingPhoto;
    if (!_isFail && photo == null) {
      setState(() => _error = 'Collection proof photo is required');
      return;
    }
    if (_isFail && _reasonController.text.trim().isEmpty) {
      setState(() => _error = 'Enter why cash could not be collected');
      return;
    }

    setState(() {
      _error = null;
      _isUploading = true;
    });

    try {
      int? fileId;
      if (photo != null) {
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
        final rawId = data['id'];
        if (rawId == null) {
          throw StateError('Upload did not return a file id');
        }
        fileId = rawId is int ? rawId : int.tryParse(rawId.toString());
      }

      if (!mounted) return;
      if (_isFail) {
        Navigator.of(context).pop({
          'mode': 'fail',
          'returnReason': _reasonController.text.trim(),
          'photoFileId': ?fileId,
        });
      } else {
        if (fileId == null) {
          throw StateError('Collection requires photo file id');
        }
        Navigator.of(context).pop({'mode': 'collect', 'photoFileId': fileId});
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not upload proof. Try again.';
        _isUploading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final amountLabel = formatCurrency(widget.amountMajor);

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
                _isFail ? 'COD collection failed' : 'Collect COD cash',
                style: AppTypography.h3.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Order ${widget.orderRef}',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: colors.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Exact amount due',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      amountLabel,
                      style: AppTypography.h2.copyWith(
                        color: colors.onBackground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (_isFail) ...[
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: _reasonController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Failure reason',
                    hintText: 'No cash / customer refused…',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                ),
              ],
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
                    ? (_isFail
                          ? 'Optional evidence photo'
                          : 'Take cash / receipt photo')
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
                label: _isFail
                    ? 'Record COD failure'
                    : 'Confirm cash collected',
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
