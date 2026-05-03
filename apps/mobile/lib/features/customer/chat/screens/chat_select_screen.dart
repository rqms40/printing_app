import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/chat/providers/conversation_provider.dart';
import 'package:printing_app/features/customer/chat/widgets/chat_avatar.dart';

class ChatSelectScreen extends ConsumerStatefulWidget {
  const ChatSelectScreen({super.key, this.orderId, this.draftMessage});

  final int? orderId;
  final String? draftMessage;

  @override
  ConsumerState<ChatSelectScreen> createState() => _ChatSelectScreenState();
}

class _ChatSelectScreenState extends ConsumerState<ChatSelectScreen> {
  bool _isCreating = false;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  void _goBack() {
    if (_isCreating) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/customer/home');
    }
  }

  Future<void> _startChat(ConversationType type) async {
    setState(() => _isCreating = true);
    final conv = await ref
        .read(chatProvider.notifier)
        .createConversation(type, orderId: widget.orderId);
    if (!mounted) return;
    setState(() => _isCreating = false);
    if (conv != null) {
      if (widget.draftMessage != null && widget.draftMessage!.isNotEmpty) {
        final notifier = ref.read(conversationProvider(conv.id).notifier);
        // Initialize the WS connection then send. Fire-and-forget; the destination
        // screen will see the message replay over WS.
        notifier.initialize().then((_) {
          notifier.sendMessage(widget.draftMessage!);
        });
      }
      context.pushReplacement('/customer/chat/${conv.id}?type=${type.name}');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not start chat. Please try again.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return PopScope(
      canPop: !_isCreating,
      child: Scaffold(
        backgroundColor: colors.background,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Container(
            color: colors.background,
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                height: 60,
                child: Row(
                  children: [
                    const SizedBox(width: 4),
                    _IconBackButton(
                      colors: colors,
                      onTap: _isCreating ? null : _goBack,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        'New chat',
                        style: AppTypography.h3.copyWith(
                          color: colors.onBackground,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                  ],
                ),
              ),
            ),
          ),
        ),
        body: SafeArea(
          top: false,
          child: Stack(
            children: [
              ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.sm,
                  AppSpacing.xl,
                  AppSpacing.xl,
                ),
                children: [
                  Text(
                    'Start a conversation',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                      decoration: TextDecoration.none,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Choose how you'd like to get help",
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                      decoration: TextDecoration.none,
                    ),
                  ),
                  if (widget.orderId != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: colors.accent.withValues(alpha: 0.1),
                        borderRadius: AppRadius.borderMd,
                      ),
                      child: Row(
                        children: [
                          HugeIcon(
                            icon: HugeIcons.strokeRoundedPackage,
                            size: 18,
                            color: colors.accent,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              'Linked to order #${widget.orderId}',
                              style: AppTypography.caption.copyWith(
                                color: colors.onBackground,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  _OptionCard(
                    icon: chatIconForConversation(ConversationType.ai),
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
                    icon: chatIconForConversation(ConversationType.admin),
                    title: 'Human Support',
                    description: 'Talk to a real GRID team member',
                    isPrimary: false,
                    isDisabled: _isCreating,
                    onTap: () => _startChat(ConversationType.admin),
                    colors: colors,
                  ),
                ],
              ),
              if (_isCreating)
                Positioned.fill(
                  child: Container(
                    color: colors.background.withValues(alpha: 0.7),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(
                          color: colors.accent,
                          strokeWidth: 2,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'Starting chat…',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurface,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconBackButton extends StatelessWidget {
  const _IconBackButton({required this.colors, required this.onTap});
  final AppColorSet colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Back',
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 40,
            height: 40,
            child: Center(
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedArrowLeft01,
                size: 22,
                color: onTap == null
                    ? colors.onSurfaceDim
                    : colors.onBackground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.isPrimary,
    required this.onTap,
    required this.colors,
    required this.isDisabled,
  });

  final dynamic icon;
  final String title;
  final String description;
  final bool isPrimary;
  final VoidCallback onTap;
  final AppColorSet colors;
  final bool isDisabled;

  @override
  Widget build(BuildContext context) {
    final bg = isPrimary ? colors.accent : colors.surface;
    final fg = isPrimary ? colors.accentOnColor : colors.onBackground;
    final descColor = isPrimary
        ? colors.accentOnColor.withValues(alpha: 0.78)
        : colors.onSurfaceDim;

    return Material(
      color: bg,
      borderRadius: AppRadius.borderMd,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        splashColor: isPrimary
            ? colors.accentOnColor.withValues(alpha: 0.08)
            : colors.accent.withValues(alpha: 0.08),
        highlightColor: isPrimary
            ? colors.accentOnColor.withValues(alpha: 0.04)
            : colors.accent.withValues(alpha: 0.04),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: AppRadius.borderMd,
            border: isPrimary
                ? null
                : Border.all(color: colors.outline.withValues(alpha: 0.6)),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isPrimary
                      ? colors.accentOnColor.withValues(alpha: 0.14)
                      : colors.surfaceVariant,
                  borderRadius: AppRadius.borderMd,
                ),
                alignment: Alignment.center,
                child: HugeIcon(
                  icon: icon,
                  size: 22,
                  color: isPrimary ? fg : colors.accent,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.bodyBold.copyWith(
                        color: fg,
                        fontSize: 15,
                        decoration: TextDecoration.none,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body.copyWith(
                        color: descColor,
                        fontSize: 13,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              HugeIcon(
                icon: HugeIcons.strokeRoundedArrowRight01,
                size: 20,
                color: fg.withValues(alpha: 0.55),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
