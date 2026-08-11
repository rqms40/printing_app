import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/chat/widgets/chat_avatar.dart';

class RiderChatListScreen extends ConsumerStatefulWidget {
  const RiderChatListScreen({super.key});

  @override
  ConsumerState<RiderChatListScreen> createState() =>
      _RiderChatListScreenState();
}

class _RiderChatListScreenState extends ConsumerState<RiderChatListScreen> {
  final _scrollCtrl = ScrollController();
  bool _isScrolled = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(chatProvider.notifier).loadConversations());
    _scrollCtrl.addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_handleScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollCtrl.hasClients) return;
    final scrolled = _scrollCtrl.offset > 4;
    if (scrolled != _isScrolled) {
      setState(() => _isScrolled = scrolled);
    }
  }

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return 'm';
    if (diff.inHours < 24) return 'h';
    if (diff.inDays < 7) return 'd';
    return '/';
  }

  String _typeLabel(ConversationType type) => switch (type) {
    ConversationType.ai => 'GridBot AI',
    ConversationType.admin => 'Human Support',
    ConversationType.rider => 'Delivery Rider',
  };

  Widget _statusChip(ConversationStatus status, AppColorSet colors) {
    final (bg, fg, label) = switch (status) {
      ConversationStatus.open => (
        colors.success.withValues(alpha: 0.14),
        colors.success,
        'Open',
      ),
      ConversationStatus.assigned => (
        colors.warning.withValues(alpha: 0.16),
        colors.warning,
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
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.borderFull),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
          fontSize: 11,
          decoration: TextDecoration.none,
        ),
      ),
    );
  }

  String _conversationMeta(Conversation conv) {
    if (conv.orderId != null) return 'Order #';
    return switch (conv.type) {
      ConversationType.ai => 'Instant help',
      ConversationType.admin => 'GRIDGO support',
      ConversationType.rider => 'Delivery rider conversation',
    };
  }

  Widget _buildTile(Conversation conv, AppColorSet colors) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () =>
            context.push('/rider/chat/${conv.id}?type=${conv.type.name}'),
        splashColor: colors.accent.withValues(alpha: 0.06),
        highlightColor: colors.accent.withValues(alpha: 0.04),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: 14,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ChatAvatar(
                icon: chatIconForConversation(conv.type),
                colors: colors,
                size: 46,
                iconSize: 22,
                presence: conv.status == ConversationStatus.closed
                    ? null
                    : (conv.status == ConversationStatus.assigned
                          ? ChatPresence.online
                          : null),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _typeLabel(conv.type),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                              fontSize: 15,
                              decoration: TextDecoration.none,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          _formatTime(conv.updatedAt),
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 11,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _conversationMeta(conv),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.body.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 13,
                              decoration: TextDecoration.none,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _statusChip(conv.status, colors),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty(AppColorSet colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: colors.accent.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedMessage01,
                size: 38,
                color: colors.accent,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'No conversations yet',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: 6),
            Text(
              'Your chats will appear here',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(AppColorSet colors) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(60),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: colors.background,
          boxShadow: _isScrolled
              ? [
                  BoxShadow(
                    color: colors.onBackground.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: SafeArea(
          bottom: false,
          child: SizedBox(
            height: 60,
            child: Row(
              children: [
                const SizedBox(width: AppSpacing.sm),
                Material(
                  color: Colors.transparent,
                  clipBehavior: Clip.antiAlias,
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: () => context.pop(),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedArrowLeft01,
                        size: 24,
                        color: colors.onBackground,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Conversations',
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final chatState = ref.watch(chatProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: _buildAppBar(colors),
      body: SafeArea(
        top: false,
        child: Builder(
          builder: (context) {
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
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedAlertCircle,
                      size: 36,
                      color: colors.warning,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Failed to load conversations',
                      style: AppTypography.body.copyWith(
                        color: colors.onSurface,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: () =>
                          ref.read(chatProvider.notifier).loadConversations(),
                      child: Text(
                        'Retry',
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.accent,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            final convos = chatState.conversations;
            if (convos.isEmpty) {
              return _buildEmpty(colors).animate().fadeIn(duration: 400.ms);
            }

            return RefreshIndicator(
              onRefresh: () =>
                  ref.read(chatProvider.notifier).loadConversations(),
              color: colors.accent,
              backgroundColor: colors.background,
              child: ListView.separated(
                controller: _scrollCtrl,
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.only(
                  top: AppSpacing.md,
                  bottom: MediaQuery.of(context).padding.bottom + 100,
                ),
                itemCount: convos.length,
                separatorBuilder: (_, _) => Divider(
                  height: 1,
                  thickness: 1,
                  color: colors.onBackground.withValues(alpha: 0.04),
                  indent: AppSpacing.lg + 46 + AppSpacing.md,
                ),
                itemBuilder: (context, i) {
                  return _buildTile(convos[i], colors)
                      .animate()
                      .fadeIn(duration: 300.ms, delay: (i * 40).ms)
                      .slideX(
                        begin: 0.05,
                        duration: 300.ms,
                        curve: Curves.easeOut,
                        delay: (i * 40).ms,
                      );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
