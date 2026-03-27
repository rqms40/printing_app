import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/driver/deliveries/screens/delivery_detail_screen.dart';
import 'package:printing_app/features/driver/deliveries/widgets/delivery_card.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Screen displaying the driver's list of delivery assignments.
class DeliveriesScreen extends ConsumerStatefulWidget {
  const DeliveriesScreen({super.key});

  @override
  ConsumerState<DeliveriesScreen> createState() => _DeliveriesScreenState();
}

class _DeliveriesScreenState extends ConsumerState<DeliveriesScreen> {
  bool _isLoading = true;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isLoading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final deliveriesState = ref.watch(deliveriesProvider);
    final notifier = ref.read(deliveriesProvider.notifier);
    final assignments = deliveriesState.filteredAssignments;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: Text(
            'Deliveries',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          elevation: 0,
        ),
        body: const OrderListSkeleton(),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Deliveries',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        elevation: 0,
      ),
      body: RefreshIndicator(
        color: colors.accent,
        onRefresh: () async {
          notifier.reset();
        },
        child: assignments.isEmpty
            ? ListView(
                // Wrap EmptyState in a ListView so pull-to-refresh works
                children: [
                  SizedBox(
                    height: MediaQuery.of(context).size.height * 0.6,
                    child: const EmptyState(
                      heading: 'No active deliveries',
                      body:
                          'New delivery assignments will appear here when assigned by admin.',
                      icon: HugeIcons.strokeRoundedDeliveryTruck02,
                    ),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: assignments.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, index) {
                  final assignment = assignments[index];
                  final order = MockData.orders.firstWhere(
                    (o) => o.id == assignment.orderId,
                    orElse: () => MockData.orders.first,
                  );
                  final address = order.deliveryAddressId != null
                      ? MockData.addresses.cast<dynamic>().firstWhere(
                            (a) => a.id == order.deliveryAddressId,
                            orElse: () => null,
                          )
                      : null;

                  return DeliveryCard(
                    assignment: assignment,
                    order: order,
                    address: address,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => DeliveryDetailScreen(
                            assignmentId: assignment.id,
                          ),
                        ),
                      );
                    },
                    onAccept: () =>
                        notifier.acceptAssignment(assignment.id),
                    onDecline: () =>
                        notifier.declineAssignment(assignment.id),
                  )
                      .animate()
                      .fadeIn(
                        duration: 400.ms,
                        delay: (index * 60).ms,
                        curve: Curves.easeOut,
                      )
                      .slideY(
                        begin: 0.02,
                        duration: 400.ms,
                        delay: (index * 60).ms,
                        curve: Curves.easeOut,
                      );
                },
              ),
      ),
    );
  }
}
