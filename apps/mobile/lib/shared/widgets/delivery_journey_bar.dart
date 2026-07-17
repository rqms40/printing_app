import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Grab-style journey strip: store → vehicle → home.
///
/// The vehicle chip rides along the track and the segment behind it fills
/// with the brand color, so "how close is my order" reads at a glance —
/// the same grammar ride-hailing apps use for courier progress.
class DeliveryJourneyBar extends StatelessWidget {
  const DeliveryJourneyBar({
    super.key,
    required this.colors,
    required this.progress,
    this.compact = false,
    this.remainingLabel,
  });

  final AppColorSet colors;

  /// 0 = still at the store, 1 = at the customer's door.
  final double progress;

  /// Tighter paddings/sizes for the home bento tile.
  final bool compact;

  /// Optional "1.2 km · ~4 min away" caption under the strip.
  final String? remainingLabel;

  @override
  Widget build(BuildContext context) {
    final clamped = progress.clamp(0.0, 1.0);
    final endIconSize = compact ? 13.0 : 16.0;
    final chipSize = compact ? 22.0 : 28.0;
    final trackHeight = compact ? 3.0 : 4.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(
              Icons.storefront_rounded,
              size: endIconSize,
              color: colors.onSurfaceDim,
            ),
            const SizedBox(width: 4),
            Expanded(
              child: SizedBox(
                height: chipSize,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final usable = constraints.maxWidth - chipSize;
                    final offset = usable * clamped;
                    return Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        // Track: filled behind the vehicle, dashed-dim ahead.
                        Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: chipSize / 2,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(trackHeight),
                            child: LinearProgressIndicator(
                              value: clamped,
                              minHeight: trackHeight,
                              backgroundColor: colors.outline.withValues(
                                alpha: 0.45,
                              ),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                colors.brand,
                              ),
                            ),
                          ),
                        ),
                        AnimatedPositioned(
                          duration: const Duration(milliseconds: 600),
                          curve: Curves.easeOutCubic,
                          left: offset,
                          child: Container(
                            width: chipSize,
                            height: chipSize,
                            decoration: BoxDecoration(
                              color: colors.brand,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(0xFF141414),
                                width: 1.5,
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x40000000),
                                  blurRadius: 4,
                                  offset: Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Icon(
                              Icons.two_wheeler_rounded,
                              size: compact ? 13 : 16,
                              color: const Color(0xFF141414),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.home_rounded,
              size: endIconSize,
              color: clamped >= 0.999 ? colors.brand : colors.onSurfaceDim,
            ),
          ],
        ),
        if (remainingLabel != null) ...[
          SizedBox(height: compact ? 2 : 4),
          Text(
            remainingLabel!,
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: compact ? 9 : 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}
