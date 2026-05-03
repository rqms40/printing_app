import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/file_helpers.dart';
import 'package:printing_app/utils/pricing_engine.dart';

typedef EditItemReplacementPicker =
    Future<EditItemReplacementFile?> Function(CartItem item);

typedef EditItemReplacementUploader =
    Future<EditItemUploadedFile> Function(
      EditItemReplacementFile file,
      CartItem item,
      ValueChanged<double> onProgress,
    );

@immutable
class EditItemReplacementFile {
  const EditItemReplacementFile({
    required this.name,
    required this.size,
    this.path,
    this.bytes,
    this.extension,
  });

  final String name;
  final int size;
  final String? path;
  final Uint8List? bytes;
  final String? extension;
}

@immutable
class EditItemUploadedFile {
  const EditItemUploadedFile({
    required this.fileName,
    required this.filePath,
    required this.fileSize,
    required this.fileMetadataId,
  });

  final String fileName;
  final String filePath;
  final int fileSize;
  final int fileMetadataId;
}

class EditItemSheet {
  static Future<CartItem?> show(
    BuildContext context, {
    required CartItem item,
    EditItemReplacementPicker? pickReplacementFile,
    EditItemReplacementUploader? uploadReplacementFile,
  }) {
    return showModalBottomSheet<CartItem>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditItemBody(
        item: item,
        pickReplacementFile: pickReplacementFile ?? _defaultPickReplacementFile,
        uploadReplacementFile:
            uploadReplacementFile ?? _defaultUploadReplacementFile,
      ),
    );
  }
}

Future<EditItemReplacementFile?> _defaultPickReplacementFile(
  CartItem item,
) async {
  FilePickerResult? result;
  try {
    result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedExtensionsFor(item),
      dialogTitle: 'Select replacement file',
      withData: true,
    );
  } catch (_) {
    result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      dialogTitle: 'Select replacement file',
      withData: true,
    );
  }
  if (result == null || result.files.isEmpty) return null;

  final file = result.files.single;
  return EditItemReplacementFile(
    name: file.name,
    path: kIsWeb ? null : file.path,
    bytes: file.bytes,
    size: file.size,
    extension: file.extension,
  );
}

Future<EditItemUploadedFile> _defaultUploadReplacementFile(
  EditItemReplacementFile file,
  CartItem item,
  ValueChanged<double> onProgress,
) async {
  final extension = _replacementExtension(file);
  final uploadContentType = DioMediaType.parse(mimeTypeForExtension(extension));
  final MultipartFile multipartFile;
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
    throw StateError('Replacement file bytes are unavailable.');
  }

  final response = await ApiClient.instance.dio.post(
    '/files/upload',
    data: FormData.fromMap({'file': multipartFile}),
    onSendProgress: (sent, total) {
      if (total > 0) onProgress(sent / total);
    },
  );
  final data = response.data is Map
      ? Map<String, dynamic>.from(response.data as Map)
      : const <String, dynamic>{};
  final fileMetadataId = (data['id'] as num?)?.toInt();
  if (fileMetadataId == null || fileMetadataId <= 0) {
    throw StateError('Upload did not return file metadata.');
  }

  return EditItemUploadedFile(
    fileName: file.name,
    filePath: data['url']?.toString() ?? file.path ?? '',
    fileSize: file.size,
    fileMetadataId: fileMetadataId,
  );
}

List<String> _allowedExtensionsFor(CartItem item) =>
    item.category == '3d' ? AppConstants.threeDTypes : AppConstants.paperTypes;

int _maxSizeMbFor(CartItem item) => item.category == '3d'
    ? AppConstants.threeDMaxSizeMB
    : AppConstants.paperMaxSizeMB;

String _replacementExtension(EditItemReplacementFile file) {
  final extension = file.extension?.trim().toLowerCase();
  if (extension != null && extension.isNotEmpty) return extension;
  final dot = file.name.lastIndexOf('.');
  if (dot < 0 || dot == file.name.length - 1) return '';
  return file.name.substring(dot + 1).toLowerCase();
}

