import 'package:flutter/material.dart';
import 'package:flutter_3d_controller/flutter_3d_controller.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class Model3dPreview extends StatefulWidget {
  const Model3dPreview({
    super.key,
    required this.fileUrl,
    required this.filename,
    this.previewGlbUrl,
  });

  final String fileUrl;
  final String filename;
  final String? previewGlbUrl;

  bool get _isSupported {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.stl') ||
        lower.endsWith('.obj') ||
        lower.endsWith('.glb') ||
        lower.endsWith('.gltf')) {
      return true;
    }
    if (lower.endsWith('.3mf')) return previewGlbUrl != null;
    return false;
  }

  String get _resolvedSrc {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.3mf') && previewGlbUrl != null) return previewGlbUrl!;
    return fileUrl;
  }

  @override
  State<Model3dPreview> createState() => _Model3dPreviewState();
}

class _Model3dPreviewState extends State<Model3dPreview> {
  late final Flutter3DController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Flutter3DController();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (!widget._isSupported) {
      return _Placeholder(colors: colors, filename: widget.filename);
    }

    return Container(
      height: 300,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Flutter3DViewer(
        controller: _controller,
        src: widget._resolvedSrc,
        progressBarColor: colors.brand,
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colors, required this.filename});
  final AppColorSet colors;
  final String filename;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedCube,
            size: 64,
            color: colors.brand,
          ),
          const SizedBox(height: 12),
          Text(
            filename,
            style: AppTypography.body.copyWith(color: colors.onBackground),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            '3D preview not available for this format',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
