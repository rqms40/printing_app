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
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 3/6 -- File upload.
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
  int? _fileSize;
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

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedTypes,
    );

    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final extension = file.extension?.toLowerCase() ?? '';
    final sizeInBytes = file.size;
    final maxBytes = _maxSizeMB * 1024 * 1024;

    // Validate extension
    if (!_allowedTypes.contains(extension)) {
      setState(() {
        _errorText =
            'Invalid file type. Allowed: ${_allowedTypes.join(', ')}';
        _fileName = null;
        _filePath = null;
        _fileSize = null;
      });
      return;
    }

    // Validate size
    if (sizeInBytes > maxBytes) {
      setState(() {
        _errorText = 'File too large. Maximum size: $_maxSizeMB MB';
        _fileName = null;
        _filePath = null;
        _fileSize = null;
      });
      return;
    }

    setState(() {
      _errorText = null;
      _fileName = file.name;
      _filePath = file.path;
      _fileSize = sizeInBytes;
      _isUploading = true;
      _uploadProgress = 0;
    });

    // Mock upload progress
    await _simulateUpload();
  }

  Future<void> _simulateUpload() async {
    for (int i = 1; i <= 10; i++) {
      await Future.delayed(const Duration(milliseconds: 120));
      if (!mounted) return;
      setState(() => _uploadProgress = i / 10);
    }
    setState(() => _isUploading = false);
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
                    ).animate()
                      .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                      .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
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
                    ).animate()
                      .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                      .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
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
            ).animate()
              .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
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
        );
    ref.read(orderFlowProvider.notifier).nextStep();

    context.push('/customer/order/summary');
  }
}
