import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class FloatingChatButton extends StatelessWidget {
  const FloatingChatButton({super.key, this.unreadCount = 0, this.orderId});
  final int unreadCount;
  final int? orderId;

  void _onTap(BuildContext context) {
    if (orderId != null) {
      context.push('/customer/chat?orderId=$orderId');
    } else {
      context.push('/customer/chat');
    }
  }

  @override
  Widget build(BuildContext context) {
    final button = GestureDetector(
      onTap: () => _onTap(context),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const HugeIcon(
              icon: HugeIcons.strokeRoundedMessage01,
              size: 18,
              color: Colors.white,
            ),
            const SizedBox(width: 6),
            Text(
              'Chat',
              style: AppTypography.button.copyWith(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );

    if (unreadCount <= 0) {
      return button;
    }

    final badgeLabel = unreadCount > 9 ? '9+' : '$unreadCount';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        button,
        Positioned(
          top: -4,
          right: -4,
          child: Container(
            width: 18,
            height: 18,
            decoration: const BoxDecoration(
              color: Color(0xFFD32F2F),
              borderRadius: BorderRadius.all(Radius.circular(9)),
            ),
            alignment: Alignment.center,
            child: Text(
              badgeLabel,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
                height: 1,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
