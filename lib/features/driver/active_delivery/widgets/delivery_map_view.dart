import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/active_delivery/providers/location_provider.dart';

/// Placeholder map container showing live tracking status and mock coordinates.
class DeliveryMapView extends ConsumerWidget {
  const DeliveryMapView({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final location = ref.watch(locationProvider);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderMd,
      ),
      child: Stack(
        children: [
          // Main content
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Pulsing dot + Live Tracking label
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _PulsingDot(color: colors.success),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Live Tracking Active',
                      style: AppTypography.bodyBold
                          .copyWith(color: colors.onSurface),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // Mock coordinates
                if (location != null)
                  Text(
                    '${location.latitude.toStringAsFixed(4)}, '
                    '${location.longitude.toStringAsFixed(4)}',
                    style: AppTypography.caption
                        .copyWith(color: colors.onSurfaceDim),
                  ),
              ],
            ),
          ),

          // Driver icon marker (top-left area)
          Positioned(
            top: 40,
            left: 60,
            child: HugeIcon(icon: HugeIcons.strokeRoundedDeliveryTruck02, size: 28, color: colors.info),
          ),

          // Destination icon marker (bottom-right area)
          Positioned(
            bottom: 40,
            right: 60,
            child:
                HugeIcon(icon: HugeIcons.strokeRoundedLocation01, size: 28, color: colors.error),
          ),
        ],
      ),
    );
  }
}

/// A small dot that pulses to indicate live status.
class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});

  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _animation,
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: widget.color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
