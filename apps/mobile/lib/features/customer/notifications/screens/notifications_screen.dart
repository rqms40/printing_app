import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/config/theme/app_radius.dart';
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

  /// Group notifications by time: Today, Yesterday, This Week, Earlier
  Map<String, List<AppNotification>> _groupByTime(
    List<AppNotification> notifications,
  ) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final weekAgo = today.subtract(const Duration(days: 7));

    final groups = <String, List<AppNotification>>{};

    for (final n in notifications) {
      final date = DateTime(
        n.createdAt.year,
        n.createdAt.month,
        n.createdAt.day,
      );
      String key;
      if (date == today || date.isAfter(today)) {
        key = 'Today';
      } else if (date == yesterday ||
          (date.isAfter(yesterday) && date.isBefore(today))) {
        key = 'Yesterday';
      } else if (date.isAfter(weekAgo)) {
        key = 'This Week';
      } else {
        key = 'Earlier';
      }
      groups.putIfAbsent(key, () => []).add(n);
    }

    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final notifications = ref.watch(notificationsProvider);
    final unreadCount = ref.watch(unreadNotificationsCountProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.only(
                left: AppSpacing.xl,
                right: AppSpacing.xl,
                top: AppSpacing.lg,
                bottom: AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Notifications',
                          style: AppTypography.h1.copyWith(
                            color: colors.onBackground,
                          ),
                        ),
                      ),
                      if (unreadCount > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: colors.brand,
                            borderRadius: AppRadius.borderFull,
                          ),
                          child: Text(
                            '$unreadCount',
                            style: AppTypography.caption.copyWith(
                              color: colors.accentOnColor,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (unreadCount > 0) ...[
                    const SizedBox(height: AppSpacing.xs),
                    GestureDetector(
                      onTap: () {
                        ref
                            .read(notificationsProvider.notifier)
                            .markAllAsRead();
                      },
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          HugeIcon(
                            icon: HugeIcons.strokeRoundedTickDouble01,
                            size: 14,
                            color: colors.brand,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Mark all as read',
                            style: AppTypography.caption.copyWith(
                              color: colors.brand,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ).animate().fadeIn(duration: 350.ms, curve: Curves.easeOut),

            const SizedBox(height: AppSpacing.sm),

            // Content
            Expanded(
              child: _isLoading
                  ? const NotificationListSkeleton()
                  : notifications.isEmpty
                  ? const EmptyState(
                      heading: 'All caught up',
                      body:
                          'You\'ll see order updates and delivery alerts here.',
                      icon: HugeIcons.strokeRoundedNotification02,
                    )
                  : RefreshIndicator(
                      color: colors.accent,
                      backgroundColor: colors.surface,
                      onRefresh: () async {
                        await ref
                            .read(notificationsProvider.notifier)
                            .refreshNotifications();
                      },
                      child: _buildGroupedList(notifications, colors),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroupedList(
    List<AppNotification> notifications,
    AppColorSet colors,
  ) {
    final groups = _groupByTime(notifications);
    final orderedKeys = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    final activeKeys = orderedKeys.where((k) => groups.containsKey(k)).toList();

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      itemCount: activeKeys.length,
      itemBuilder: (context, sectionIndex) {
        final key = activeKeys[sectionIndex];
        final items = groups[key]!;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section header
            Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.xl,
                right: AppSpacing.xl,
                top: sectionIndex == 0 ? AppSpacing.sm : AppSpacing.lg,
                bottom: AppSpacing.sm,
              ),
              child: Text(
                key.toUpperCase(),
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  letterSpacing: 1.5,
                ),
              ),
            ).animate().fadeIn(duration: 300.ms, curve: Curves.easeOut),

            // Notification items
            ...items.asMap().entries.map((entry) {
              final index = entry.key;
              final notification = entry.value;
              return _NotificationItem(
                    notification: notification,
                    isLast: index == items.length - 1,
                  )
                  .animate()
                  .fadeIn(
                    duration: 350.ms,
                    delay: (index * 40).ms,
                    curve: Curves.easeOut,
                  )
                  .slideX(
                    begin: 0.02,
                    duration: 350.ms,
                    delay: (index * 40).ms,
                    curve: Curves.easeOut,
                  );
            }),
          ],
        );
      },
    );
  }
}

/// Individual notification item with professional layout.
class _NotificationItem extends ConsumerWidget {
  const _NotificationItem({required this.notification, this.isLast = false});

  final AppNotification notification;
  final bool isLast;

  /// Returns icon + semantic background color for each notification type.
  _NotificationVisual _visual(String type, AppColorSet colors) {
    switch (type) {
      case 'order_update':
        return _NotificationVisual(
          HugeIcons.strokeRoundedFile02,
          colors.info.withValues(alpha: 0.12),
          colors.info,
        );
      case 'delivery_update':
        return _NotificationVisual(
          HugeIcons.strokeRoundedDeliveryTruck02,
          colors.success.withValues(alpha: 0.12),
          colors.success,
        );
      case 'delivery_assignment':
        return _NotificationVisual(
          HugeIcons.strokeRoundedTruck,
          colors.info.withValues(alpha: 0.12),
          colors.info,
        );
      case 'payment':
        return _NotificationVisual(
          HugeIcons.strokeRoundedWallet01,
          colors.success.withValues(alpha: 0.12),
          colors.success,
        );
      case 'promo':
        return _NotificationVisual(
          HugeIcons.strokeRoundedDiscount,
          colors.warning.withValues(alpha: 0.12),
          colors.warning,
        );
      case 'admin_alert':
        return _NotificationVisual(
          HugeIcons.strokeRoundedShield01,
          colors.error.withValues(alpha: 0.12),
          colors.error,
        );
      default:
        return _NotificationVisual(
          HugeIcons.strokeRoundedNotification02,
          colors.surfaceVariant,
          colors.onSurfaceDim,
        );
    }
  }

  String _timeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return formatDate(dateTime);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isUnread = !notification.isRead;
    final visual = _visual(notification.type, colors);

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
            ref
                .read(notificationsProvider.notifier)
                .markAsRead(notification.id);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon with semantic background
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: visual.background,
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: Center(
                    child: HugeIcon(
                      icon: visual.icon,
                      size: 20,
                      color: visual.foreground,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title row with time
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              notification.title,
                              style:
                                  (isUnread
                                          ? AppTypography.bodyBold
                                          : AppTypography.body)
                                      .copyWith(
                                        color: isUnread
                                            ? colors.onBackground
                                            : colors.onSurface,
                                      ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            _timeAgo(notification.createdAt),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),

                      // Message
                      Text(
                        notification.message,
                        style: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                          height: 1.4,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // Order reference tag
                      if (notification.orderId != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderSm,
                          ),
                          child: Text(
                            notification.orderId!,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Unread indicator
                if (isUnread) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Visual properties for a notification type.
class _NotificationVisual {
  const _NotificationVisual(this.icon, this.background, this.foreground);

  final dynamic icon;
  final Color background;
  final Color foreground;
}
