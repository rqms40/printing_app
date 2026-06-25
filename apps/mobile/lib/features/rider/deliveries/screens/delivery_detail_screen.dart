import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_checkpoint_panel.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_map_view.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';

/// Assignment overview before or after active navigation.
class DeliveryDetailScreen extends ConsumerStatefulWidget {
  const DeliveryDetailScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  ConsumerState<DeliveryDetailScreen> createState() =>
      _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends ConsumerState<DeliveryDetailScreen> {
  bool _isAdvancing = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  Future<void> _openCustomerChat(
    BuildContext context,
    String orderInternalId,
    String orderRef,
  ) async {
    final apiOrderRef = int.tryParse(orderInternalId) == null
        ? orderRef
        : orderInternalId;

    final conv = await ref
        .read(chatProvider.notifier)
        .openOrderConversation(apiOrderRef);
    if (!context.mounted) return;
    if (conv == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Could not open customer chat. Please try again.',
          ),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      );
      return;
    }

    final view = ref.read(deliveriesProvider).viewById(widget.assignmentId);
    final uri = Uri(
      path: '/rider/chat/${conv.id}',
      queryParameters: {
        'type': conv.type.name,
        'orderRef': orderRef,
        'orderStatus': view?.status.displayName ?? '',
      },
    );
    context.push(uri.toString());
  }

  Future<void> _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _navigateTo(LatLng? destination) async {
    final lat = destination?.latitude ?? 7.1907;
    final lng = destination?.longitude ?? 125.4553;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _handleAdvance() async {
    setState(() => _isAdvancing = true);
    await ref
        .read(deliveriesProvider.notifier)
        .advanceCheckpoint(widget.assignmentId);
    if (!mounted) return;
    setState(() => _isAdvancing = false);

    final view = ref.read(deliveriesProvider).viewById(widget.assignmentId);
    if (view?.isInProgress ?? false) {
      context.pushReplacement(
        '/rider/deliveries/${widget.assignmentId}/active',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(deliveriesProvider);
    final view = state.viewById(widget.assignmentId);

    if (view == null) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: const Text('Delivery'),
        ),
        body: const Center(child: Text('Assignment not found')),
      );
    }

    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;
    final destination = order.destination;
    final destLatLng = destination?.latLng;

    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.36,
            child: Stack(
              children: [
                Positioned.fill(
                  child: RiderMapView(
                    assignmentId: view.id,
                    destination: destLatLng,
                    trackLocation: false,
                    interactive: true,
                    showLiveBadge: false,
                    showRoute: view.isInProgress,
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: [
                        _FloatingIconButton(
                          icon: HugeIcons.strokeRoundedArrowLeft01,
                          onTap: () => Navigator.of(context).pop(),
                        ),
                        const Spacer(),
                        StatusBadge(
                          label: visual.label,
                          variant: visual.badgeVariant,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.orderRef,
                    style: AppTypography.h2.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    destination?.fullAddress ?? 'Address pending',
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: 'Navigate',
                          variant: AppButtonVariant.secondary,
                          icon: HugeIcons.strokeRoundedRoute01,
                          onTap: () => _navigateTo(destLatLng),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: AppButton(
                          label: 'Call',
                          variant: AppButtonVariant.secondary,
                          icon: HugeIcons.strokeRoundedCall,
                          onTap: () => _callCustomer(order.customerPhone),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: 'Chat customer',
                    variant: AppButtonVariant.secondary,
                    isFullWidth: true,
                    icon: HugeIcons.strokeRoundedMessage01,
                    onTap: () => _openCustomerChat(
                      context,
                      order.orderInternalId,
                      order.orderRef,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'ORDER DETAILS',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppCard(
                    child: Column(
                      children: [
                        _InfoRow(
                          label: 'Customer',
                          value: order.customerName ?? 'Customer',
                          colors: colors,
                        ),
                        _InfoRow(
                          label: 'Category',
                          value: order.category,
                          colors: colors,
                        ),
                        _InfoRow(
                          label: 'Quantity',
                          value: '${order.quantity}',
                          colors: colors,
                        ),
                        _InfoRow(
                          label: 'Delivery fee',
                          value: formatCurrency(order.deliveryFee),
                          colors: colors,
                        ),
                        if (destination?.landmark != null)
                          _InfoRow(
                            label: 'Landmark',
                            value: destination!.landmark!,
                            colors: colors,
                          ),
                      ],
                    ),
                  ),
                  if (view.isInProgress) ...[
                    const SizedBox(height: AppSpacing.md),
                    AppButton(
                      label: 'Open live delivery map',
                      isFullWidth: true,
                      icon: HugeIcons.strokeRoundedNavigation03,
                      onTap: () =>
                          context.push('/rider/deliveries/${view.id}/active'),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ),
          ),
          RiderCheckpointPanel(
            status: view.status,
            isLoading: _isAdvancing,
            onAdvance: _handleAdvance,
            onAccept: () async {
              setState(() => _isAdvancing = true);
              await ref
                  .read(deliveriesProvider.notifier)
                  .acceptAssignment(view.id);
              if (!context.mounted) return;
              setState(() => _isAdvancing = false);
              context.pushReplacement('/rider/deliveries/${view.id}/active');
            },
            onDecline: () => ref
                .read(deliveriesProvider.notifier)
                .declineAssignment(view.id),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    required this.colors,
  });

  final String label;
  final String value;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
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
}

class _FloatingIconButton extends StatelessWidget {
  const _FloatingIconButton({required this.icon, required this.onTap});

  final dynamic icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Material(
      color: colors.surface.withValues(alpha: 0.94),
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: HugeIcon(icon: icon, color: colors.onBackground, size: 20),
          ),
        ),
      ),
    );
  }
}
