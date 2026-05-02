import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:uuid/uuid.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/widgets/file_upload_card.dart';
import 'package:printing_app/features/customer/order/widgets/model_3d_preview.dart';
import 'package:printing_app/features/customer/order/widgets/printer_limits_card.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:printing_app/utils/file_helpers.dart';
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
  final _uploadCardKey = GlobalKey();
  final _uploadContinueKey = GlobalKey();
  bool _advancedThisFrame = false;
  bool _uploadCardCoachDone = false;
  bool _uploadContinueCoachShown = false;

  String? _fileName;
  String? _filePath;
  Uint8List? _fileBytes;
  String? _fileMimeType;
  int? _fileSize;
  int? _fileMetadataId;
  String? _errorText;
  bool _isUploading = false;
  double _uploadProgress = 0;
  Map<String, dynamic>? _inspection;

  PipelineTutorialNotifier? _pipelineNotifier;
  PipelineState _pipelineState = const PipelineState();

  @override
  void initState() {
    super.initState();
    _pipelineNotifier = ref.read(pipelineTutorialProvider.notifier);
    ref.listenManual<PipelineState>(
      pipelineTutorialProvider,
      (_, next) => _pipelineState = next,
      fireImmediately: true,
    );
    // Delay long enough for the entry animations (400ms + 60ms delay) to
    // settle so the coach-mark spotlight captures the final widget positions.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(
        const Duration(milliseconds: 500),
        _maybePipelineCoachMark,
      );
    });
  }

  @override
  void dispose() {
    if (_pipelineState.active &&
        _pipelineState.step == PipelineStep.uploadCard &&
        !_advancedThisFrame) {
      _pipelineNotifier?.abandon();
    }
    super.dispose();
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.uploadCard) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _uploadCardKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Upload your file',
          body:
              'Drop a file here, or tap to browse. PDFs, images, and docs all work.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        // Don't advance pipeline yet — wait until the user picks a file and
        // taps Continue. Set the flag so _maybeFireContinueCoach can run.
        _uploadCardCoachDone = true;
        // If a file was already selected before Got-it, fire immediately.
        _maybeFireContinueCoach();
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _maybeFireContinueCoach() {
    if (_uploadContinueCoachShown) return;
    if (!_uploadCardCoachDone) return;
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.uploadCard) return;
    if (!_canContinue) return;

    _uploadContinueCoachShown = true;
    // Wait for the bottom-bar's entry animation (120ms delay + 400ms duration)
    // to fully settle before spotlighting the Continue button.
    Future.delayed(const Duration(milliseconds: 550), () {
      if (!mounted) return;
      showCoachMark(
        context,
        [
          TutorialStep(
            targetKey: _uploadContinueKey,
            icon: HugeIcons.strokeRoundedArrowRight01,
            title: 'Continue',
            body: 'File ready — tap Continue to checkout.',
            advanceOnSpotlightTap: true,
            onSpotlightTap: () {
              _advancedThisFrame = true;
              ref.read(pipelineTutorialProvider.notifier).advance();
              _onContinue();
            },
          ),
        ],
        () {},
        onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
      );
    });
  }

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
      _fileMimeType = mimeTypeForExtension(extension);
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
      final extension = file.extension?.toLowerCase() ?? '';
      final uploadMimeType = mimeTypeForExtension(extension);
      final uploadContentType = DioMediaType.parse(uploadMimeType);
      if (file.bytes != null) {
        multipartFile = MultipartFile.fromBytes(
          file.bytes!,
          filename: file.name,
          contentType: uploadContentType,
        );
      } else if (!kIsWeb && file.path != null) {
        multipartFile = await MultipartFile.fromFile(
          file.path!,
          filename: file.name,
          contentType: uploadContentType,
        );
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
        final fileMetadataId = response.data['id'] as int?;
        setState(() {
          _isUploading = false;
          _uploadProgress = 1.0;
          _filePath = (response.data['url'] as String?) ?? _filePath;
          _fileMetadataId = fileMetadataId;
        });

        // Fetch inspection results after upload
        final category = ref.read(orderFlowProvider).category;
        final paperSizeName = ref
            .read(orderFlowProvider)
            .paperSpecs
            ?.paperSize
            .name;
        if (fileMetadataId != null) {
          try {
            final String inspectUrl;
            if (category == '3d') {
              inspectUrl = '/files/$fileMetadataId/inspect';
            } else if (paperSizeName != null) {
              inspectUrl =
                  '/files/$fileMetadataId/inspect?paperSize=$paperSizeName';
            } else {
              inspectUrl = '';
            }
            if (inspectUrl.isNotEmpty) {
              final res = await ApiClient.instance.get(inspectUrl);
              if (mounted) {
                setState(() => _inspection = res.data as Map<String, dynamic>);
              }
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      // Surface actual cause: DioException type → user-actionable message,
      // anything else → log full exception. Keeps debugging humane and gives
      // the user concrete feedback instead of a generic retry prompt.
      String message = 'Upload failed. Please try again.';
      if (e is DioException) {
        switch (e.type) {
          case DioExceptionType.connectionTimeout:
          case DioExceptionType.sendTimeout:
          case DioExceptionType.receiveTimeout:
            message = 'Upload timed out. Check your connection and retry.';
            break;
          case DioExceptionType.connectionError:
            message = 'Cannot reach the server. Check your network.';
            break;
          case DioExceptionType.badResponse:
            final status = e.response?.statusCode;
            final body = e.response?.data;
            if (status == 400) {
              final serverMsg = (body is Map && body['message'] is String)
                  ? body['message'] as String
                  : 'File rejected by server.';
              message = serverMsg;
            } else if (status == 413) {
              message = 'File is too large.';
            } else {
              message = 'Server error ($status). Please try again.';
            }
            break;
          default:
            message = 'Upload error: ${e.message ?? e.type.name}';
        }
      }
      debugPrint('[upload_screen] upload failed: $e');
      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadProgress = 0;
          _errorText = message;
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
    final category = ref.watch(orderFlowProvider).category;

    // Fire the Continue coach mark once a file is ready and the upload card
    // coach mark has been dismissed (Got it →).
    if (_canContinue) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _maybeFireContinueCoach(),
      );
    }

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
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.md),
                    const StepIndicator(totalSteps: 6, currentStep: 2),
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                          'Upload Your File',
                          style: AppTypography.h1.copyWith(
                            color: colors.onBackground,
                          ),
                        )
                        .animate()
                        .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                        .slideY(
                          begin: 0.03,
                          duration: 400.ms,
                          curve: Curves.easeOut,
                        ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Accepted: ${_allowedTypes.map((e) => '.$e').join(', ')} (max $_maxSizeMB MB)',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    KeyedSubtree(
                      key: _uploadCardKey,
                      child:
                          FileUploadCard(
                                onTap: _pickFile,
                                onPreview: _fileName != null && !_isUploading
                                    ? _showPreview
                                    : null,
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
                                curve: Curves.easeOut,
                              )
                              .slideY(
                                begin: 0.03,
                                duration: 400.ms,
                                delay: 60.ms,
                                curve: Curves.easeOut,
                              ),
                    ),
                    if (_inspection != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      if (_inspection!['colorSpace'] == 'cmyk')
                        const _InspectionChip(
                          icon: Icons.palette_outlined,
                          label: 'CMYK — print ready',
                          color: Colors.green,
                        ),
                      if (_inspection!['colorSpace'] != null &&
                          _inspection!['colorSpace'] != 'cmyk')
                        const _InspectionChip(
                          icon: Icons.palette_outlined,
                          label: 'RGB — colors may shift when printed',
                          color: Colors.orange,
                        ),
                      if (_inspection!['sizeValidation']?['status'] ==
                          'mismatch')
                        _InspectionChip(
                          icon: Icons.warning_amber_rounded,
                          label:
                              _inspection!['sizeValidation']['message']
                                  as String,
                          color: Colors.red,
                        ),
                      if (_inspection!['sizeValidation']?['status'] == 'match')
                        _InspectionChip(
                          icon: Icons.check_circle_outline,
                          label:
                              'Size matches ${ref.read(orderFlowProvider).paperSpecs?.paperSize.name.toUpperCase() ?? ""}',
                          color: Colors.green,
                        ),
                    ],
                    if (_fileMetadataId != null && _fileName != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      GestureDetector(
                        onTap: () => FilePreviewSheet.show(
                          context,
                          fileId: _fileMetadataId!,
                          fileName: _fileName!,
                          mimeType: _fileMimeType ?? 'application/octet-stream',
                          fileSize: _fileSize,
                          widthMm: (_inspection?['widthMm'] as num?)
                              ?.toDouble(),
                          heightMm: (_inspection?['heightMm'] as num?)
                              ?.toDouble(),
                        ),
                        child: Text(
                          'Preview file',
                          style: AppTypography.caption.copyWith(
                            color: colors.accent,
                          ),
                        ),
                      ),
                    ],
                    if (category == '3d' && _inspection != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        'File Preview',
                        style: AppTypography.h3.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _fileName ?? '',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Model3dPreview(
                        fileUrl: _filePath ?? '',
                        filename: _fileName ?? '',
                        previewGlbUrl: _inspection?['previewGlbUrl'] as String?,
                      ),
                      if (_inspection!['printerLimits'] != null) ...[
                        const SizedBox(height: 16),
                        PrinterLimitsCard(
                          printerName:
                              (_inspection!['printerLimits']['profileName']
                                  as String?) ??
                              'Printer',
                          widthMm:
                              (_inspection!['printerLimits']['widthMm'] as num)
                                  .toInt(),
                          depthMm:
                              (_inspection!['printerLimits']['depthMm'] as num)
                                  .toInt(),
                          heightMm:
                              (_inspection!['printerLimits']['heightMm'] as num)
                                  .toInt(),
                          modelWidthMm:
                              (_inspection!['modelBounds']?['widthMm'] as num?)
                                  ?.toDouble(),
                          modelDepthMm:
                              (_inspection!['modelBounds']?['depthMm'] as num?)
                                  ?.toDouble(),
                          modelHeightMm:
                              (_inspection!['modelBounds']?['heightMm'] as num?)
                                  ?.toDouble(),
                          fits: _inspection!['printerLimits']['fits'] as bool,
                        ),
                      ],
                    ],
                    const SizedBox(height: AppSpacing.lg),
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
                  child:
                      category == '3d' &&
                          _inspection?['printerLimits']?['fits'] == false
                      ? Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const AppButton(
                              label: 'Unavailable for Beta Testing',
                              variant: AppButtonVariant.secondary,
                              isFullWidth: true,
                              isDisabled: true,
                              onTap: null,
                            ),
                            const SizedBox(height: 8),
                            AppButton(
                              label: 'Chat with us for personalization',
                              variant: AppButtonVariant.brand,
                              isFullWidth: true,
                              onTap: _openOversizedChat,
                            ),
                          ],
                        )
                      : AppButton(
                          key: _uploadContinueKey,
                          label: 'Continue',
                          isFullWidth: true,
                          isDisabled: !_canContinue,
                          onTap: _canContinue ? _onContinue : null,
                        ),
                )
                .animate()
                .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 120.ms,
                  curve: Curves.easeOut,
                ),
          ],
        ),
      ),
    );
  }

  void _openOversizedChat() {
    final w =
        (_inspection?['modelBounds']?['widthMm'] as num?)?.toStringAsFixed(0) ??
        '?';
    final d =
        (_inspection?['modelBounds']?['depthMm'] as num?)?.toStringAsFixed(0) ??
        '?';
    final h =
        (_inspection?['modelBounds']?['heightMm'] as num?)?.toStringAsFixed(
          0,
        ) ??
        '?';
    final filename = _fileName ?? 'my model';
    final draftMessage =
        "Hi! I'm uploading $filename ($w×$d×$h mm) but it exceeds the printer build volume — can you help with personalization?";
    context.push(
      '/customer/chat/new?type=admin&draft=${Uri.encodeComponent(draftMessage)}',
    );
  }

  void _onContinue() {
    ref
        .read(orderFlowProvider.notifier)
        .setFile(
          fileName: _fileName!,
          filePath: _filePath ?? '',
          fileSize: _fileSize ?? 0,
          fileMetadataId: _fileMetadataId,
        );
    ref.read(orderFlowProvider.notifier).nextStep();
    _appendToCheckoutAndNavigate();
  }

  void _appendToCheckoutAndNavigate() {
    final flow = ref.read(orderFlowProvider);
    final item = CartItem(
      id: const Uuid().v4(),
      category: flow.category!,
      fileName: flow.fileName!,
      filePath: flow.filePath,
      fileSize: flow.fileSize,
      fileMetadataId: flow.fileMetadataId ?? 0,
      paperSpecs: flow.category == 'paper' ? flow.paperSpecs : null,
      threeDSpecs: flow.category == '3d' ? flow.threeDSpecs : null,
      quantity: flow.quantity,
      pageCount: flow.pageCount,
      printSubtotal: flow.totalPrice,
      createdAt: DateTime.now(),
    );
    ref.read(checkoutProvider.notifier).addItem(item);
    // Reset the in-flight order draft so navigating back to Upload
    // does not re-add the same item on a second Continue tap.
    ref.read(orderFlowProvider.notifier).reset();

    final isAddMode =
        GoRouterState.of(context).uri.queryParameters['mode'] == 'add';
    if (isAddMode) {
      context.go('/customer/order/checkout');
    } else {
      context.push('/customer/order/checkout');
    }
  }

  void _showPreview() {
    final fileName = _fileName;
    final mimeType = _fileMimeType;
    if (fileName == null || mimeType == null) return;

    final metadataId = _fileMetadataId;
    if (metadataId != null) {
      FilePreviewSheet.show(
        context,
        fileId: metadataId,
        fileName: fileName,
        mimeType: mimeType,
        fileSize: _fileSize,
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (_) => _LocalUploadPreviewSheet(
        fileName: fileName,
        mimeType: mimeType,
        fileSize: _fileSize,
        filePath: _filePath,
        fileBytes: _fileBytes,
      ),
    );
  }
}

