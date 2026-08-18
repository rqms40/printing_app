import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';

dynamic chatIconForConversation(ConversationType type) => switch (type) {
  ConversationType.ai => 'assets/animations/GRIDGO_BOT_WAVING.gif',
  ConversationType.admin => HugeIcons.strokeRoundedCustomerSupport,
  ConversationType.rider => HugeIcons.strokeRoundedDeliveryBox01,
};

dynamic chatIconForSender(SenderRole role) => switch (role) {
  SenderRole.bot => 'assets/animations/GRIDGO_BOT-THINKING.gif',
  SenderRole.admin => HugeIcons.strokeRoundedCustomerSupport,
  SenderRole.rider => HugeIcons.strokeRoundedDeliveryBox01,
  SenderRole.customer => HugeIcons.strokeRoundedUser,
  SenderRole.supplier => HugeIcons.strokeRoundedStore01,
};

enum ChatPresence { online, offline }

class ChatAvatar extends StatelessWidget {
  const ChatAvatar({
    super.key,
    required this.icon,
    required this.colors,
    this.size = 40,
    this.iconSize = 20,
    this.backgroundColor,
    this.iconColor,
    this.presence,
  });

  final dynamic icon;
  final AppColorSet colors;
  final double size;
  final double iconSize;
  final Color? backgroundColor;
  final Color? iconColor;
  final ChatPresence? presence;

  @override
  Widget build(BuildContext context) {
    final dotSize = (size * 0.28).clamp(8.0, 12.0);
    final ringSize = dotSize + 3;

    final avatar = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor ?? colors.surfaceVariant,
        borderRadius: AppRadius.borderMd,
      ),
      alignment: Alignment.center,
      child: icon is String
          ? ClipRRect(
              borderRadius: AppRadius.borderMd,
              child: Image.asset(
                icon as String,
                width: size,
                height: size,
                fit: BoxFit.cover,
              ),
            )
          : HugeIcon(
              icon: icon,
              size: iconSize,
              color: iconColor ?? colors.accent,
            ),
    );

    if (presence == null) return avatar;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: ringSize,
            height: ringSize,
            decoration: BoxDecoration(
              color: colors.background,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Container(
              width: dotSize,
              height: dotSize,
              decoration: BoxDecoration(
                color: presence == ChatPresence.online
                    ? colors.success
                    : colors.onSurfaceDim,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
