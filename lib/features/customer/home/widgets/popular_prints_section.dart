import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Horizontal carousel of popular print type cards with illustrated previews.
class PopularPrintsSection extends StatelessWidget {
  const PopularPrintsSection({super.key});

  static const _prints = <_PrintTypeData>[
    _PrintTypeData(
      title: 'Documents',
      price: 'from ₱3',
      unit: '/ page',
      gradientColors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
      illustrationType: _IllustrationType.documents,
    ),
    _PrintTypeData(
      title: 'ID Photos',
      price: 'from ₱15',
      unit: '/ set',
      gradientColors: [Color(0xFF1A2E1A), Color(0xFF0F2F1A)],
      illustrationType: _IllustrationType.photos,
    ),
    _PrintTypeData(
      title: 'Posters',
      price: 'from ₱45',
      unit: '/ pc',
      gradientColors: [Color(0xFF2E1A2E), Color(0xFF1A1A2E)],
      illustrationType: _IllustrationType.posters,
    ),
    _PrintTypeData(
      title: 'Thesis Bind',
      price: 'from ₱120',
      unit: '/ copy',
      gradientColors: [Color(0xFF2E2A1A), Color(0xFF1A1A0E)],
      illustrationType: _IllustrationType.thesis,
    ),
    _PrintTypeData(
      title: '3D Prints',
      price: 'from ₱150',
      unit: '/ model',
      gradientColors: [Color(0xFF1A2E2E), Color(0xFF0E1A2E)],
      illustrationType: _IllustrationType.threeDPrint,
    ),
    _PrintTypeData(
      title: 'Stickers',
      price: 'from ₱25',
      unit: '/ sheet',
      gradientColors: [Color(0xFF2E1A1E), Color(0xFF2E1A2A)],
      illustrationType: _IllustrationType.stickers,
    ),
  ];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Popular Prints',
          actionLabel: 'See All',
          onAction: () => context.push('/customer/order/new'),
        ),
        SizedBox(
          height: 175,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _prints.length,
            separatorBuilder: (_, _) =>
                const SizedBox(width: AppSpacing.sm + 4),
            itemBuilder: (context, index) {
              final printType = _prints[index];
              return _PrintCard(
                data: printType,
                colors: colors,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.15,
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  );
            },
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
enum _IllustrationType { documents, photos, posters, thesis, threeDPrint, stickers }

class _PrintTypeData {
  final String title;
  final String price;
  final String unit;
  final List<Color> gradientColors;
  final _IllustrationType illustrationType;

  const _PrintTypeData({
    required this.title,
    required this.price,
    required this.unit,
    required this.gradientColors,
    required this.illustrationType,
  });
}

// ---------------------------------------------------------------------------
// Print card
// ---------------------------------------------------------------------------
class _PrintCard extends StatefulWidget {
  const _PrintCard({
    required this.data,
    required this.colors,
    required this.onTap,
  });

  final _PrintTypeData data;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  State<_PrintCard> createState() => _PrintCardState();
}

class _PrintCardState extends State<_PrintCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          width: 150,
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: isDark
                  ? widget.colors.outline.withValues(alpha: 0.5)
                  : widget.colors.outlineVariant,
              width: 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Illustration area
              Container(
                height: 100,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? widget.data.gradientColors
                        : [
                            widget.data.gradientColors[0]
                                .withValues(alpha: 0.08),
                            widget.data.gradientColors[1]
                                .withValues(alpha: 0.12),
                          ],
                  ),
                ),
                child: Center(
                  child: _buildIllustration(widget.data.illustrationType, isDark),
                ),
              ),
              // Text body
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.data.title,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: widget.data.price,
                            style: AppTypography.caption.copyWith(
                              color: widget.colors.brand,
                              fontWeight: FontWeight.w600,
                              fontSize: 11,
                            ),
                          ),
                          TextSpan(
                            text: ' ${widget.data.unit}',
                            style: AppTypography.caption.copyWith(
                              color: widget.colors.onSurfaceDim,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Illustrations — pure Flutter painting, no images
// ---------------------------------------------------------------------------
Widget _buildIllustration(_IllustrationType type, bool isDark) {
  switch (type) {
    case _IllustrationType.documents:
      return _DocumentsIllustration(isDark: isDark);
    case _IllustrationType.photos:
      return _PhotosIllustration(isDark: isDark);
    case _IllustrationType.posters:
      return _PostersIllustration(isDark: isDark);
    case _IllustrationType.thesis:
      return _ThesisIllustration(isDark: isDark);
    case _IllustrationType.threeDPrint:
      return _ThreeDIllustration(isDark: isDark);
    case _IllustrationType.stickers:
      return _StickersIllustration(isDark: isDark);
  }
}

class _DocumentsIllustration extends StatelessWidget {
  const _DocumentsIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Transform.translate(
          offset: const Offset(-4, 4),
          child: Container(
            width: 48,
            height: 62,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFFE0E0E0) : const Color(0xFFCCCCCC),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
        Container(
          width: 48,
          height: 62,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFFF0F0F0) : const Color(0xFFE8E8E8),
            borderRadius: BorderRadius.circular(3),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 8,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(height: 3, width: 32, color: const Color(0xFFAAAAAA)),
              const SizedBox(height: 4),
              Container(height: 3, width: 24, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 4),
              Container(height: 3, width: 28, color: const Color(0xFFBBBBBB)),
              const SizedBox(height: 4),
              Container(height: 3, width: 20, color: const Color(0xFFCCCCCC)),
            ],
          ),
        ),
      ],
    );
  }
}