String _replacementErrorMessage(Object error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Upload timed out. Check your connection and retry.';
      case DioExceptionType.connectionError:
        return 'Cannot reach the server. Check your network.';
      case DioExceptionType.badResponse:
        final data = error.response?.data;
        if (data is Map && data['message'] is String) {
          return data['message'] as String;
        }
        return 'File rejected by server.';
      case DioExceptionType.badCertificate:
      case DioExceptionType.cancel:
      case DioExceptionType.unknown:
        return 'Upload failed. Please try again.';
    }
  }
  return 'Upload failed. Please try again.';
}

int _positiveInt(String value, int fallback) {
  final parsed = int.tryParse(value);
  if (parsed == null || parsed < 1) return fallback < 1 ? 1 : fallback;
  return parsed;
}

String _formatBytes(int? bytes) {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

class _EditItemBody extends StatefulWidget {
  const _EditItemBody({
    required this.item,
    required this.pickReplacementFile,
    required this.uploadReplacementFile,
  });

  final CartItem item;
  final EditItemReplacementPicker pickReplacementFile;
  final EditItemReplacementUploader uploadReplacementFile;

  @override
  State<_EditItemBody> createState() => _EditItemBodyState();
}

class _EditItemBodyState extends State<_EditItemBody> {
  late TextEditingController _qty;
  late TextEditingController _color3d;
  late TextEditingController _notes3d;
  late TextEditingController _specialInstructions;

  String? _newFileName;
  String? _newFilePath;
  int? _newFileSize;
  int? _newFileMetadataId;
  bool _isReplacingFile = false;
  double _replaceProgress = 0;
  String? _replaceError;

  late PaperSize _paperSize;
  late ColorMode _colorMode;
  late MediaType _mediaType;
  late PrintSides _printSides;
  late Binding _binding;

  late FileFormat3D _fileFormat;
  late Material3D _material3d;
  late int _infill;
  late double _layerHeight;
  late bool _supports;

  @override
  void initState() {
    super.initState();
    _qty = TextEditingController(text: widget.item.quantity.toString());
    _color3d = TextEditingController(
      text: widget.item.threeDSpecs?.color ?? 'White',
    );
    _notes3d = TextEditingController(
      text: widget.item.threeDSpecs?.notes ?? '',
    );
    _specialInstructions = TextEditingController(
      text: widget.item.specialInstructions ?? '',
    );

    _paperSize = widget.item.paperSpecs?.paperSize ?? PaperSize.a4;
    _colorMode = widget.item.paperSpecs?.colorMode ?? ColorMode.fullColor;
    _mediaType = widget.item.paperSpecs?.mediaType ?? MediaType.matte;
    _printSides = widget.item.paperSpecs?.printSides ?? PrintSides.frontOnly;
    _binding = widget.item.paperSpecs?.binding ?? Binding.none;

    _fileFormat = widget.item.threeDSpecs?.fileFormat ?? FileFormat3D.stl;
    _material3d = widget.item.threeDSpecs?.material ?? Material3D.pla;
    _infill = widget.item.threeDSpecs?.infillPercentage ?? 20;
    _layerHeight = widget.item.threeDSpecs?.layerHeight ?? 0.2;
    _supports = widget.item.threeDSpecs?.supports ?? true;
  }

  @override
  void dispose() {
    _qty.dispose();
    _color3d.dispose();
    _notes3d.dispose();
    _specialInstructions.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    if (_isReplacingFile) return;
    setState(() => _replaceError = null);

    final picked = await widget.pickReplacementFile(widget.item);
    if (picked == null) return;

    final extension = _replacementExtension(picked);
    final allowed = _allowedExtensionsFor(widget.item);
    if (!allowed.contains(extension)) {
      setState(() {
        _replaceError =
            'Invalid file type .$extension. Allowed: ${allowed.map((e) => '.$e').join(', ')}';
      });
      return;
    }

    final maxBytes = _maxSizeMbFor(widget.item) * 1024 * 1024;
    if (picked.size > maxBytes) {
      setState(() {
        _replaceError =
            'File too large (${_formatBytes(picked.size)}). Maximum: ${_maxSizeMbFor(widget.item)} MB';
      });
      return;
    }

    setState(() {
      _isReplacingFile = true;
      _replaceProgress = 0;
    });

    try {
      final uploaded = await widget.uploadReplacementFile(picked, widget.item, (
        progress,
      ) {
        if (mounted) {
          setState(() => _replaceProgress = progress.clamp(0, 1).toDouble());
        }
      });
      if (!mounted) return;
      setState(() {
        _newFileName = uploaded.fileName;
        _newFilePath = uploaded.filePath;
        _newFileSize = uploaded.fileSize;
        _newFileMetadataId = uploaded.fileMetadataId;
        _replaceProgress = 1;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _replaceError = _replacementErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isReplacingFile = false);
    }
  }

  void _save() {
    if (_isReplacingFile) return;

    final quantity = _positiveInt(_qty.text, widget.item.quantity);
    final pageCount = widget.item.pageCount;
    final updatedCategorySpecs = widget.item.category == 'paper'
        ? _paperCatalogSpecs(
            paperSize: _paperSize,
            colorMode: _colorMode,
            mediaType: _mediaType,
            printSides: _printSides,
            binding: _binding,
            pageCount: pageCount,
          )
        : _threeDCatalogSpecs(
            fileFormat: _fileFormat,
            material: _material3d,
            color: _color3d.text.trim().isEmpty
                ? 'white'
                : _color3d.text.trim().toLowerCase(),
            infill: _infill,
            layerHeight: _layerHeight,
            supports: _supports,
            notes: _notes3d.text.trim(),
          );
    final updatedCategoryDisplayValues = widget.item.category == 'paper'
        ? _paperDisplayValues(
            paperSize: _paperSize,
            colorMode: _colorMode,
            mediaType: _mediaType,
            printSides: _printSides,
            binding: _binding,
            pageCount: pageCount,
          )
        : _threeDDisplayValues(
            fileFormat: _fileFormat,
            material: _material3d,
            color: _color3d.text.trim().isEmpty
                ? 'White'
                : _color3d.text.trim(),
            infill: _infill,
            layerHeight: _layerHeight,
            supports: _supports,
            notes: _notes3d.text.trim(),
          );
    final updatedSpecs = {...widget.item.specs, ...updatedCategorySpecs};
    final updatedDisplayValues = {
      ...widget.item.specDisplayValues,
      ...updatedCategoryDisplayValues,
    };
    if (widget.item.category == '3d' && _notes3d.text.trim().isEmpty) {
      updatedSpecs.remove('notes');
      updatedDisplayValues.remove('notes');
    }
    final updatedSubtotal = _updatedPrintSubtotal(
      quantity: quantity,
      pageCount: pageCount,
    );
    final updated = widget.item.copyWith(
      quantity: quantity,
      unitPrice: updatedSubtotal / quantity,
      pageCount: pageCount,
      specs: updatedSpecs,
      specDisplayValues: updatedDisplayValues,
      paperSpecs: widget.item.category == 'paper'
          ? PaperSpecs(
              paperSize: _paperSize,
              colorMode: _colorMode,
              mediaType: _mediaType,
              printSides: _printSides,
              binding: _binding,
            )
          : null,
      threeDSpecs: widget.item.category == '3d'
          ? ThreeDSpecs(
              fileFormat: _fileFormat,
              material: _material3d,
              color: _color3d.text.trim().isEmpty
                  ? 'White'
                  : _color3d.text.trim(),
              infillPercentage: _infill,
              layerHeight: _layerHeight,
              supports: _supports,
              notes: _notes3d.text.trim().isEmpty ? null : _notes3d.text.trim(),
            )
          : null,
      fileName: _newFileName,
      filePath: _newFilePath,
      fileSize: _newFileSize,
      fileMetadataId: _newFileMetadataId,
      specialInstructions: _specialInstructions.text.trim(),
      clearSpecialInstructions: _specialInstructions.text.trim().isEmpty,
    );
    Navigator.of(context).pop(updated);
  }

  double _updatedPrintSubtotal({
    required int quantity,
    required int pageCount,
  }) {
    if (widget.item.category == 'paper') {
      return PricingEngine.calculatePaperPrice(
        size: _paperSize,
        colorMode: _colorMode,
        mediaType: _mediaType,
        printSides: _printSides,
        binding: _binding,
        quantity: quantity,
        pageCount: pageCount,
      );
    }

    return PricingEngine.calculate3DPrice(
      material: _material3d,
      infillPercentage: _infill,
      quantity: quantity,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isPaper = widget.item.category == 'paper';
    final fileName = _newFileName ?? widget.item.fileName;
    final fileSize = _newFileSize ?? widget.item.fileSize;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.outline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Edit print job',
                        style: AppTypography.h3.copyWith(
                          color: colors.onBackground,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedCancel01,
                        size: 22,
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _SectionLabel('File', colors),
                      _FileTile(
                        colors: colors,
                        fileName: fileName,
                        fileSize: fileSize,
                        onReplace: _pickFile,
                        isReplacing: _isReplacingFile,
                        replaceProgress: _replaceProgress,
                        errorText: _replaceError,
                      ),
                      const SizedBox(height: 18),
                      if (isPaper) ...[
                        _SectionLabel('Paper', colors),
                        _DropdownTile<PaperSize>(
                          label: 'Paper size',
                          value: _paperSize,
                          colors: colors,
                          options: PaperSize.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _paperSize = v),
                        ),
                        _DropdownTile<ColorMode>(
                          label: 'Color',
                          value: _colorMode,
                          colors: colors,
                          options: ColorMode.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _colorMode = v),
                        ),
                        _DropdownTile<MediaType>(
                          label: 'Media',
                          value: _mediaType,
                          colors: colors,
                          options: MediaType.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _mediaType = v),
                        ),
                        _DropdownTile<PrintSides>(
                          label: 'Sides',
                          value: _printSides,
                          colors: colors,
                          options: PrintSides.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _printSides = v),
                        ),
                        _DropdownTile<Binding>(
                          label: 'Binding',
                          value: _binding,
                          colors: colors,
                          options: Binding.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _binding = v),
                        ),
                        const SizedBox(height: 18),
                        _SectionLabel('Quantity', colors),
                        _NumberField(
                          controller: _qty,
                          label: 'Copies',
                          colors: colors,
                        ),
                      ] else ...[
                        _SectionLabel('3D specs', colors),
                        _DropdownTile<FileFormat3D>(
                          label: 'Format',
                          value: _fileFormat,
                          colors: colors,
                          options: FileFormat3D.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _fileFormat = v),
                        ),
                        _DropdownTile<Material3D>(
                          label: 'Material',
                          value: _material3d,
                          colors: colors,
                          options: Material3D.values,
                          labelOf: (v) => v.displayName,
                          onChanged: (v) => setState(() => _material3d = v),
                        ),
                        _TextFieldTile(
                          controller: _color3d,
                          label: 'Color',
                          colors: colors,
                        ),
                        _DropdownTile<int>(
                          label: 'Infill %',
                          value: _infill,
                          colors: colors,
                          options: const [10, 20, 50, 100],
                          labelOf: (v) => '$v%',
                          onChanged: (v) => setState(() => _infill = v),
                        ),
                        _DropdownTile<double>(
                          label: 'Layer height',
                          value: _layerHeight,
                          colors: colors,
                          options: const [0.1, 0.2, 0.3],
                          labelOf: (v) => '${v}mm',
                          onChanged: (v) => setState(() => _layerHeight = v),
                        ),
                        SwitchListTile.adaptive(
                          value: _supports,
                          contentPadding: EdgeInsets.zero,
                          onChanged: (v) => setState(() => _supports = v),
                          title: Text(
                            'Supports',
                            style: AppTypography.body.copyWith(
                              color: colors.onBackground,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        _TextFieldTile(
                          controller: _notes3d,
                          label: 'Notes (optional)',
                          colors: colors,
                          maxLines: 2,
                        ),
                        const SizedBox(height: 18),
                        _SectionLabel('Quantity', colors),
                        _NumberField(
                          controller: _qty,
                          label: 'Copies',
                          colors: colors,
                        ),
                      ],
                      const SizedBox(height: 18),
                      _SectionLabel('Special Instructions', colors),
                      _TextFieldTile(
                        controller: _specialInstructions,
                        label: 'Special Instructions / Notes',
                        colors: colors,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 24),
                      _SaveButton(
                        colors: colors,
                        onTap: _isReplacingFile ? null : _save,
                        label: _isReplacingFile
                            ? 'Uploading replacement…'
                            : 'Save changes',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label, this.colors);
  final String label;
  final AppColorSet colors;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.overline.copyWith(
          color: colors.onSurfaceDim,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

Map<String, dynamic> _paperCatalogSpecs({
  required PaperSize paperSize,
  required ColorMode colorMode,
  required MediaType mediaType,
  required PrintSides printSides,
  required Binding binding,
  required int pageCount,
}) {
  return {
    'paper_size': _paperSizeValue(paperSize),
    'color_mode': _colorModeValue(colorMode),
    'media_type': mediaType.name,
    'print_sides': _printSidesValue(printSides),
    'binding': binding.name,
    'page_count': pageCount,
  };
}

Map<String, String> _paperDisplayValues({
  required PaperSize paperSize,
  required ColorMode colorMode,
  required MediaType mediaType,
  required PrintSides printSides,
  required Binding binding,
  required int pageCount,
}) {
  return {
    'paper_size': paperSize.displayName,
    'color_mode': colorMode.displayName,
    'media_type': mediaType.displayName,
    'print_sides': printSides.displayName,
    'binding': binding.displayName,
    'page_count': '$pageCount pages',
  };
}

Map<String, dynamic> _threeDCatalogSpecs({
  required FileFormat3D fileFormat,
  required Material3D material,
  required String color,
  required int infill,
  required double layerHeight,
  required bool supports,
  required String notes,
}) {
  return {
    'file_format': _fileFormatValue(fileFormat),
    'material': material.name,
    'color': color,
    'infill_percentage': infill,
    'layer_height': layerHeight,
    'supports': supports,
    'notes': notes,
  };
}

Map<String, String> _threeDDisplayValues({
  required FileFormat3D fileFormat,
  required Material3D material,
  required String color,
  required int infill,
  required double layerHeight,
  required bool supports,
  required String notes,
}) {
  return {
    'file_format': fileFormat.displayName,
    'material': material.displayName,
    'color': color,
    'infill_percentage': '$infill%',
    'layer_height': '${layerHeight}mm',
    'supports': supports ? 'Yes' : 'No',
    if (notes.isNotEmpty) 'notes': notes,
  };
}

String _paperSizeValue(PaperSize value) =>
    value == PaperSize.twentyByThirty ? 'twenty_by_thirty' : value.name;

String _colorModeValue(ColorMode value) =>
    value == ColorMode.blackAndWhite ? 'black_and_white' : 'full_color';

String _printSidesValue(PrintSides value) =>
    value == PrintSides.frontOnly ? 'front_only' : 'back_to_back';

String _fileFormatValue(FileFormat3D value) =>
    value == FileFormat3D.threeMf ? '3mf' : value.name;

class _FileTile extends StatelessWidget {
  const _FileTile({
    required this.colors,
    required this.fileName,
    required this.fileSize,
    required this.onReplace,
    required this.isReplacing,
    required this.replaceProgress,
    this.errorText,
  });
  final AppColorSet colors;
  final String fileName;
  final int? fileSize;
  final VoidCallback onReplace;
  final bool isReplacing;
  final double replaceProgress;
  final String? errorText;

  String _fmtSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: AppRadius.borderMd,
                ),
                child: Center(
                  child: HugeIcon(
                    icon: HugeIcons.strokeRoundedFile02,
                    size: 18,
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 13,
                      ),
                    ),
                    if (_fmtSize(fileSize).isNotEmpty)
                      Text(
                        _fmtSize(fileSize),
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: isReplacing ? null : onReplace,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: colors.brand.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedRepeat,
                        size: 13,
                        color: colors.brand,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        isReplacing ? 'Uploading' : 'Replace',
                        style: AppTypography.caption.copyWith(
                          color: colors.brand,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (isReplacing) ...[
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: replaceProgress > 0 ? replaceProgress : null,
              color: colors.brand,
              backgroundColor: colors.outline.withValues(alpha: 0.25),
              minHeight: 3,
              borderRadius: BorderRadius.circular(99),
            ),
          ],
          if (errorText != null) ...[
            const SizedBox(height: 8),
            Text(
              errorText!,
              style: AppTypography.caption.copyWith(
                color: colors.error,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.colors, required this.onTap, this.label});
  final AppColorSet colors;
  final VoidCallback? onTap;
  final String? label;
  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: enabled
                ? colors.brand
                : colors.outline.withValues(alpha: 0.35),
            borderRadius: AppRadius.borderXl,
          ),
          child: Center(
            child: Text(
              label ?? 'Save changes',
              style: AppTypography.bodyBold.copyWith(
                color: enabled ? colors.background : colors.onSurfaceDim,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DropdownTile<T> extends StatelessWidget {
  const _DropdownTile({
    required this.label,
    required this.value,
    required this.options,
    required this.labelOf,
    required this.onChanged,
    required this.colors,
  });
  final String label;
  final T value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 13,
                ),
              ),
            ),
            DropdownButton<T>(
              value: value,
              underline: const SizedBox.shrink(),
              dropdownColor: colors.surface,
              icon: HugeIcon(
                icon: HugeIcons.strokeRoundedArrowDown01,
                size: 16,
                color: colors.onSurfaceDim,
              ),
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                fontSize: 13,
              ),
              items: [
                for (final o in options)
                  DropdownMenuItem<T>(value: o, child: Text(labelOf(o))),
              ],
              onChanged: (v) {
                if (v != null) onChanged(v);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.controller,
    required this.label,
    required this.colors,
  });
  final TextEditingController controller;
  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      style: AppTypography.bodyBold.copyWith(
        color: colors.onBackground,
        fontSize: 14,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        filled: true,
        fillColor: colors.background,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.borderMd,
          borderSide: BorderSide(color: colors.outline.withValues(alpha: 0.4)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.borderMd,
          borderSide: BorderSide(color: colors.outline.withValues(alpha: 0.4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.borderMd,
          borderSide: BorderSide(color: colors.brand),
        ),
      ),
    );
  }
}

class _TextFieldTile extends StatelessWidget {
  const _TextFieldTile({
    required this.controller,
    required this.label,
    required this.colors,
    this.maxLines = 1,
  });
  final TextEditingController controller;
  final String label;
  final AppColorSet colors;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: AppTypography.body.copyWith(
          color: colors.onBackground,
          fontSize: 14,
        ),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: AppTypography.caption.copyWith(
            color: colors.onSurfaceDim,
          ),
          filled: true,
          fillColor: colors.background,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 12,
          ),
          border: OutlineInputBorder(
            borderRadius: AppRadius.borderMd,
            borderSide: BorderSide(
              color: colors.outline.withValues(alpha: 0.4),
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.borderMd,
            borderSide: BorderSide(
              color: colors.outline.withValues(alpha: 0.4),
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: AppRadius.borderMd,
            borderSide: BorderSide(color: colors.brand),
          ),
        ),
      ),
    );
  }
}
