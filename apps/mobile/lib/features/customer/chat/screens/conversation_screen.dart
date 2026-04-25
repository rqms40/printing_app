import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/conversation_provider.dart';
import 'package:printing_app/features/customer/chat/widgets/message_bubble.dart';
import 'package:printing_app/features/customer/chat/widgets/typing_indicator.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.conversationType,
  });

  final int conversationId;
  final ConversationType conversationType;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _textController = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _canSend = false;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  String get _title => switch (widget.conversationType) {
        ConversationType.ai => 'GridBot AI',
        ConversationType.admin => 'Human Support',
        ConversationType.rider => 'Rider Support',
      };

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref
          .read(conversationProvider(widget.conversationId).notifier)
          .initialize(),
    );
    _textController.addListener(() {
      final canSend = _textController.text.trim().isNotEmpty;
      if (canSend != _canSend) setState(() => _canSend = canSend);
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom({bool animated = true}) {
    if (!_scrollCtrl.hasClients) return;
    final target = _scrollCtrl.position.maxScrollExtent;
    if (animated) {
      _scrollCtrl.animateTo(
        target,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    } else {
      _scrollCtrl.jumpTo(target);
    }
  }

  void _sendMessage() {
    final content = _textController.text.trim();
    if (content.isEmpty) return;
    ref
        .read(conversationProvider(widget.conversationId).notifier)
        .sendMessage(content);
    _textController.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _onTyping() {
    ref
        .read(conversationProvider(widget.conversationId).notifier)
        .emitTyping();
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final convState = ref.watch(conversationProvider(widget.conversationId));

    ref.listen(conversationProvider(widget.conversationId), (prev, next) {
      if ((prev?.messages.length ?? 0) < next.messages.length) {
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _scrollToBottom());
      }
    });

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: Theme.of(context).brightness == Brightness.dark
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          elevation: 0,
          scrolledUnderElevation: 0,
          leadingWidth: 40,
          leading: IconButton(
            onPressed: () => context.pop(),
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedArrowLeft02,
              size: 22,
              color: colors.accent,
            ),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _title,
                style: AppTypography.bodyBold
                    .copyWith(color: colors.onBackground),
              ),
              if (convState.isConnected)
                Text(
                  'Online',
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF2E7D32),
                    fontSize: 11,
                  ),
                ),
            ],
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(0.5),
            child: Divider(height: 0.5, thickness: 0.5, color: colors.outline),
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: () {
                if (convState.isLoading) {
                  return Center(
                    child: CircularProgressIndicator(
                      color: colors.accent,
                      strokeWidth: 2,
                    ),
                  );
                }
                if (convState.error != null && convState.messages.isEmpty) {
                  return Center(
                    child: Text(
                      'Could not load messages',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurface),
                    ),
                  );
                }
                final messages = convState.messages;
                final itemCount =
                    messages.length + (convState.isBotTyping ? 1 : 0);
                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.md,
                  ),
                  itemCount: itemCount,
                  itemBuilder: (_, i) {
                    if (i == messages.length && convState.isBotTyping) {
                      return const TypingIndicator();
                    }
                    return MessageBubble(message: messages[i]);
                  },
                );
              }(),
            ),
            _InputBar(
              controller: _textController,
              colors: colors,
              canSend: _canSend,
              onSend: _sendMessage,
              onTyping: _onTyping,
            ),
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.colors,
    required this.canSend,
    required this.onSend,
    required this.onTyping,
  });

  final TextEditingController controller;
  final AppColorSet colors;
  final bool canSend;
  final VoidCallback onSend;
  final VoidCallback onTyping;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(
            top: BorderSide(color: colors.outline, width: 0.5),
          ),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: (_) => onTyping(),
                maxLines: 5,
                minLines: 1,
                textCapitalization: TextCapitalization.sentences,
                style:
                    AppTypography.body.copyWith(color: colors.onBackground),
                decoration: InputDecoration(
                  hintText: 'Type a message…',
                  hintStyle: AppTypography.body
                      .copyWith(color: colors.onSurfaceDim),
                  filled: true,
                  fillColor: colors.surfaceVariant,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: canSend ? (_) => onSend() : null,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            GestureDetector(
              onTap: canSend ? onSend : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: canSend ? colors.accent : colors.surfaceVariant,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: HugeIcon(
                    icon: HugeIcons.strokeRoundedSent,
                    size: 18,
                    color: canSend
                        ? colors.accentOnColor
                        : colors.onSurfaceDim,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
