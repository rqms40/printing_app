import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_checkpoint_panel.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_map_view.dart';
import 'package:printing_app/features/rider/shared/widgets/proof_of_delivery_sheet.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:url_launcher/url_launcher.dart';

/// Full-screen live delivery cockpit with map, customer actions, and checkpoints.
class ActiveDeliveryScreen extends ConsumerStatefulWidget {
  const ActiveDeliveryScreen({super.key, this.assignmentId});

  /// When null, uses the first in-progress assignment.
  final String? assignmentId;

  @override
  ConsumerState<ActiveDeliveryScreen> createState() =>
      _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends ConsumerState<ActiveDeliveryScreen> {
  static const _defaultSheetSize = 0.40;
  static const _proofSheetSize = 0.58;

  bool _isAdvancing = false;
  final _checkpointKey = GlobalKey();

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  RiderAssignmentView? _resolveView(DeliveriesState state) {
    if (widget.assignmentId != null) {
      return state.viewById(widget.assignmentId!);
    }
    return state.activeDelivery;
  }

  Future<void> _openCustomerChat(
    BuildContext context,
    RiderAssignmentView view,
  ) async {
    final order = view.order;
    final apiOrderRef = int.tryParse(order.orderInternalId) == null
        ? order.orderRef
        : order.orderInternalId;

    final conv = await ref
        .read(chatProvider.notifier)
        .openOrderConversation(apiOrderRef);
    if (!context.mounted) return;
    if (conv == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Could not open customer chat.'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      );
      return;
    }

    final uri = Uri(
      path: '/rider/chat/${conv.id}',
      queryParameters: {
        'type': conv.type.name,
        'orderRef': order.orderRef,
        'orderStatus': view.status.displayName,
      },
    );
    context.push(uri.toString());
  }

  Future<void> _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _navigateTo(RiderAssignmentView view) async {
    final dest = view.order.destination?.latLng;
    final lat = dest?.latitude ?? 7.1907;
    final lng = dest?.longitude ?? 125.4553;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _handleAdvance(String assignmentId) async {
    final current = ref.read(deliveriesProvider).viewById(assignmentId);
    if (current?.status == DeliveryStatus.arrived) {
      final proof = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        backgroundColor: _colors(context).surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.lg),
          ),
        ),
        builder: (_) => ProofOfDeliverySheet(orderRef: current!.order.orderRef),
      );
      if (proof == null) return;
      setState(() => _isAdvancing = true);
      await ref
          .read(deliveriesProvider.notifier)
          .completeDeliveryWithProof(assignmentId, proof);
    } else {
      setState(() => _isAdvancing = true);
      await ref
          .read(deliveriesProvider.notifier)
          .advanceCheckpoint(assignmentId);
    }
    if (!mounted) return;
    setState(() => _isAdvancing = false);

    final updated = ref.read(deliveriesProvider).viewById(assignmentId);
    if (updated?.status == DeliveryStatus.delivered) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${updated!.order.orderRef} delivered successfully'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      );
      if (context.canPop()) context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(deliveriesProvider);
    final view = _resolveView(state);

    if (view == null || !view.isInProgress) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: Text(
            'Active delivery',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
        ),
        body: EmptyState(
          heading: 'No active delivery',
          body: 'Accept an assignment to start live navigation.',
          icon: HugeIcons.strokeRoundedDeliveryTruck02,
          ctaLabel: 'Back to deliveries',
          onCtaTap: () => context.go('/rider/home'),
        ),
      );
    }

    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;
    final destination = order.destination;
    final trackGps = view.shouldTrackLocation;

    return Scaffold(
      backgroundColor: colors.background,
      body: Stack(
        children: [
          Positioned.fill(
            child: RiderMapView(
                    planOrigin: ref.watch(
                      deliveriesProvider.select((s) => s.planOrigin),
                    ),
              assignmentId: view.id,
              destination: destination?.latLng,
              planStop: view.planStop,
              trackLocation: trackGps,
              interactive: true,
            ),
          ),
          // Top scrim so map place-name labels fade out cleanly behind the
          // floating header controls.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Container(
                height: 150,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      colors.background.withValues(alpha: 0.85),
                      colors.background.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  _CircleButton(
                    icon: HugeIcons.strokeRoundedArrowLeft01,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surface.withValues(alpha: 0.94),
                        borderRadius: AppRadius.borderMd,
                        border: Border.all(
                          color: colors.outline.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            order.orderRef,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                          Text(
                            destination?.shortLabel ?? 'En route',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  StatusBadge(
                    label: visual.label,
                    variant: visual.badgeVariant,
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              height:
                  MediaQuery.sizeOf(context).height *
                  (view.status == DeliveryStatus.arrived
                      ? _proofSheetSize
                      : _defaultSheetSize),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.lg),
                ),
                boxShadow: [
                  BoxShadow(
                    color: colors.onBackground.withValues(alpha: 0.12),
                    blurRadius: 20,
                    offset: const Offset(0, -6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        AppSpacing.sm,
                        AppSpacing.md,
                        0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Center(
                            child: Container(
                              width: 40,
                              height: 4,
                              decoration: BoxDecoration(
                                color: colors.disabled,
                                borderRadius: AppRadius.borderFull,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            order.customerName ?? 'Customer',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.h3.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            destination?.fullAddress ?? 'Delivery address',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                          if (destination?.landmark != null) ...[
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              destination!.landmark!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.bodyBold.copyWith(
                                color: colors.onBackground,
                              ),
                            ),
                          ],
                          const Spacer(),
                          Row(
                            children: [
                              Expanded(
                                child: _QuickAction(
                                  label: 'Navigate',
                                  icon: HugeIcons.strokeRoundedRoute01,
                                  onTap: () => _navigateTo(view),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: _QuickAction(
                                  label: 'Call',
                                  icon: HugeIcons.strokeRoundedCall,
                                  onTap: () =>
                                      _callCustomer(order.customerPhone),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: _QuickAction(
                                  label: 'Chat',
                                  icon: HugeIcons.strokeRoundedMessage01,
                                  onTap: () => _openCustomerChat(context, view),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                      ),
                    ),
                  ),
                  RiderCheckpointPanel(
                    key: _checkpointKey,
                    status: view.status,
                    isLoading: _isAdvancing,
                    onAdvance: () => _handleAdvance(view.id),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});

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

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final dynamic icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Material(
      color: colors.surfaceVariant,
      borderRadius: AppRadius.borderMd,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderMd,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Column(
            children: [
              HugeIcon(icon: icon, color: colors.onBackground, size: 20),
              const SizedBox(height: 4),
              Text(
                label,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