class _PhotosIllustration extends StatelessWidget {
  const _PhotosIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 60,
      height: 50,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            isDark ? const Color(0xFFFFDE58) : const Color(0xFFD4A017),
            isDark ? const Color(0xFFFF9800) : const Color(0xFFB8860B),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFDE58).withValues(alpha: isDark ? 0.3 : 0.15),
            blurRadius: 12,
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: 8,
            right: 10,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.8),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(4),
              ),
              child: CustomPaint(
                size: const Size(60, 22),
                painter: _MountainPainter(isDark: isDark),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MountainPainter extends CustomPainter {
  _MountainPainter({required this.isDark});
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = isDark ? const Color(0xFF4CAF50) : const Color(0xFF2E7D32);
    final path = Path()
      ..moveTo(0, size.height)
      ..lineTo(size.width * 0.3, size.height * 0.2)
      ..lineTo(size.width * 0.55, size.height * 0.6)
      ..lineTo(size.width * 0.75, size.height * 0.15)
      ..lineTo(size.width, size.height * 0.5)
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PostersIllustration extends StatelessWidget {
  const _PostersIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 50,
      height: 65,
      decoration: BoxDecoration(
        border: Border.all(
          color: isDark ? const Color(0xFFF0F0F0) : const Color(0xFF555555),
          width: 2,
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Text(
          'A2',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: (isDark ? const Color(0xFFF0F0F0) : const Color(0xFF555555))
                .withValues(alpha: 0.6),
          ),
        ),
      ),
    );
  }
}

class _ThesisIllustration extends StatelessWidget {
  const _ThesisIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Transform.translate(
          offset: const Offset(-3, 0),
          child: Container(
            width: 6,
            height: 60,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF5C3310) : const Color(0xFF8B6914),
              borderRadius: const BorderRadius.horizontal(
                left: Radius.circular(2),
              ),
            ),
          ),
        ),
        Container(
          width: 45,
          height: 60,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [const Color(0xFF8B4513), const Color(0xFF654321)]
                  : [const Color(0xFFA0522D), const Color(0xFF8B4513)],
            ),
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(4),
              left: Radius.circular(2),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
              const SizedBox(height: 6),
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
              const SizedBox(height: 6),
              Container(height: 2, width: 28, color: const Color(0xFFFFDE58)),
            ],
          ),
        ),
      ],
    );
  }
}

class _ThreeDIllustration extends StatelessWidget {
  const _ThreeDIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: 0.785,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFFFFDE58), const Color(0xFFE6C84A)]
                : [const Color(0xFFD4A017), const Color(0xFFB8960A)],
          ),
          borderRadius: BorderRadius.circular(4),
          boxShadow: [
            BoxShadow(
              color: isDark
                  ? const Color(0xFFB8960A)
                  : const Color(0xFF8B7510),
              offset: const Offset(4, 4),
              blurRadius: 0,
            ),
            BoxShadow(
              color: const Color(0xFFFFDE58).withValues(alpha: isDark ? 0.2 : 0.1),
              blurRadius: 20,
            ),
          ],
        ),
      ),
    );
  }
}

class _StickersIllustration extends StatelessWidget {
  const _StickersIllustration({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.rotate(
          angle: -0.17,
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFFFF6B6B) : const Color(0xFFE05555),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(-4, -6),
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFFFFDE58) : const Color(0xFFD4A017),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(-8, 0),
          child: Transform.rotate(
            angle: 0.17,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? const Color(0xFF51CF66) : const Color(0xFF2E7D32),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.2),
                  width: 2,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
