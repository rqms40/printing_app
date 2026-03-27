import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/utils/formatters.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Notifications',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
        actions: [
          TextButton(
            onPressed: () {
              ref.read(notificationsProvider.notifier).markAllAsRead();
            },
            child: Text(
              'Mark All Read',
              style: AppTypography.caption.copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
      body: notifications.isEmpty
          ? const EmptyState(
              heading: 'No notifications yet',
              body:
                  'You will receive notifications about your orders and deliveries here.',
              icon: Iconsax.notification,
            )
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => Divider(
                height: 1,
                color: colors.outlineVariant,
                indent: AppSpacing.md + 40 + AppSpacing.md,
              ),
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return _NotificationTile(notification: notification);
              },
            ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  IconData _iconForType(String type) {
    switch (type) {
      case 'order_update':
        return Iconsax.document_text;
      case 'delivery_update':
        return Iconsax.truck_fast;
      case 'delivery_assignment':
        return Iconsax.truck;
      case 'payment':
        return Iconsax.wallet;
      case 'promo':
        return Iconsax.discount_shape;
      case 'admin_alert':
        return Iconsax.shield_tick;
      case 'system':
        return Iconsax.info_circle;
      default:
        return Iconsax.notification;
    }
  }

  String _timeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
    if (difference.inHours < 24) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';
    return formatDate(dateTime);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isUnread = !notification.isRead;

    return InkWell(
      onTap: () {
        ref
            .read(notificationsProvider.notifier)
            .markAsRead(notification.id);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Leading icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                _iconForType(notification.type),
                size: 20,
                color: isUnread ? colors.accent : colors.onSurfaceDim,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: AppTypography.bodyBold.copyWith(
                      color: isUnread
                          ? colors.onBackground
                          : colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    notification.message,
                    style: AppTypography.body.copyWith(
                      color: isUnread
                          ? colors.onSurface
                          : colors.onSurfaceDim,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _timeAgo(notification.createdAt),
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ),
            ),
            // Unread dot
            if (isUnread)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
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
    );
  }
}
