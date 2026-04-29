import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';

/// Floating circular chat button. Shows an unread badge when [unreadCount] > 0.
/// Pure icon — no "Chat" label.
class FloatingChatButton extends StatelessWidget {
  const FloatingChatButton({super.key, this.unreadCount = 0, this.orderId});
  final int unreadCount;
  final int? orderId;

  void _onTap(BuildContext context) {
    if (orderId != null) {
      context.push('/customer/chat/new?orderId=$orderId');
    } else {
      context.push('/customer/chat');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final button = Material(
      color: colors.accent,
      elevation: 6,
      shadowColor: colors.onBackground.withValues(alpha: 0.22),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _onTap(context),
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 52,
          height: 52,
          child: Center(
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedMessage01,
              size: 22,
              color: colors.accentOnColor,
            ),
          ),
        ),
      ),
    );

    if (unreadCount <= 0) return button;

    final badgeLabel = unreadCount > 99 ? '99+' : '$unreadCount';
    final isWide = badgeLabel.length > 1;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        button,
        Positioned(
          top: -2,
          right: -2,
          child: Container(
            constraints: BoxConstraints(
              minWidth: isWide ? 22 : 20,
              minHeight: 20,
            ),
            padding: EdgeInsets.symmetric(horizontal: isWide ? 6 : 0),
            decoration: BoxDecoration(
              color: colors.error,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: colors.background,
                width: 2,
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              badgeLabel,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1.1,
                letterSpacing: 0,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
