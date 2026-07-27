import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/maps/grid_map_controller.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Non-Google fallback for desktop runners, widget tests, and Maps auth failures.
class PlaceholderGridMapView extends StatelessWidget {
  const PlaceholderGridMapView({
    super.key,
    required this.initialCamera,
    this.controller,
    this.markers = const [],
    this.polylines = const [],
    this.message = 'Map preview unavailable on this platform',
  });

  final GridMapCamera initialCamera;
  final GridMapController? controller;
  final List<GridMapMarker> markers;
  final List<GridMapPolyline> polylines;
  final String message;

  @override
  Widget build(BuildContext context) {
    controller?.bind(
      moveTo: (_) {},
      fitBounds: (_, {padding = 48}) {},
    );

    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      color: colors.surfaceDim,
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, color: kRouteColor, size: 36),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(color: colors.onSurface),
              ),
              if (markers.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${markers.length} pin${markers.length == 1 ? '' : 's'}'
                  '${polylines.isEmpty ? '' : ' · ${polylines.length} route${polylines.length == 1 ? '' : 's'}'}',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${initialCamera.target.latitude.toStringAsFixed(4)}, '
                '${initialCamera.target.longitude.toStringAsFixed(4)}',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
