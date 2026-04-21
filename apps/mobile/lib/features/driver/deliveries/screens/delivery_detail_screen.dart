import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';
import 'package:printing_app/features/driver/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/driver/deliveries/widgets/checkpoint_action.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Detail screen for a single delivery assignment.
class DeliveryDetailScreen extends ConsumerWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.assignmentId,
  });

  final String assignmentId;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final deliveriesState = ref.watch(deliveriesProvider);
    final notifier = ref.read(deliveriesProvider.notifier);

    final assignment = deliveriesState.assignments.firstWhere(
      (a) => a.id == assignmentId,
      orElse: () => MockData.deliveryAssignments.first,
    );

    final order = MockData.orders.firstWhere(
      (o) => o.id == assignment.orderId,
      orElse: () => MockData.orders.first,
    );

    final Address? address = order.deliveryAddressId != null
        ? MockData.addresses.cast<dynamic>().firstWhere(
              (a) => a.id == order.deliveryAddressId,
              orElse: () => null,
            )
        : null;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          order.orderId,
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        elevation: 0,
        leading: IconButton(
          icon: HugeIcon(icon: HugeIcons.strokeRoundedArrowLeft01, color: colors.onBackground),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status badge
                  StatusBadge(
                    label: assignment.status.displayName,
                    variant: _badgeVariant(assignment.status),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Order info section
                  _buildSectionLabel(context, 'ORDER INFO'),
                  const SizedBox(height: AppSpacing.sm),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildInfoRow(
                            context, 'Category', order.category),
                        const SizedBox(height: AppSpacing.sm),
                        _buildInfoRow(
                            context, 'Quantity', '${order.quantity}'),
                        const SizedBox(height: AppSpacing.sm),
                        _buildInfoRow(
                          context,
                          'Total',
                          formatCurrency(order.totalPrice),
                        ),
                        if (order.paperSpecs != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          _buildInfoRow(
                            context,
                            'Specs',
                            '${order.paperSpecs!.paperSize.displayName}, '
                                '${order.paperSpecs!.colorMode.displayName}, '
                                '${order.paperSpecs!.mediaType.displayName}',
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Customer address section
                  if (address != null) ...[
                    _buildSectionLabel(context, 'DELIVERY ADDRESS'),
                    const SizedBox(height: AppSpacing.sm),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              HugeIcon(icon: HugeIcons.strokeRoundedLocation01,
                                  size: 18, color: colors.onSurface),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  address.fullAddress,
                                  style: AppTypography.body
                                      .copyWith(color: colors.onSurface),
                                ),
                              ),
                            ],
                          ),
                          if (address.landmark != null) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Padding(
                              padding:
                                  const EdgeInsets.only(left: 26),
                              child: Text(
                                address.landmark!,
                                style: AppTypography.bodyBold
                                    .copyWith(color: colors.onBackground),
                              ),
                            ),
                          ],
                          if (address.barangay != null) ...[
                            const SizedBox(height: AppSpacing.xs),
                            Padding(
                              padding:
                                  const EdgeInsets.only(left: 26),
                              child: Text(
                                'Brgy. ${address.barangay}, ${address.city}',
                                style: AppTypography.caption
                                    .copyWith(color: colors.onSurfaceDim),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  // Map preview
                  _buildSectionLabel(context, 'MAP'),
                  const SizedBox(height: AppSpacing.sm),
                  _RouteMapPreview(colors: colors),
                  const SizedBox(height: AppSpacing.sm),

                  // Navigate button
                  AppButton(
                    label: 'Navigate',
                    variant: AppButtonVariant.secondary,
                    isFullWidth: true,
                    icon: HugeIcons.strokeRoundedRoute01,
                    onTap: () async {
                      // Open Google Maps with destination coordinates
                      final lat = address?.latitude ?? 14.6400;
                      final lng = address?.longitude ?? 121.0530;
                      final url = Uri.parse(
                          'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url,
                            mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
          ),

          // Bottom checkpoint action
          if (assignment.status != DeliveryStatus.delivered &&
              assignment.status != DeliveryStatus.declined)
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(
                  top: BorderSide(color: colors.outline, width: 0.5),
                ),
              ),
              child: SafeArea(
                top: false,
                child: CheckpointAction(
                  currentStatus: assignment.status,
                  onAdvance: () =>
                      notifier.advanceCheckpoint(assignmentId),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(BuildContext context, String label) {
    final colors = _colors(context);
    return Text(
      label,
      style: AppTypography.overline.copyWith(color: colors.onSurfaceDim),
    );
  }

  Widget _buildInfoRow(BuildContext context, String label, String value) {
    final colors = _colors(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: AppTypography.caption
                .copyWith(color: colors.onSurfaceDim),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style:
                AppTypography.body.copyWith(color: colors.onBackground),
          ),
        ),
      ],
    );
  }

  StatusBadgeVariant _badgeVariant(DeliveryStatus status) {
    switch (status) {
      case DeliveryStatus.assigned:
        return StatusBadgeVariant.warning;
      case DeliveryStatus.accepted:
      case DeliveryStatus.pickedUp:
      case DeliveryStatus.onTheWay:
      case DeliveryStatus.arrived:
        return StatusBadgeVariant.info;
      case DeliveryStatus.delivered:
        return StatusBadgeVariant.success;
      case DeliveryStatus.declined:
        return StatusBadgeVariant.error;
    }
  }
}

/// Static map preview that loads a real OSRM route.
class _RouteMapPreview extends StatefulWidget {
  const _RouteMapPreview({required this.colors});
  final AppColorSet colors;

  @override
  State<_RouteMapPreview> createState() => _RouteMapPreviewState();
}

class _RouteMapPreviewState extends State<_RouteMapPreview> {
  List<LatLng>? _routePoints;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  Future<void> _loadRoute() async {
    final pts = await RoutingService.getRoute(
      MapHelpers.shopPoint,
      MapHelpers.destinationPoint,
    );
    if (mounted) setState(() => _routePoints = pts);
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderMd,
      child: Container(
        height: 200,
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: widget.colors.outline, width: 0.5),
          borderRadius: AppRadius.borderMd,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderMd,
          child: _routePoints == null
              ? Center(
                  child: CircularProgressIndicator(
                    color: widget.colors.accent,
                    strokeWidth: 2,
                  ),
                )
              : FlutterMap(
                  options: const MapOptions(
                    initialCenter: MapHelpers.mapCenter,
                    initialZoom: 12.0,
                    interactionOptions: InteractionOptions(flags: 0),
                  ),
                  children: [
                    MapHelpers.tileLayer(Theme.of(context).brightness),
                    MapHelpers.routePolyline(_routePoints!),
                    MarkerLayer(
                      markers: [
                        MapHelpers.shopMarker(),
                        MapHelpers.destinationMarker(),
                      ],
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
