import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_driver_location_provider.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

class MapTrackingTile extends ConsumerWidget {
  const MapTrackingTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mapAsync = ref.watch(liveDeliveryMapProvider);
    // Watched directly here so location updates only rebuild markers,
    // not the entire FutureProvider async cycle.
    final locationUpdate = ref.watch(liveDriverLocationProvider);
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final driverPoint = locationUpdate != null
        ? LatLng(locationUpdate.latitude, locationUpdate.longitude)
        : null;

    return GestureDetector(
      onTap: () => context.push('/customer/tracking'),
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: mapAsync.when(
          skipLoadingOnRefresh: true,
          loading: () => _LoadingTile(colors: colors),
          error: (e, st) => _IdleTile(brightness: brightness, colors: colors),
          data: (state) {
            if (state.status == LiveMapStatus.loading) {
              return _LoadingTile(colors: colors);
            }
            if (state.status == LiveMapStatus.active) {
              return _ActiveTile(
                state: state,
                brightness: brightness,
                driverPoint: driverPoint ?? state.shopPoint,
              );
            }
            return _IdleTile(brightness: brightness, colors: colors);
          },
        ),
      ),
    );
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────

class _LoadingTile extends StatelessWidget {
  const _LoadingTile({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.surfaceVariant,
      child: Center(child: CircularProgressIndicator(color: colors.accent)),
    );
  }
}

// ── Idle ─────────────────────────────────────────────────────────────────────

class _IdleTile extends StatelessWidget {
  const _IdleTile({required this.brightness, required this.colors});
  final Brightness brightness;
  final AppColorSet colors;

  static const _davaoZoom = 12.0;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
          options: const MapOptions(
            initialCenter: MapHelpers.davaoCenter,
            initialZoom: _davaoZoom,
            interactionOptions: InteractionOptions(flags: InteractiveFlag.none),
          ),
          children: [MapHelpers.tileLayer(brightness)],
        ),
        // Dim overlay
        Container(color: Colors.black.withValues(alpha: 0.35)),
        // Label
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.location_on_rounded,
                color: Colors.white,
                size: 28,
              ),
              const SizedBox(height: 6),
              Text(
                'No active delivery',
                style: AppTypography.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Active ────────────────────────────────────────────────────────────────────

class _ActiveTile extends StatelessWidget {
  const _ActiveTile({
    required this.state,
    required this.brightness,
    required this.driverPoint,
  });
  final LiveDeliveryMapState state;
  final Brightness brightness;
  final LatLng driverPoint;

  static int _etaMinutes(LatLng driver, List<LatLng> route) {
    if (route.isEmpty) return 0;
    const distance = Distance();
    var nearest = 0;
    var minDist = double.infinity;
    for (var i = 0; i < route.length; i++) {
      final d = distance(driver, route[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return route.length - nearest;
  }

  @override
  Widget build(BuildContext context) {
    final eta = _etaMinutes(driverPoint, state.routePoints);

    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: driverPoint,
            initialZoom: 13.8,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.none,
            ),
          ),
          children: [
            MapHelpers.tileLayer(brightness),
            if (state.routePoints.isNotEmpty)
              MapHelpers.routePolyline(state.routePoints),
            MarkerLayer(
              markers: [
                MapHelpers.shopMarker(point: state.shopPoint),
                MapHelpers.destinationMarker(point: state.destPoint),
                MapHelpers.driverMarker(driverPoint),
              ],
            ),
          ],
        ),

        // LIVE MAP badge — top left
        Positioned(
          top: AppSpacing.sm,
          left: AppSpacing.sm,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 3,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFFFDE58),
              borderRadius: AppRadius.borderFull,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  'LIVE MAP',
                  style: AppTypography.overline.copyWith(
                    color: Colors.black,
                    fontSize: 8,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ETA badge — top right
        Positioned(
          top: AppSpacing.sm,
          right: AppSpacing.sm,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 3,
            ),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.65),
              borderRadius: AppRadius.borderFull,
            ),
            child: Text(
              '~$eta min',
              style: AppTypography.overline.copyWith(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
