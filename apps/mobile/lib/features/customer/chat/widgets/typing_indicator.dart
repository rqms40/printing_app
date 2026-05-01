import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/widgets/chat_avatar.dart';

/// Animated three-dot typing indicator shown while the bot is composing.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          ChatAvatar(
            icon: chatIconForSender(SenderRole.bot),
            colors: colors,
            size: 28,
            iconSize: 15,
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(18),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) => _Dot(ctrl: _ctrl, index: i)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatefulWidget {
  const _Dot({required this.ctrl, required this.index});
  final AnimationController ctrl;
  final int index;

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> {
  late final CurvedAnimation _curved;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    final delay = widget.index * 0.2;
    _curved = CurvedAnimation(
      parent: widget.ctrl,
      curve: Interval(
        delay,
        (delay + 0.4).clamp(0.0, 1.0),
        curve: Curves.easeInOut,
      ),
    );
    _anim = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -5.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -5.0, end: 0.0), weight: 1),
    ]).animate(_curved);
  }

  @override
  void dispose() {
    _curved.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: AnimatedBuilder(
        animation: _anim,
        builder: (_, _) => Transform.translate(
          offset: Offset(0, _anim.value),
          child: Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: colors.onSurfaceDim,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
    );
  }
}
