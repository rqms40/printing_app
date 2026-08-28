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
import 'package:printing_app/features/rider/shared/widgets/proof_of_delivery_sheet.dart';
import 'package:printing_app/features/rider/shared/widgets/failed_delivery_sheet.dart';
import 'package:printing_app/features/rider/shared/widgets/cod_collection_sheet.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_decline_dialog.dart';

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

  void _showLaunchFailure(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showLaunchFailure('Could not open — no app available');
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

  Future<void> _handleAdvance() async {
    // Refresh so pickup/delivery OTP from the server is available to prefill.
    await ref.read(deliveriesProvider.notifier).refreshAssignments();
    if (!mounted) return;
    final current = ref.read(deliveriesProvider).viewById(widget.assignmentId);
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
          .completePickupWithProof(widget.assignmentId, proof);
      if (!mounted) return;
      setState(() => _isAdvancing = false);
      if (!ok) {
        final err = ref.read(deliveriesProvider).errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              err ??
                  'Pickup failed. Ask ops/supplier for the pickup OTP (shown on admin order).',
            ),
          ),
        );
      }
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
          .completeDeliveryWithProof(widget.assignmentId, proof);
      if (!mounted) return;
      setState(() => _isAdvancing = false);
      if (!ok) {
        final err = ref.read(deliveriesProvider).errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err ?? 'Delivery proof failed')),
        );
      }
      return;
    } else {
      setState(() => _isAdvancing = true);
      await ref
          .read(deliveriesProvider.notifier)
          .advanceCheckpoint(widget.assignmentId);
    }
    if (!mounted) return;
    setState(() => _isAdvancing = false);
    final err = ref.read(deliveriesProvider).errorMessage;
    if (err != null && err.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err)),
      );
    }

    final view = ref.read(deliveriesProvider).viewById(widget.assignmentId);
    if (view?.isInProgress ?? false) {
      context.pushReplacement(
        '/rider/deliveries/${widget.assignmentId}/active',
      );
    }
  }

  Future<void> _handleFailedDelivery() async {
    final current = ref.read(deliveriesProvider).viewById(widget.assignmentId);
    if (current == null || !current.canMarkFailed) return;
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _colors(context).surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => FailedDeliverySheet(orderRef: current.order.orderRef),
    );
    if (result == null || !mounted) return;
    final reason = result['reason']?.toString() ?? '';
    final proof = result['proof'];
    if (proof is! Map<String, dynamic>) return;
    setState(() => _isAdvancing = true);
    await ref
        .read(deliveriesProvider.notifier)
        .markFailedDelivery(
          widget.assignmentId,
          reason: reason,
          proof: proof,
        );
    if (!mounted) return;
    setState(() => _isAdvancing = false);
  }

  Future<void> _handleCod({required bool fail}) async {
    final current = ref.read(deliveriesProvider).viewById(widget.assignmentId);
    if (current == null || !current.order.isCod) return;
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _colors(context).surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => CodCollectionSheet(
        orderRef: current.order.orderRef,
        amountMajor: current.order.codAmountMajor,
        mode: fail
            ? CodCollectionSheetMode.fail
            : CodCollectionSheetMode.collect,
      ),
    );
    if (result == null || !mounted) return;
    setState(() => _isAdvancing = true);
    final notifier = ref.read(deliveriesProvider.notifier);
    final orderId = current.order.orderInternalId;
    if (fail) {
      await notifier.failCodCollection(
        orderInternalId: orderId,
        returnReason: result['returnReason']?.toString() ?? '',
        photoFileId: result['photoFileId'] as int?,
      );
    } else {
      final fileId = result['photoFileId'];
      if (fileId is int) {
        await notifier.collectCod(
          orderInternalId: orderId,
          photoFileId: fileId,
        );
      }
    }
    if (!mounted) return;
    setState(() => _isAdvancing = false);
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
    final destLatLng = view.pinDestination;

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
                    planOrigin: ref.watch(
                      deliveriesProvider.select((s) => s.planOrigin),
                    ),
                    assignmentId: view.id,
                    destination: destLatLng,
                    planStop: view.planStop,
                    planStops: view.legs,
                    supplierPin: view.supplierPin,
                    trackLocation: false,
                    interactive: true,
                    showLiveBadge: false,
                    showRoute: view.legs.isNotEmpty,
                    // Keep the recenter control below the floating back row.
                    overlayTopInset: 52,
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
                          value: formatCurrency(order.deliveryFeePesos),
                          colors: colors,
                        ),
                        if (order.paymentMethod != null)
                          _InfoRow(
                            label: 'Payment',
                            value: order.isCod
                                ? 'Cash on delivery'
                                : order.paymentMethod!,
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
                  if (order.isCod) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'COD COLLECTION',
                      style: AppTypography.overline.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _InfoRow(
                            label: 'Amount due',
                            value: formatCurrency(order.codAmountMajor),
                            colors: colors,
                          ),
                          _InfoRow(
                            label: 'Status',
                            value: order.codCollected
                                ? 'Cash collected'
                                : order.codFailed
                                ? 'Collection failed'
                                : 'Pending collection',
                            colors: colors,
                          ),
                          if (!order.codCollected &&
                              !order.codFailed &&
                              view.isInProgress) ...[
                            const SizedBox(height: AppSpacing.sm),
                            AppButton(
                              label: 'Collect cash',
                              isFullWidth: true,
                              isLoading: _isAdvancing,
                              onTap: () => _handleCod(fail: false),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            AppButton(
                              label: 'Could not collect',
                              variant: AppButtonVariant.secondary,
                              isFullWidth: true,
                              isLoading: _isAdvancing,
                              onTap: () => _handleCod(fail: true),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  if (view.canMarkFailed) ...[
                    const SizedBox(height: AppSpacing.md),
                    AppButton(
                      label: 'Mark failed delivery',
                      variant: AppButtonVariant.ghost,
                      isFullWidth: true,
                      isLoading: _isAdvancing,
                      icon: HugeIcons.strokeRoundedAlert02,
                      onTap: _handleFailedDelivery,
                    ),
                  ],
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
            onDecline: () async {
              final reason = await showRiderDeclineDialog(context);
              if (reason == null) return;
              await ref
                  .read(deliveriesProvider.notifier)
                  .declineAssignment(view.id, reason: reason);
            },
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
