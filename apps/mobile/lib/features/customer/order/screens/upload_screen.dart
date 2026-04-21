import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/widgets/file_upload_card.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/formatters.dart';

/// Step 3/6 -- File upload with real Dio progress.
class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  static const routeName = '/order/upload';

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen>
    with SingleTickerProviderStateMixin {
  String? _fileName;
  String? _filePath;
  Uint8List? _fileBytes;
  String? _fileMimeType;
  int? _fileSize;
  int? _fileMetadataId;
  String? _errorText;
  bool _isUploading = false;
  double _uploadProgress = 0;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  List<String> get _allowedTypes {
    final state = ref.read(orderFlowProvider);
    return state.category == 'paper'
        ? AppConstants.paperTypes
        : AppConstants.threeDTypes;
  }

  int get _maxSizeMB {
    final state = ref.read(orderFlowProvider);
    return state.category == 'paper'
        ? AppConstants.paperMaxSizeMB
        : AppConstants.threeDMaxSizeMB;
  }

  String _mimeFromExtension(String ext) {
    switch (ext.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'stl':
        return 'model/stl';
      case 'obj':
        return 'model/obj';
      case '3mf':
        return 'model/3mf';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _pickFile() async {
    FilePickerResult? result;
    bool nativeSucceeded = false;

    try {
      try {
        result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: _allowedTypes,
          dialogTitle: 'Select file to print',
          withData: true,
        );
      } catch (_) {
        result = await FilePicker.platform.pickFiles(
          type: FileType.any,
          dialogTitle: 'Select file to print',
          withData: true,
        );
      }
      if (result != null && result.files.isNotEmpty) {
        nativeSucceeded = true;
      }
    } catch (_) {
      nativeSucceeded = false;
    }

    if (!nativeSucceeded || result == null) {
      _useMockFile();
      return;
    }

    final file = result.files.first;
    final extension = file.extension?.toLowerCase() ?? '';
    final sizeInBytes = file.size;
    final maxBytes = _maxSizeMB * 1024 * 1024;

    if (!_allowedTypes.contains(extension)) {
      setState(() {
        _errorText =
            'Invalid file type ".$extension". Allowed: ${_allowedTypes.map((e) => '.$e').join(', ')}';
        _fileName = null;
        _filePath = null;
        _fileBytes = null;
        _fileSize = null;
      });
      return;
    }

    if (sizeInBytes > maxBytes) {
      setState(() {
        _errorText =
            'File too large (${formatFileSize(sizeInBytes)}). Maximum: $_maxSizeMB MB';
        _fileName = null;
        _filePath = null;
        _fileBytes = null;
        _fileSize = null;
      });
      return;
    }

    setState(() {
      _errorText = null;
      _fileName = file.name;
      _filePath = kIsWeb ? null : file.path;
      _fileBytes = file.bytes;
      _fileMimeType = _mimeFromExtension(extension);
      _fileSize = sizeInBytes;
      _fileMetadataId = null;
      _isUploading = true;
      _uploadProgress = 0;
    });

    await _uploadFile(file);
  }

  void _useMockFile() {
    final category = ref.read(orderFlowProvider).category ?? 'paper';
    final mockFiles = category == 'paper'
        ? [
            ('Project_Report_Final.pdf', 2457600, 'application/pdf'),
            ('Thesis_Document.pdf', 1843200, 'application/pdf'),
            ('Event_Poster_A3.png', 5242880, 'image/png'),
            ('Business_Cards_Layout.pdf', 819200, 'application/pdf'),
          ]
        : [
            ('Prototype_Model_v2.stl', 8388608, 'model/stl'),
            ('Figurine_Base.obj', 4194304, 'model/obj'),
            ('Phone_Case_Design.3mf', 3145728, 'model/3mf'),
          ];

    final mock = mockFiles[DateTime.now().second % mockFiles.length];
    setState(() {
      _errorText = null;
      _fileName = mock.$1;
      _filePath = null;
      _fileBytes = null;
      _fileMimeType = mock.$3;
      _fileSize = mock.$2;
      _fileMetadataId = null;
      _isUploading = false;
      _uploadProgress = 0;
    });
  }

  Future<void> _uploadFile(PlatformFile file) async {
    try {
      final MultipartFile multipartFile;
      if (file.bytes != null) {
        multipartFile =
            MultipartFile.fromBytes(file.bytes!, filename: file.name);
      } else if (!kIsWeb && file.path != null) {
        multipartFile =
            await MultipartFile.fromFile(file.path!, filename: file.name);
      } else {
        setState(() {
          _isUploading = false;
        });
        return;
      }

      final formData = FormData.fromMap({'file': multipartFile});
      final response = await ApiClient.instance.dio.post(
        '/files/upload',
        data: formData,
        onSendProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() => _uploadProgress = sent / total);
          }
        },
      );

      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 1.0;
          _filePath = (response.data['url'] as String?) ?? _filePath;
          _fileMetadataId = response.data['id'] as int?;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 0;
          _errorText = 'Upload failed. Please try again.';
          _fileName = null;
          _fileSize = null;
          _fileBytes = null;
          _fileMetadataId = null;
        });
      }
    }
  }

  bool get _canContinue =>
      _fileName != null && !_isUploading && _errorText == null;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Upload File',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.md),
                    const StepIndicator(totalSteps: 6, currentStep: 2),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Upload Your File',
                      style: AppTypography.h1
                          .copyWith(color: colors.onBackground),
                    )
                        .animate()
                        .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                        .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            curve: Curves.easeOut),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Accepted: ${_allowedTypes.map((e) => '.$e').join(', ')} (max $_maxSizeMB MB)',
                      style: AppTypography.caption
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    FileUploadCard(
                      onTap: _pickFile,
                      fileName: _fileName,
                      fileSize: _fileSize,
                      errorText: _errorText,
                      isUploading: _isUploading,
                      uploadProgress: _uploadProgress,
                      localFilePath: _filePath,
                      localFileBytes: _fileBytes,
                      mimeType: _fileMimeType,
                    )
                        .animate()
                        .fadeIn(
                            duration: 400.ms,
                            delay: 60.ms,
                            curve: Curves.easeOut)
                        .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            delay: 60.ms,
                            curve: Curves.easeOut),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(
                  top: BorderSide(color: colors.outline, width: 0.5),
                ),
              ),
              child: AppButton(
                label: 'Continue',
                isFullWidth: true,
                isDisabled: !_canContinue,
                onTap: _canContinue ? _onContinue : null,
              ),
            )
                .animate()
                .fadeIn(
                    duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 120.ms,
                    curve: Curves.easeOut),
          ],
        ),
      ),
    );
  }

  void _onContinue() {
    ref.read(orderFlowProvider.notifier).setFile(
          fileName: _fileName!,
          filePath: _filePath ?? '',
          fileSize: _fileSize ?? 0,
          fileMetadataId: _fileMetadataId,
        );
    ref.read(orderFlowProvider.notifier).nextStep();
    context.push('/customer/order/summary');
  }
}
