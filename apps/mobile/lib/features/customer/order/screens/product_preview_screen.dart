import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Product Preview (ArtworkMockupRender) — always labeled non-production.
class ProductPreviewScreen extends ConsumerStatefulWidget {
  const ProductPreviewScreen({
    super.key,
    required this.artworkFileId,
    this.productType = 'flyer',
    this.orderId,
    this.categoryHint,
  });

  final int artworkFileId;
  final String productType;
  final int? orderId;
  final String? categoryHint;

  @override
  ConsumerState<ProductPreviewScreen> createState() =>
      _ProductPreviewScreenState();
}

class _ProductPreviewScreenState extends ConsumerState<ProductPreviewScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _mockup;

  @override
  void initState() {
    super.initState();
    // ignore: discarded_futures
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{
        'artworkFileId': widget.artworkFileId,
        'productType': widget.productType,
        if (widget.orderId != null) 'orderId': widget.orderId,
        if (widget.categoryHint != null) 'categoryHint': widget.categoryHint,
      };
      final res = await ApiClient.instance.dio.post(
        '/mockups/render',
        data: body,
      );
      if (!mounted) return;
      setState(() {
        _mockup = Map<String, dynamic>.from(res.data as Map);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final surface = _parseColor(_mockup?['surfaceColor'] as String?) ??
        colors.surfaceVariant;
    final accent =
        _parseColor(_mockup?['accentColor'] as String?) ?? colors.accent;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Product Preview',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Preview unavailable',
                            style: AppTypography.h3
                                .copyWith(color: colors.onBackground),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: AppTypography.body
                                .copyWith(color: colors.onSurfaceDim),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          FilledButton(
                            onPressed: _load,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.warning.withValues(alpha: 0.15),
                          borderRadius: AppRadius.borderMd,
                          border: Border.all(color: colors.warning),
                        ),
                        child: Row(
                          children: [
                            HugeIcon(
                              icon: HugeIcons.strokeRoundedAlert02,
                              color: colors.warning,
                              size: 22,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                'MOCKUP — NOT PRINT-READY\n'
                                'Static template composite for layout only. '
                                'This is not production artwork.',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onBackground,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      AspectRatio(
                        aspectRatio: 4 / 3,
                        child: Container(
                          decoration: BoxDecoration(
                            color: surface,
                            borderRadius: AppRadius.borderLg,
                            border: Border.all(color: accent, width: 2),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              HugeIcon(
                                icon: HugeIcons.strokeRoundedImage01,
                                color: accent,
                                size: 48,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              Text(
                                (_mockup?['label'] as String?) ??
                                    'Product mockup',
                                style: AppTypography.h3
                                    .copyWith(color: colors.onBackground),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Template ${_mockup?['templateVersion'] ?? '—'}',
                                style: AppTypography.caption
                                    .copyWith(color: colors.onSurfaceDim),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.md,
                                  vertical: AppSpacing.xs,
                                ),
                                decoration: BoxDecoration(
                                  color: accent,
                                  borderRadius: AppRadius.borderSm,
                                ),
                                child: Text(
                                  'NON-PRODUCTION',
                                  style: AppTypography.overline.copyWith(
                                    color: Colors.black87,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      _metaRow(
                        colors,
                        'Product type',
                        '${_mockup?['productType'] ?? widget.productType}',
                      ),
                      _metaRow(
                        colors,
                        'Artwork file',
                        '#${widget.artworkFileId}',
                      ),
                      _metaRow(
                        colors,
                        'Render status',
                        '${_mockup?['renderStatus'] ?? '—'}',
                      ),
                      if (_mockup?['renderUrl'] != null)
                        _metaRow(
                          colors,
                          'Template URL',
                          '${_mockup!['renderUrl']}',
                        ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Compatible templates: flyer, tarpaulin, signage, t-shirt. '
                        'Full photoreal composites are deferred; previews stay versioned.',
                        style: AppTypography.caption
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _metaRow(AppColorSet colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.body.copyWith(color: colors.onBackground),
            ),
          ),
        ],
      ),
    );
  }

  Color? _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    var value = hex.replaceFirst('#', '');
    if (value.length == 6) value = 'FF$value';
    final n = int.tryParse(value, radix: 16);
    if (n == null) return null;
    return Color(n);
  }
}
