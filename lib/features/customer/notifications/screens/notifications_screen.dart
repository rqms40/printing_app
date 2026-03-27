import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/utils/formatters.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isLoading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
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
      body: _isLoading
          ? const NotificationListSkeleton()
          : notifications.isEmpty
          ? const EmptyState(
              heading: 'No notifications yet',
              body:
                  'You will receive notifications about your orders and deliveries here.',
              icon: HugeIcons.strokeRoundedNotification02,
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
                return _NotificationTile(notification: notification)
                    .animate()
                    .fadeIn(
                      duration: 400.ms,
                      delay: (index * 40).ms,
                      curve: Curves.easeOut,
                    )
                    .slideY(
                      begin: 0.02,
                      duration: 400.ms,
                      delay: (index * 40).ms,
                      curve: Curves.easeOut,
                    );
              },
            ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  dynamic _iconForType(String type) {
    switch (type) {
      case 'order_update':
        return HugeIcons.strokeRoundedFile02;
      case 'delivery_update':
        return HugeIcons.strokeRoundedDeliveryTruck02;
      case 'delivery_assignment':
        return HugeIcons.strokeRoundedTruck;
      case 'payment':
        return HugeIcons.strokeRoundedWallet01;
      case 'promo':
        return HugeIcons.strokeRoundedDiscount;
      case 'admin_alert':
        return HugeIcons.strokeRoundedShield01;
      case 'system':
        return HugeIcons.strokeRoundedInformationCircle;
      default:
        return HugeIcons.strokeRoundedNotification02;
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
              child: HugeIcon(
                icon: _iconForType(notification.type),
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
