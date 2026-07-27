import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfx/pdfx.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/repositories/ruler_scale_preferences.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/shared/widgets/ruler_overlay.dart';
import 'package:printing_app/utils/formatters.dart';

class FilePreviewSheet extends ConsumerStatefulWidget {
  const FilePreviewSheet({
    super.key,
    required this.fileId,
    required this.fileName,
    required this.mimeType,
    this.fileSize,
    this.widthMm,
    this.heightMm,
  });

  final int fileId;
  final String fileName;
  final String mimeType;
  final int? fileSize;
  final double? widthMm;
  final double? heightMm;

  static Future<void> show(
    BuildContext context, {
    required int fileId,
    required String fileName,
    required String mimeType,
    int? fileSize,
    double? widthMm,
    double? heightMm,
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
        widthMm: widthMm,
        heightMm: heightMm,
      ),
    );
  }

  @override
  ConsumerState<FilePreviewSheet> createState() => _FilePreviewSheetState();
}

class MetricScalePicker extends StatefulWidget {
  const MetricScalePicker({
    super.key,
    required this.initialDenominator,
    required this.onSelected,
  });

  final int initialDenominator;
  final ValueChanged<int> onSelected;

  @override
  State<MetricScalePicker> createState() => _MetricScalePickerState();
}

class _MetricScalePickerState extends State<MetricScalePicker> {
  final _customController = TextEditingController();
  bool _showCustom = false;
  String? _customError;

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  void _applyCustom() {
    final raw = _customController.text.trim();
    final value = int.tryParse(raw);
    if (value == null || value <= 0 || raw.contains('.')) {
      setState(() => _customError = 'Enter a positive whole number');
      return;
    }
    if (!isSupportedMetricScaleDenominator(value)) {
      setState(
        () => _customError =
            'Enter a scale between 1:1 and 1:$kMaxMetricScaleDenominator',
      );
      return;
    }
    setState(() => _customError = null);
    widget.onSelected(value);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Metric scale',
                style: AppTypography.h3.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: 4),
              Text(
                'Calibrated to the fitted document preview.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final scale in kMetricScales)
                    ChoiceChip(
                      label: Text(scale.label),
                      selected:
                          scale.denominator == widget.initialDenominator &&
                          !_showCustom,
                      onSelected: (_) => widget.onSelected(scale.denominator),
                    ),
                  ChoiceChip(
                    label: const Text('Custom'),
                    selected: _showCustom,
                    onSelected: (_) => setState(() {
                      _showCustom = true;
                      _customError = null;
                    }),
                  ),
                ],
              ),
              if (_showCustom) ...[
                const SizedBox(height: AppSpacing.md),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 14),
                      child: Text('1:'),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: TextField(
                        controller: _customController,
                        autofocus: true,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Scale denominator',
                          errorText: _customError,
                        ),
                        onSubmitted: (_) => _applyCustom(),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: FilledButton(
                        onPressed: _applyCustom,
                        child: const Text('Apply'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FilePreviewSheetState extends ConsumerState<FilePreviewSheet>
    with SingleTickerProviderStateMixin {
  String? _presignedUrl;
  bool _loading = true;
  String? _error;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  bool _showRuler = false;
  int _rulerScaleDenominator = RulerScalePreferences.defaultDenominator;
  PdfController? _pdfController;
  double? _widthMm;
  double? _heightMm;

  MetricScale get _rulerScale =>
      MetricScale(denominator: _rulerScaleDenominator);

  Future<void> _openRulerScalePicker() async {
    final selectedDenominator = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (context) => MetricScalePicker(
        initialDenominator: _rulerScaleDenominator,
        onSelected: (value) => Navigator.of(context).pop(value),
      ),
    );

    if (selectedDenominator == null || !mounted) return;
    setState(() {
      _rulerScaleDenominator = selectedDenominator;
    });
    await RulerScalePreferences().save(
      ref.read(authProvider).user?.id,
      selectedDenominator,
    );
  }

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  @override
  void initState() {
    super.initState();
    _widthMm = widget.widthMm;
    _heightMm = widget.heightMm;
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _restoreRulerScale();
    _fetchPresignedUrl();
  }

  Future<void> _restoreRulerScale() async {
    final denominator = await RulerScalePreferences().load(
      ref.read(authProvider).user?.id,
    );
    if (!mounted) return;
    setState(() => _rulerScaleDenominator = denominator);
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _pdfController?.dispose();
    super.dispose();
  }

  Future<void> _fetchPresignedUrl() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    _fadeCtrl.reset();
    String stage = 'request';
    try {
      stage = 'request';
      final response = await ApiClient.instance.get(
        '/files/${widget.fileId}/presigned-url',
      );
      final url = response.data['url'] as String?;

      if (!mounted) return;

      // If this is a PDF, eagerly build the controller from URL bytes so
      // that a fresh controller is always created on each fetch (fixing the
      // stale-controller-on-retry bug).
      PdfController? newPdfController;
      if (url != null && widget.mimeType == 'application/pdf') {
        stage = 'download';
        final bytes = await Dio().get<List<int>>(
          url,
          options: Options(
            responseType: ResponseType.bytes,
            receiveTimeout: const Duration(seconds: 30),
          ),
        );
        final rawBytes = bytes.data;
        if (rawBytes == null || rawBytes.isEmpty) {
          throw Exception('Empty PDF response body');
        }
        final data = Uint8List.fromList(rawBytes);
        stage = 'parse';
        // Pre-resolve the document so a parse error surfaces here (with a
        // clean stage label) instead of disappearing into PdfController.
        final document = await PdfDocument.openData(data);
        newPdfController = PdfController(document: Future.value(document));
      }

      if (!mounted) {
        newPdfController?.dispose();
        return;
      }

      _pdfController?.dispose();
      setState(() {
        _presignedUrl = url;
        _pdfController = newPdfController;
        _loading = false;
      });
      _fadeCtrl.forward();
    } catch (e) {
      // ignore: avoid_print
      print('[FilePreviewSheet] $stage failed: $e');
      if (mounted) {
        _pdfController?.dispose();
        _pdfController = null;
        final reason = switch (stage) {
          'request' => "We couldn't fetch the file link.",
          'download' => "Couldn't download the PDF.",
          'parse' => "This PDF couldn't be opened.",
          _ => "Couldn't load preview.",
        };
        setState(() {
          _presignedUrl = null;
          _error = reason;
          _loading = false;
          _showRuler = false;
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
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.fileSize != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    formatFileSize(widget.fileSize!),
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Builder(
            builder: (context) {
              final brand = Theme.of(context).brightness == Brightness.dark
                  ? AppColors.brandDark
                  : AppColors.brandLight;
              return Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Material(
                  color: _showRuler
                      ? brand.withValues(alpha: 0.18)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => setState(() => _showRuler = !_showRuler),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.straighten_rounded,
                            size: 18,
                            color: _showRuler ? brand : colors.onSurfaceDim,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Ruler',
                            style: AppTypography.caption.copyWith(
                              color: _showRuler ? brand : colors.onSurfaceDim,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
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
      return Stack(
        children: [
          FadeTransition(
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
          ),
          if (_showRuler)
            Positioned.fill(
              child: RulerOverlay(
                widthMm: _widthMm ?? 210.0,
                heightMm: _heightMm ?? 297.0,
                scale: _rulerScale,
                onCycleScale: _openRulerScalePicker,
              ),
            ),
        ],
      );
    }

    if (mime == 'application/pdf') {
      return Stack(
        children: [
          FadeTransition(
            opacity: _fadeAnim,
            child: PdfView(
              controller: _pdfController!,
              scrollDirection: Axis.vertical,
              onDocumentError: (_) {
                if (mounted) {
                  setState(() {
                    _error = 'Failed to load PDF.';
                    _showRuler = false;
                  });
                }
              },
            ),
          ),
          if (_showRuler)
            Positioned.fill(
              child: RulerOverlay(
                widthMm: _widthMm ?? 210.0,
                heightMm: _heightMm ?? 297.0,
                scale: _rulerScale,
                onCycleScale: _openRulerScalePicker,
              ),
            ),
        ],
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
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Preview not available for this file type.',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
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
