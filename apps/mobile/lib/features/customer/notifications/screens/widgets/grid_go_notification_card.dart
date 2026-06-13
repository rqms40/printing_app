import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';
import 'package:printing_app/utils/formatters.dart';

class GridGoNotificationCard extends ConsumerWidget {
  const GridGoNotificationCard({
    super.key,
    required this.notification,
  });

  final AppNotification notification;

  int _getProgress(String type) {
    final status = type.replaceFirst('order_', '');
    switch (status) {
      case 'placed':
        return 5;
      case 'file_verified':
        return 15;
      case 'printing_in_progress':
        return 30;
      case 'finishing_mounting':
        return 45;
      case 'quality_checked':
        return 55;
      case 'ready_for_dispatch':
        return 65;
      case 'driver_assigned':
        return 75;
      case 'picked_up':
        return 80;
      case 'on_the_way':
        return 90;
      case 'arrived_at_destination':
        return 95;
      case 'delivered':
        return 100;
      default:
        return 50;
    }
  }

  String _formatDate(DateTime date) {
    // Basic formatting like "Mar 24, 2026"
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
    final progress = _getProgress(notification.type);
    
    // Always use dark theme colors for this card to match the "GRID GO" branding
    final brandYellow = const Color(0xFFFFDE58);
    final cardBg = const Color(0xFF2A2A2A); // Dark grey
    
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
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: AppRadius.borderLg,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Logo container
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: AppRadius.borderMd,
                    ),
                    child: Center(
                      child: GridLogo(
                        size: 24,
                        foregroundColor: Colors.white,
                        accentColor: brandYellow,
                        secondaryColor: Colors.white.withValues(alpha: 0.3),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'GRID',
                          style: AppTypography.caption.copyWith(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 10,
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          'GRID GO',
                          style: AppTypography.bodyBold.copyWith(
                            color: brandYellow,
                            fontSize: 13,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          notification.title,
                          style: AppTypography.h3.copyWith(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_formatDate(notification.createdAt)} · ${_formatTime(notification.createdAt)}',
                          style: AppTypography.caption.copyWith(
                            color: brandYellow,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 12),
                        
                        // Progress bar
                        Stack(
                          clipBehavior: Clip.none,
                          alignment: Alignment.centerLeft,
                          children: [
                            Container(
                              height: 4,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            FractionallySizedBox(
                              widthFactor: progress / 100,
                              child: Container(
                                height: 4,
                                decoration: BoxDecoration(
                                  color: brandYellow,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),
                            Positioned(
                              left: progress == 100 
                                ? null 
                                : MediaQuery.of(context).size.width * 0.6 * (progress / 100) - 10, // Approximation for icon position
                              right: progress == 100 ? -2 : null,
                              child: Text(
                                progress == 100 ? '✅' : '🛵',
                                style: const TextStyle(fontSize: 10),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  
                  // Unread dot
                  if (isUnread)
                    Padding(
                      padding: const EdgeInsets.only(left: 8, top: 4),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: colors.accent,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
