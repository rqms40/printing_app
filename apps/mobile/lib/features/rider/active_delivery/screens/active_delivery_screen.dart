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

  void _showLaunchFailure(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) {
      _showLaunchFailure('No phone number on file');
      return;
    }
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showLaunchFailure('Could not open — no app available');
    }
  }

  Future<void> _navigateTo(RiderAssignmentView view) async {
    final dest = view.isPickupActive ? view.supplierPin : view.pinDestination;
    final lat = dest?.latitude ?? 7.1907;
    final lng = dest?.longitude ?? 125.4553;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      _showLaunchFailure('Could not open — no app available');
    }
  }

  Future<Map<String, dynamic>?> _openProofSheet(
    String orderRef, {
    required ProofSheetKind kind,
    String? initialOtp,
  }) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _colors(context).surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => ProofOfDeliverySheet(
        orderRef: orderRef,
        kind: kind,
        initialOtp: initialOtp,
      ),
    );
  }

  Future<void> _handleAdvance(String assignmentId) async {
    // Refresh so pickup/delivery OTP from the server is available to prefill.
    await ref.read(deliveriesProvider.notifier).refreshAssignments();
    if (!mounted) return;
    final current = ref.read(deliveriesProvider).viewById(assignmentId);
    if (current?.status == DeliveryStatus.accepted) {
      final proof = await _openProofSheet(
        current!.order.orderRef,
        kind: ProofSheetKind.pickup,
        initialOtp: current.assignment.pickupOtp,
      );
      if (proof == null) return;
      setState(() => _isAdvancing = true);
      final ok = await ref
          .read(deliveriesProvider.notifier)
          .completePickupWithProof(assignmentId, proof);
      if (!mounted) return;
      setState(() => _isAdvancing = false);
      if (!ok) {
        final err = ref.read(deliveriesProvider).errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              err ??
                  'Pickup failed. Use the supplier pickup OTP (admin order also shows it). Wrong OTP returns Invalid OTP.',
            ),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
          ),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pickup confirmed for ${current.order.orderRef}'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      );
      return;
    } else if (current?.status == DeliveryStatus.arrived) {
      final proof = await _openProofSheet(
        current!.order.orderRef,
        kind: ProofSheetKind.delivery,
        initialOtp: current.assignment.deliveryOtp,
      );
      if (proof == null) return;
      setState(() => _isAdvancing = true);
      final ok = await ref
          .read(deliveriesProvider.notifier)
          .completeDeliveryWithProof(assignmentId, proof);
      if (!mounted) return;
      setState(() => _isAdvancing = false);
      if (!ok) {
        final err = ref.read(deliveriesProvider).errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err ?? 'Delivery proof failed'),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
          ),
        );
        return;
      }
    } else {
      setState(() => _isAdvancing = true);
      await ref
          .read(deliveriesProvider.notifier)
          .advanceCheckpoint(assignmentId);
      if (!mounted) return;
      setState(() => _isAdvancing = false);
      final err = ref.read(deliveriesProvider).errorMessage;
      if (err != null && err.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
          ),
        );
        return;
      }
    }
    if (!mounted) return;

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
          ctaLabel: 'Back to Deliveries',
          onCtaTap: () => context.go('/rider/deliveries'),
        ),
      );
    }

    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;
    final destination = order.destination;
    final pinDestination = view.pinDestination;
    final trackGps = view.shouldTrackLocation;
    final sheetHeight =
        MediaQuery.sizeOf(context).height *
        (view.status == DeliveryStatus.arrived
            ? _proofSheetSize
            : _defaultSheetSize);

    return Scaffold(
      backgroundColor: colors.background,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: RiderMapView(
              planOrigin: ref.watch(
                deliveriesProvider.select((s) => s.planOrigin),
              ),
              assignmentId: view.id,
              isPickupActive: view.isPickupActive,
              destination: pinDestination,
              planStop: view.planStop,
              planStops: view.legs,
              supplierPin: view.supplierPin,
              trackLocation: trackGps,
              interactive: true,
              // Keep floating map controls clear of the header row and the
              // customer sheet.
              overlayTopInset: 76,
              overlayBottomInset: sheetHeight,
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
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
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
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              height: sheetHeight,
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
                    child: SingleChildScrollView(
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
                          const SizedBox(height: AppSpacing.lg),
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
