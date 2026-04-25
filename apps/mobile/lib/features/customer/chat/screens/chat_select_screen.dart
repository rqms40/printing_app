import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';

class ChatSelectScreen extends ConsumerStatefulWidget {
  const ChatSelectScreen({super.key, this.orderId});

  final int? orderId;

  @override
  ConsumerState<ChatSelectScreen> createState() => _ChatSelectScreenState();
}

class _ChatSelectScreenState extends ConsumerState<ChatSelectScreen> {
  bool _isCreating = false;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  Future<void> _startChat(ConversationType type) async {
    setState(() => _isCreating = true);
    final conv = await ref.read(chatProvider.notifier).createConversation(
          type,
          orderId: widget.orderId,
        );
    if (!mounted) return;
    setState(() => _isCreating = false);
    if (conv != null) {
      context.pushReplacement(
        '/customer/chat/${conv.id}?type=${type.name}',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(
                    left: AppSpacing.sm,
                    top: AppSpacing.sm,
                  ),
                  child: IconButton(
                    onPressed: () => context.pop(),
                    icon: HugeIcon(
                      icon: HugeIcons.strokeRoundedArrowLeft02,
                      size: 22,
                      color: colors.accent,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.md,
                    AppSpacing.xl,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Start a conversation',
                        style: AppTypography.h1
                            .copyWith(color: colors.onBackground),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "Choose how you'd like to get help",
                        style: AppTypography.body
                            .copyWith(color: colors.onSurface),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xxl),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  child: Column(
                    children: [
                      _OptionCard(
                        icon: HugeIcons.strokeRoundedAiBrain01,
                        title: 'GridBot AI',
                        description:
                            'Instant answers about printing, pricing, and materials',
                        isPrimary: true,
                        isDisabled: _isCreating,
                        onTap: () => _startChat(ConversationType.ai),
                        colors: colors,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _OptionCard(
                        icon: HugeIcons.strokeRoundedUser,
                        title: 'Human Support',
                        description:
                            'Talk to a real GRID team member',
                        isPrimary: false,
                        isDisabled: _isCreating,
                        onTap: () => _startChat(ConversationType.admin),
                        colors: colors,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (_isCreating)
              Container(
                color: colors.background.withValues(alpha: 0.6),
                child: Center(
                  child: CircularProgressIndicator(
                    color: colors.accent,
                    strokeWidth: 2,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _OptionCard extends StatefulWidget {
  const _OptionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.isPrimary,
    required this.onTap,
    required this.colors,
    required this.isDisabled,
  });

  // HugeIcons SVG path data — List<List<dynamic>> at runtime
  final dynamic icon;
  final String title;
  final String description;
  final bool isPrimary;
  final VoidCallback onTap;
  final AppColorSet colors;
  final bool isDisabled;

  @override
  State<_OptionCard> createState() => _OptionCardState();
}

class _OptionCardState extends State<_OptionCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final bg = widget.isPrimary ? widget.colors.accent : widget.colors.surface;
    final fg =
        widget.isPrimary ? widget.colors.accentOnColor : widget.colors.accent;
    final descColor = widget.isPrimary
        ? widget.colors.accentOnColor.withValues(alpha: 0.75)
        : widget.colors.onSurface;

    return GestureDetector(
      onTapDown: widget.isDisabled ? null : (_) => setState(() => _pressed = true),
      onTapUp: widget.isDisabled ? null : (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
            border: widget.isPrimary
                ? null
                : Border.all(color: widget.colors.outline, width: 1.5),
            boxShadow: widget.isPrimary
                ? [
                    BoxShadow(
                      color: widget.colors.accent.withValues(alpha: 0.18),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HugeIcon(icon: widget.icon, size: 28, color: fg),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.title,
                      style: AppTypography.h3.copyWith(color: fg),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.description,
                      style:
                          AppTypography.body.copyWith(color: descColor),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              HugeIcon(
                icon: HugeIcons.strokeRoundedArrowRight01,
                size: 20,
                color: fg.withValues(alpha: 0.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
