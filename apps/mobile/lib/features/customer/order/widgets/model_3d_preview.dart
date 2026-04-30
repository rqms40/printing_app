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

  bool get _isObj => filename.toLowerCase().endsWith('.obj');

  @override
  State<Model3dPreview> createState() => _Model3dPreviewState();
}

class _Model3dPreviewState extends State<Model3dPreview> {
  late final Flutter3DController _controller;
  List<String> _animations = const [];
  List<String> _textures = const [];
  bool _isPlaying = false;
  bool _modelLoaded = false;

  @override
  void initState() {
    super.initState();
    _controller = Flutter3DController();
    _controller.onModelLoaded.addListener(_onModelLoadedChanged);
  }

  @override
  void dispose() {
    _controller.onModelLoaded.removeListener(_onModelLoadedChanged);
    super.dispose();
  }

  Future<void> _onModelLoadedChanged() async {
    if (!_controller.onModelLoaded.value || !mounted) return;
    try {
      final anims = await _controller.getAvailableAnimations();
      final texs = await _controller.getAvailableTextures();
      if (!mounted) return;
      setState(() {
        _animations = anims.where((a) => a.isNotEmpty).toList();
        _textures = texs.where((t) => t.isNotEmpty).toList();
        _modelLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _modelLoaded = true);
    }
  }

  void _resetView() {
    _controller.resetCameraOrbit();
    _controller.resetCameraTarget();
  }

  void _setOrbit(double theta, double phi, double radius) {
    _controller.setCameraOrbit(theta, phi, radius);
  }

  void _togglePlay() {
    if (_isPlaying) {
      _controller.pauseAnimation();
    } else {
      _controller.playAnimation();
    }
    setState(() => _isPlaying = !_isPlaying);
  }

  void _selectTexture(String name) {
    _controller.setTexture(textureName: name);
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
      height: 320,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned.fill(
            child: widget._isObj
                ? Flutter3DViewer.obj(
                    src: widget._resolvedSrc,
                    onLoad: (_) => _onModelLoadedChanged(),
                  )
                : Flutter3DViewer(
                    controller: _controller,
                    src: widget._resolvedSrc,
                    progressBarColor: colors.brand,
                  ),
          ),
          // Camera presets — top-right
          if (_modelLoaded || widget._isObj)
            Positioned(
              top: 8,
              right: 8,
              child: _ControlsColumn(
                colors: colors,
                children: [
                  _CtrlButton(
                    colors: colors,
                    icon: HugeIcons.strokeRoundedRefresh,
                    tooltip: 'Reset view',
                    onTap: _resetView,
                  ),
                  _CtrlButton(
                    colors: colors,
                    icon: HugeIcons.strokeRoundedArrowUp01,
                    tooltip: 'Top view',
                    onTap: () => _setOrbit(0, 0, 4),
                  ),
                  _CtrlButton(
                    colors: colors,
                    icon: HugeIcons.strokeRoundedArrowRight01,
                    tooltip: 'Side view',
                    onTap: () => _setOrbit(90, 90, 4),
                  ),
                  _CtrlButton(
                    colors: colors,
                    icon: HugeIcons.strokeRoundedZoomInArea,
                    tooltip: 'Zoom in',
                    onTap: () => _setOrbit(0, 75, 2),
                  ),
                  _CtrlButton(
                    colors: colors,
                    icon: HugeIcons.strokeRoundedZoomOutArea,
                    tooltip: 'Zoom out',
                    onTap: () => _setOrbit(0, 75, 6),
                  ),
                ],
              ),
            ),
          // Animation play/pause — top-left, only if animations exist
          if (_animations.isNotEmpty)
            Positioned(
              top: 8,
              left: 8,
              child: _CtrlButton(
                colors: colors,
                icon: _isPlaying
                    ? HugeIcons.strokeRoundedPause
                    : HugeIcons.strokeRoundedPlay,
                tooltip: _isPlaying ? 'Pause animation' : 'Play animation',
                onTap: _togglePlay,
              ),
            ),
          // Texture chips — bottom, only if textures exist
          if (_textures.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 8,
              child: SizedBox(
                height: 30,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  itemCount: _textures.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (_, i) {
                    final name = _textures[i];
                    return _TextureChip(
                      colors: colors,
                      label: name,
                      onTap: () => _selectTexture(name),
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ControlsColumn extends StatelessWidget {
  const _ControlsColumn({required this.colors, required this.children});
  final AppColorSet colors;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const SizedBox(height: 4),
          ],
        ],
      ),
    );
  }
}

class _CtrlButton extends StatelessWidget {
  const _CtrlButton({
    required this.colors,
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final AppColorSet colors;
  final dynamic icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.black.withValues(alpha: 0.55),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 36,
            height: 36,
            child: Center(
              child: HugeIcon(icon: icon, size: 16, color: colors.brand),
            ),
          ),
        ),
      ),
    );
  }
}

class _TextureChip extends StatelessWidget {
  const _TextureChip({
    required this.colors,
    required this.label,
    required this.onTap,
  });

  final AppColorSet colors;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(15),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            label,
            style: AppTypography.caption.copyWith(
              color: colors.brand,
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ),
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
      height: 320,
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
