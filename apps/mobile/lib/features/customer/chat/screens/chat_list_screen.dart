import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';

class ChatListScreen extends ConsumerStatefulWidget {
  const ChatListScreen({super.key});

  @override
  ConsumerState<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends ConsumerState<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(chatProvider.notifier).loadConversations(),
    );
  }

  AppColorSet _colors(BuildContext context) => Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.month}/${dt.day}';
  }

  String _typeLabel(ConversationType type) => switch (type) {
        ConversationType.ai => 'GridBot AI',
        ConversationType.admin => 'Human Support',
        ConversationType.rider => 'Rider Support',
      };

  Widget _typeIcon(ConversationType type, AppColorSet colors) {
    final iconData = switch (type) {
      ConversationType.ai => HugeIcons.strokeRoundedAiBrain01,
      ConversationType.admin => HugeIcons.strokeRoundedUser,
      ConversationType.rider => HugeIcons.strokeRoundedDeliveryBox01,
    };
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: colors.accent,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: HugeIcon(icon: iconData, size: 18, color: colors.accentOnColor),
      ),
    );
  }

  Widget _statusChip(ConversationStatus status, AppColorSet colors) {
    final (bg, fg, label) = switch (status) {
      ConversationStatus.open => (
          const Color(0xFFE8F5E9),
          const Color(0xFF2E7D32),
          'Open',
        ),
      ConversationStatus.assigned => (
          const Color(0xFFFFFDE7),
          const Color(0xFFF9A825),
          'Assigned',
        ),
      ConversationStatus.closed => (
          colors.surfaceVariant,
          colors.onSurfaceDim,
          'Closed',
        ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }

  Widget _buildCard(Conversation conv, AppColorSet colors) {
    return Material(
      color: colors.surface,
      child: InkWell(
        onTap: () => context.push('/customer/chat/${conv.id}'),
        splashColor: colors.accent.withValues(alpha: 0.06),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _typeIcon(conv.type, colors),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          _typeLabel(conv.type),
                          style: AppTypography.bodyBold
                              .copyWith(color: colors.onBackground),
                        ),
                        const Spacer(),
                        Text(
                          _formatTime(conv.updatedAt),
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    _statusChip(conv.status, colors),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              HugeIcon(
                icon: HugeIcons.strokeRoundedArrowRight01,
                size: 16,
                color: colors.onSurfaceDim,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedMessage01,
            size: 48,
            color: colors.onSurfaceDim,
          ),
          const SizedBox(height: 16),
          Text(
            'No conversations yet',
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: 4),
          Text(
            'Tap + to start chatting',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final chatState = ref.watch(chatProvider);

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      'Conversations',
                      style:
                          AppTypography.h1.copyWith(color: colors.onBackground),
                    ),
                  ),
                  IconButton(
                    onPressed: () => context.push('/customer/chat/new'),
                    icon: HugeIcon(
                      icon: HugeIcons.strokeRoundedAdd01,
                      size: 22,
                      color: colors.accent,
                    ),
                    tooltip: 'New conversation',
                  ),
                ],
              ),
            ),
            Expanded(
              child: () {
                if (chatState.isLoading) {
                  return Center(
                    child: CircularProgressIndicator(
                      color: colors.accent,
                      strokeWidth: 2,
                    ),
                  );
                }
                if (chatState.error != null) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Failed to load conversations',
                          style: AppTypography.body
                              .copyWith(color: colors.onSurface),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => ref
                              .read(chatProvider.notifier)
                              .loadConversations(),
                          child: Text(
                            'Retry',
                            style: AppTypography.button
                                .copyWith(color: colors.accent),
                          ),
                        ),
                      ],
                    ),
                  );
                }
                if (chatState.conversations.isEmpty) {
                  return _buildEmpty(colors);
                }
                return ListView.separated(
                  itemCount: chatState.conversations.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 0.5,
                    thickness: 0.5,
                    color: colors.outline,
                  ),
                  itemBuilder: (_, i) => _buildCard(
                    chatState.conversations[i],
                    colors,
                  ).animate().fadeIn(
                        delay: Duration(milliseconds: i * 40),
                        duration: const Duration(milliseconds: 200),
                      ),
                );
              }(),
            ),
          ],
        ),
      ),
    );
  }
}
