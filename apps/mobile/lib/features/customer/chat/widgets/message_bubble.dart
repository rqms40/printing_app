import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final ChatMessage message;

  bool get _isOutgoing => message.senderRole == SenderRole.customer;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  String _timeLabel() {
    final t = message.createdAt.toLocal();
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isOutgoing = _isOutgoing;

    final bgColor = isOutgoing ? colors.accent : colors.surfaceVariant;
    final textColor = isOutgoing ? colors.accentOnColor : colors.onBackground;
    final timeColor =
        isOutgoing ? colors.accentOnColor.withValues(alpha: 0.6) : colors.onSurfaceDim;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment:
            isOutgoing ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isOutgoing) ...[
            _SenderAvatar(role: message.senderRole, colors: colors),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isOutgoing
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: isOutgoing
                          ? const Radius.circular(18)
                          : const Radius.circular(4),
                      bottomRight: isOutgoing
                          ? const Radius.circular(4)
                          : const Radius.circular(18),
                    ),
                  ),
                  child: Text(
                    message.content,
                    style: AppTypography.body.copyWith(color: textColor),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  _timeLabel(),
                  style: AppTypography.caption.copyWith(
                    color: timeColor,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          if (isOutgoing) const SizedBox(width: 4),
        ],
      ),
    );
  }
}

class _SenderAvatar extends StatelessWidget {
  const _SenderAvatar({required this.role, required this.colors});
  final SenderRole role;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final label = switch (role) {
      SenderRole.bot => 'AI',
      SenderRole.admin => 'GD',
      SenderRole.rider => 'RD',
      SenderRole.customer => '',
    };
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: colors.surfaceDim,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: colors.onSurface,
          fontWeight: FontWeight.w700,
          fontSize: 10,
        ),
      ),
    );
  }
}
