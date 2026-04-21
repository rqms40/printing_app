import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

class FilePreviewSheet extends ConsumerStatefulWidget {
  const FilePreviewSheet({
    super.key,
    required this.fileId,
    required this.fileName,
    required this.mimeType,
    this.fileSize,
  });

  final int fileId;
  final String fileName;
  final String mimeType;
  final int? fileSize;

  static Future<void> show(
    BuildContext context, {
    required int fileId,
    required String fileName,
    required String mimeType,
    int? fileSize,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (_) => FilePreviewSheet(
        fileId: fileId,
        fileName: fileName,
        mimeType: mimeType,
        fileSize: fileSize,
      ),
    );
  }

  @override
  ConsumerState<FilePreviewSheet> createState() => _FilePreviewSheetState();
}

class _FilePreviewSheetState extends ConsumerState<FilePreviewSheet>
    with SingleTickerProviderStateMixin {
  String? _presignedUrl;
  bool _loading = true;
  String? _error;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fetchPresignedUrl();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchPresignedUrl() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    _fadeCtrl.reset();
    try {
      final response =
          await ApiClient.instance.get('/files/${widget.fileId}/presigned-url');
      if (mounted) {
        setState(() {
          _presignedUrl = response.data['url'] as String?;
          _loading = false;
        });
        _fadeCtrl.forward();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Couldn\'t load preview.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final height = MediaQuery.of(context).size.height * 0.88;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 32,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildHandle(colors),
          _buildHeader(colors),
          Divider(color: colors.outline.withValues(alpha: 0.5), height: 1),
          Expanded(child: _buildContent(colors)),
        ],
      ),
    );
  }

  Widget _buildHandle(AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 4),
      child: Center(
        child: Container(
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: colors.outline.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.sm,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          FileTypeIcon(mimeType: widget.mimeType, size: 32),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.fileName,
                  style: AppTypography.bodyBold
                      .copyWith(color: colors.onBackground),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.fileSize != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    formatFileSize(widget.fileSize!),
                    style: AppTypography.caption
                        .copyWith(color: colors.onSurfaceDim),
                  ),
                ],
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
    );
  }

  Widget _buildContent(AppColorSet colors) {
    if (_loading) return _buildLoading(colors);
    if (_error != null || _presignedUrl == null) return _buildError(colors);

    final url = _presignedUrl!;
    final mime = widget.mimeType;

    if (mime.startsWith('image/')) {
      return FadeTransition(
        opacity: _fadeAnim,
        child: InteractiveViewer(
          minScale: 0.5,
          maxScale: 6,
          child: Center(
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.contain,
              fadeInDuration: const Duration(milliseconds: 200),
              placeholder: (_, _) => _buildLoading(colors),
              errorWidget: (_, _, _) => _buildError(colors),
            ),
          ),
        ),
      );
    }

    if (mime == 'application/pdf') {
      if (kIsWeb) return _buildUnsupported(colors, url);
      return FadeTransition(
        opacity: _fadeAnim,
        child: SfPdfViewer.network(
          url,
          onDocumentLoadFailed: (_) {
            if (mounted) {
              setState(() {
                _error = 'Failed to load PDF.';
              });
            }
          },
        ),
      );
    }

    return _buildUnsupported(colors, url);
  }

  Widget _buildLoading(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: colors.accent,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Loading preview…',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }

  Widget _buildError(AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FileTypeIcon(mimeType: widget.mimeType, size: 56),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _error ?? 'Preview unavailable',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _fetchPresignedUrl,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Try again'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUnsupported(AppColorSet colors, String url) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FileTypeIcon(mimeType: widget.mimeType, size: 64),
            const SizedBox(height: AppSpacing.lg),
            Text(
              widget.fileName,
              style: AppTypography.bodyBold
                  .copyWith(color: colors.onBackground),
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Preview not available for this file type.',
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () async {
                  final uri = Uri.parse(url);
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  }
                },
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Open in browser'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Close'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