class _LocalUploadPreviewSheet extends StatelessWidget {
  const _LocalUploadPreviewSheet({
    required this.fileName,
    required this.mimeType,
    this.fileSize,
    this.filePath,
    this.fileBytes,
  });

  final String fileName;
  final String mimeType;
  final int? fileSize;
  final String? filePath;
  final Uint8List? fileBytes;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final height = MediaQuery.of(context).size.height * 0.82;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: colors.outline.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
            ),
            child: Row(
              children: [
                FileTypeIcon(mimeType: mimeType, size: 32),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fileName,
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.onBackground,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (fileSize != null)
                        Text(
                          formatFileSize(fileSize!),
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: colors.onSurfaceDim),
                  tooltip: 'Close',
                ),
              ],
            ),
          ),
          Divider(color: colors.outline.withValues(alpha: 0.5), height: 1),
          Expanded(child: _buildPreview(colors)),
        ],
      ),
    );
  }

  Widget _buildPreview(AppColorSet colors) {
    if (mimeType.startsWith('image/')) {
      final bytes = fileBytes;
      if (bytes != null) {
        return InteractiveViewer(
          minScale: 0.5,
          maxScale: 6,
          child: Center(child: Image.memory(bytes, fit: BoxFit.contain)),
        );
      }
      if (filePath != null && !kIsWeb) {
        return InteractiveViewer(
          minScale: 0.5,
          maxScale: 6,
          child: Center(
            child: Image.file(File(filePath!), fit: BoxFit.contain),
          ),
        );
      }
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FileTypeIcon(mimeType: mimeType, size: 64),
            const SizedBox(height: AppSpacing.lg),
            Text(
              fileName,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Preview will be available after upload for supported files.',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _InspectionChip extends StatelessWidget {
  const _InspectionChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(label, style: TextStyle(fontSize: 12, color: color)),
          ),
        ],
      ),
    );
  }
}
