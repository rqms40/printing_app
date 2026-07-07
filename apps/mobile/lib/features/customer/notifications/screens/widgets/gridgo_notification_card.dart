import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/shared/models/app_notification.dart';

class GridGoNotificationCard extends ConsumerWidget {
  const GridGoNotificationCard({
    super.key,
    required this.notification,
  });

  final AppNotification notification;

  int _getStageIndex(String type) {
    final status = type.replaceFirst('order_', '');
    switch (status) {
      case 'placed':
        return 0; // Order
      case 'file_verified':
      case 'printing_in_progress':
      case 'quality_checked':
      case 'finishing_mounting':
        return 1; // Printing
      case 'ready_for_dispatch':
      case 'rider_assigned':
      case 'driver_assigned':
      case 'picked_up':
      case 'on_the_way':
        return 2; // Dispatch
      case 'arrived_at_destination':
      case 'delivered':
        return 3; // Delivered
      default:
        return 0;
    }
  }

  String _formatDate(DateTime date) {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  String _formatTime(DateTime date) {
    int hour = date.hour;
    final String period = hour >= 12 ? 'PM' : 'AM';
    if (hour == 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isUnread = !notification.isRead;
    final stageIndex = _getStageIndex(notification.type);
    
    // Derived state for Rider info (Dynamically accurate if provided, fallback to mock)
    final showRiderInfo = stageIndex >= 2;
    final metadata = notification.metadata ?? {};
    final driverName = metadata['driverName'] as String? ?? 'Carlito Jr. Dela Cruz';
    final vehicle = metadata['vehicleType'] as String? ?? metadata['vehicle'] as String? ?? 'Motorcycle';
    final plate = metadata['plateNumber'] as String? ?? metadata['plate'] as String? ?? '123ABC';
    final window = metadata['window'] as String? ?? '9 AM - 11 PM';

    
    // Always use dark theme colors for this card to match the "GRIDGO" branding
    const brandYellow = Color(0xFFFFDE58);
    const cardBg = Color(0xFF1C1C1C);
    
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Dismissible(
      key: ValueKey(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: AppSpacing.xl),
        color: colors.surfaceVariant,
        child: HugeIcon(
          icon: HugeIcons.strokeRoundedTickDouble01,
          size: 20,
          color: colors.onSurfaceDim,
        ),
      ),
      onDismissed: (_) {
        ref.read(notificationsProvider.notifier).markAsRead(notification.id);
      },
      child: Material(
        color: isUnread
            ? colors.accent.withValues(alpha: 0.03)
            : Colors.transparent,
        child: InkWell(
          onTap: () {
            ref.read(notificationsProvider.notifier).markAsRead(notification.id);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.md,
            ),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: AppRadius.borderLg,
                border: Border.all(color: const Color(0xFF333333)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Left: Title and Time
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text.rich(
                              const TextSpan(
                                children: [
                                  TextSpan(text: 'GRID', style: TextStyle(color: Colors.white)),
                                  TextSpan(text: 'GO', style: TextStyle(color: brandYellow)),
                                ],
                              ),
                              style: AppTypography.h3.copyWith(
                                fontSize: 16,
                                letterSpacing: 1.0,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              notification.title,
                              style: AppTypography.h2.copyWith(
                                color: brandYellow,
                                fontSize: 20,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_formatDate(notification.createdAt)} - ${_formatTime(notification.createdAt)}',
                              style: AppTypography.caption.copyWith(
                                color: const Color(0xFFE0E0E0),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      // Right: Rider Info
                      if (showRiderInfo)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              vehicle,
                              style: AppTypography.caption.copyWith(
                                color: const Color(0xFFE0E0E0),
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              plate,
                              style: AppTypography.h2.copyWith(
                                color: brandYellow,
                                fontSize: 20,
                              ),
                            ),
                            Text(
                              window,
                              style: AppTypography.caption.copyWith(
                                color: const Color(0xFFE0E0E0),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  
                  // Optional Bottom Text (e.g. Driver name under title)
                  if (notification.title.contains(driverName.split(' ').first))
                     Padding(
                       padding: const EdgeInsets.only(top: 4),
                       child: Text(
                         'OR#${notification.orderId ?? "10290"}',
                         style: AppTypography.caption.copyWith(
                           color: const Color(0xFFE0E0E0),
                           fontStyle: FontStyle.italic,
                           fontSize: 12,
                         ),
                       ),
                     ),
                     
                  const SizedBox(height: 24),
                  
                  // Progress Bar
                  _buildProgressBar(stageIndex, brandYellow),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar(int currentStageIndex, Color brandYellow) {
    final stages = [
      {'label': 'Order', 'icon': HugeIcons.strokeRoundedShoppingCart01},
      {'label': 'Printing', 'icon': HugeIcons.strokeRoundedPrinter},
      {'label': 'Dispatch', 'icon': HugeIcons.strokeRoundedTruck},
      {'label': 'Delivered', 'icon': HugeIcons.strokeRoundedLocation01},
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final double width = constraints.maxWidth;
        final double lineLeft = width * 0.125;
        final double lineWidth = width * 0.75;
        final double activeWidth = (width * 0.25) * currentStageIndex;

        return SizedBox(
          height: 75,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Background Line
              Positioned(
                left: lineLeft,
                top: 14,
                child: Container(
                  width: lineWidth,
                  height: 4,
                  color: const Color(0xFF333333),
                ),
              ),
              
              // Active Line
              Positioned(
                left: lineLeft,
                top: 14,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: activeWidth,
                  height: 4,
                  color: brandYellow,
                ),
              ),

              // Icons Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(stages.length, (index) {
                  final isActive = index <= currentStageIndex;
                  final isCurrent = index == currentStageIndex;
                  
                  return Expanded(
                    child: Column(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: isActive ? brandYellow : const Color(0xFF1C1C1C),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isActive ? brandYellow : const Color(0xFF555555),
                              width: 3,
                            ),
                            boxShadow: isCurrent ? [
                              BoxShadow(
                                color: brandYellow.withValues(alpha: 0.5),
                                blurRadius: 15,
                                spreadRadius: 5,
                              )
                            ] : null,
                          ),
                          child: Center(
                            child: HugeIcon(
                              icon: stages[index]['icon'] as dynamic,
                              size: 16,
                              color: isActive ? Colors.black : const Color(0xFF555555),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          stages[index]['label'] as String,
                          style: TextStyle(
                            fontSize: 11,
                            color: isActive ? Colors.white : const Color(0xFF888888),
                            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ],
          ),
        );
      }
    );
  }
}

