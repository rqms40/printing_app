import 'package:file_picker/file_picker.dart';
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

class EditItemSheet {
  static Future<CartItem?> show(
    BuildContext context, {
    required CartItem item,
  }) {
    return showModalBottomSheet<CartItem>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditItemBody(item: item),
    );
  }
}

class _EditItemBody extends StatefulWidget {
  const _EditItemBody({required this.item});
  final CartItem item;

  @override
  State<_EditItemBody> createState() => _EditItemBodyState();
}

class _EditItemBodyState extends State<_EditItemBody> {
  late TextEditingController _qty;
  late TextEditingController _pages;
  late TextEditingController _color3d;
  late TextEditingController _notes3d;

  String? _newFileName;
  String? _newFilePath;
  int? _newFileSize;

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
    _pages = TextEditingController(text: widget.item.pageCount.toString());
    _color3d = TextEditingController(
      text: widget.item.threeDSpecs?.color ?? 'White',
    );
    _notes3d = TextEditingController(
      text: widget.item.threeDSpecs?.notes ?? '',
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
    _pages.dispose();
    _color3d.dispose();
    _notes3d.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: widget.item.category == '3d'
          ? AppConstants.threeDTypes
          : AppConstants.paperTypes,
    );
    if (result == null || result.files.isEmpty) return;
    final f = result.files.single;
    setState(() {
      _newFileName = f.name;
      _newFilePath = f.path;
      _newFileSize = f.size;
    });
  }

  void _save() {
    final updated = widget.item.copyWith(
      quantity: int.tryParse(_qty.text) ?? widget.item.quantity,
      pageCount: int.tryParse(_pages.text) ?? widget.item.pageCount,
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
    );
    Navigator.of(context).pop(updated);
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
                        Row(
                          children: [
                            Expanded(
                              child: _NumberField(
                                controller: _qty,
                                label: 'Copies',
                                colors: colors,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _NumberField(
                                controller: _pages,
                                label: 'Pages',
                                colors: colors,
                              ),
                            ),
                          ],
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
                      const SizedBox(height: 24),
                      _SaveButton(colors: colors, onTap: _save),
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

class _FileTile extends StatelessWidget {
  const _FileTile({
    required this.colors,
    required this.fileName,
    required this.fileSize,
    required this.onReplace,
  });
  final AppColorSet colors;
  final String fileName;
  final int? fileSize;
  final VoidCallback onReplace;

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
      child: Row(
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
            onTap: onReplace,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                    'Replace',
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

class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.colors, required this.onTap});
  final AppColorSet colors;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: colors.brand,
            borderRadius: AppRadius.borderXl,
          ),
          child: Center(
            child: Text(
              'Save changes',
              style: AppTypography.bodyBold.copyWith(
                color: colors.background,
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
