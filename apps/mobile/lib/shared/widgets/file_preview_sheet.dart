import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

/// Displays a bottom sheet that fetches a presigned URL and renders the file.
///
/// Supports images (jpeg/png/webp), PDFs, and a fallback "Open in browser"
/// for unsupported types.
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

  /// Opens the sheet as a modal bottom sheet.
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

class _FilePreviewSheetState extends ConsumerState<FilePreviewSheet> {
  String? _presignedUrl;
  bool _loading = true;
  String? _error;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _fetchPresignedUrl();
  }

  Future<void> _fetchPresignedUrl() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response =
          await ApiClient.instance.get('/files/${widget.fileId}/presigned-url');
      if (mounted) {
        setState(() {
          _presignedUrl = response.data['url'] as String?;
          _loading = false;
        });
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
    final height = MediaQuery.of(context).size.height * 0.85;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.outline,
              borderRadius: AppRadius.borderFull,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.fileName,
                        style: AppTypography.bodyBold
                            .copyWith(color: colors.onBackground),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (widget.fileSize != null) ...[
                        const SizedBox(height: AppSpacing.xs),
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
                  icon: Icon(Icons.close_rounded, color: colors.onSurface),
                ),
              ],
            ),
          ),
          Divider(color: colors.outline, height: 1),
          Expanded(child: _buildContent(colors)),
        ],
      ),
    );
  }

  Widget _buildContent(AppColorSet colors) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null || _presignedUrl == null) {
      return _buildError(colors);
    }

    final url = _presignedUrl!;
    final mime = widget.mimeType;

    if (mime.startsWith('image/')) {
      return InteractiveViewer(
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.contain,
            placeholder: (context, url) =>
                const Center(child: CircularProgressIndicator()),
            errorWidget: (context, url, error) => _buildError(colors),
          ),
        ),
      );
    }

    if (mime == 'application/pdf') {
      return SfPdfViewer.network(url);
    }

    return _buildUnsupported(colors, url);
  }

  Widget _buildError(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FileTypeIcon(mimeType: widget.mimeType, size: 64),
          const SizedBox(height: AppSpacing.lg),
          Text(
            _error ?? 'Preview unavailable',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          TextButton(
            onPressed: _fetchPresignedUrl,
            child: Text(
              'Retry',
              style: AppTypography.bodyBold.copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUnsupported(AppColorSet colors, String url) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FileTypeIcon(mimeType: widget.mimeType, size: 64),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Preview not available for this file type.',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: () => launchUrl(Uri.parse(url)),
            icon: const Icon(Icons.open_in_new_rounded, size: 16),
            label: const Text('Open in browser'),
          ),
        ],
      ),
    );
  }
}
