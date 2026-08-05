import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/conversation_provider.dart';
import 'package:printing_app/features/customer/chat/widgets/chat_avatar.dart';
import 'package:printing_app/features/customer/chat/widgets/message_bubble.dart';
import 'package:printing_app/features/customer/chat/widgets/typing_indicator.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.conversationType,
    this.currentUserRole = SenderRole.customer,
    this.titleOverride,
    this.subtitleOverride,
    this.backFallback = '/customer/chat',
  });

  final int conversationId;
  final ConversationType conversationType;
  final SenderRole currentUserRole;
  final String? titleOverride;
  final String? subtitleOverride;
  final String backFallback;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _textController = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _inputFocus = FocusNode();
  final _picker = ImagePicker();
  bool _canSend = false;
  bool _isScrolled = false;

  // Pending attachment (selected but not yet sent)
  Uint8List? _pendingImageBytes;
  String? _pendingImageName;
  String? _pendingImageMimeType;
  bool _isUploading = false;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  String get _title =>
      widget.titleOverride ??
      switch (widget.conversationType) {
        ConversationType.ai => 'GridBot AI',
        ConversationType.admin => 'Human Support',
        ConversationType.rider =>
          widget.currentUserRole == SenderRole.rider
              ? 'Client'
              : 'Delivery Rider',
      };

  bool get _isRiderUser => widget.currentUserRole == SenderRole.rider;

  String get _emptyTitle => switch (widget.conversationType) {
    ConversationType.ai => 'Ask GridBot anything',
    ConversationType.admin => 'Start with the GRIDGO team',
    ConversationType.rider =>
      _isRiderUser ? 'Message your client' : 'Message your rider',
  };

  String get _emptyBody => switch (widget.conversationType) {
    ConversationType.ai =>
      'Try asking about pricing, materials, or order steps.',
    ConversationType.admin => 'Send your order question and we will help.',
    ConversationType.rider => _isRiderUser
        ? 'Share your ETA or confirm the drop-off details.'
        : 'Ask about pickup, delivery, or handoff timing.',
  };

  bool get _hasPendingAttachment => _pendingImageBytes != null;

  void _goBack() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(widget.backFallback);
    }
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref
          .read(conversationProvider(widget.conversationId).notifier)
          .initialize(),
    );
    _textController.addListener(_updateCanSend);
    _scrollCtrl.addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_handleScroll);
    _textController.dispose();
    _scrollCtrl.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  void _updateCanSend() {
    final canSend =
        _textController.text.trim().isNotEmpty || _hasPendingAttachment;
    if (canSend != _canSend) setState(() => _canSend = canSend);
  }

  void _handleScroll() {
    if (!_scrollCtrl.hasClients) return;
    final scrolled = _scrollCtrl.offset > 4;
    if (scrolled != _isScrolled) {
      setState(() => _isScrolled = scrolled);
    }
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

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? picked = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2400,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      setState(() {
        _pendingImageBytes = bytes;
        _pendingImageName = picked.name;
        _pendingImageMimeType = picked.mimeType ?? _guessMime(picked.name);
      });
      _updateCanSend();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not pick image: $e')));
    }
  }

  String _guessMime(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.heic')) return 'image/heic';
    return 'image/jpeg';
  }

  void _clearPendingAttachment() {
    setState(() {
      _pendingImageBytes = null;
      _pendingImageName = null;
      _pendingImageMimeType = null;
    });
    _updateCanSend();
  }

  Future<void> _showAttachmentSheet() async {
    if (!mounted) return;
    final colors = _colors(context);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Attach',
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                  fontSize: 15,
                  decoration: TextDecoration.none,
                ),
              ),
              const SizedBox(height: 12),
              _AttachmentOption(
                icon: HugeIcons.strokeRoundedCamera01,
                label: 'Camera',
                colors: colors,
                onTap: () {
                  Navigator.of(sheetCtx).pop();
                  _pickImage(ImageSource.camera);
                },
              ),
              _AttachmentOption(
                icon: HugeIcons.strokeRoundedImage01,
                label: 'Photo Library',
                colors: colors,
                onTap: () {
                  Navigator.of(sheetCtx).pop();
                  _pickImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _sendMessage() async {
    final content = _textController.text.trim();
    final hasAttachment = _hasPendingAttachment;
    if (content.isEmpty && !hasAttachment) return;

    int? attachmentFileId;
    String? attachmentMimeType;

    if (hasAttachment) {
      setState(() => _isUploading = true);
      try {
        final mp = MultipartFile.fromBytes(
          _pendingImageBytes!,
          filename: _pendingImageName ?? 'image.jpg',
        );
        attachmentFileId = await ref
            .read(conversationProvider(widget.conversationId).notifier)
            .uploadImage(mp);
        attachmentMimeType = _pendingImageMimeType;
      } finally {
        if (mounted) setState(() => _isUploading = false);
      }
      if (attachmentFileId == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload failed. Try again.')),
        );
        return;
      }
    }

    final sent = ref
        .read(conversationProvider(widget.conversationId).notifier)
        .sendMessage(
          content,
          attachmentFileId: attachmentFileId,
          attachmentMimeType: attachmentMimeType,
        );

    if (!sent) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reconnecting chat. Please try again.')),
      );
      return;
    }

    _textController.clear();
    _clearPendingAttachment();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _onTyping() {
    ref.read(conversationProvider(widget.conversationId).notifier).emitTyping();
  }

  Future<void> _retryConnection() {
    return ref
        .read(conversationProvider(widget.conversationId).notifier)
        .initialize();
  }

  Widget _emptyConversation(AppColorSet colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: colors.accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: HugeIcon(
                icon: chatIconForConversation(widget.conversationType),
                size: 32,
                color: colors.accent,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _emptyTitle,
              textAlign: TextAlign.center,
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: 6),
            Text(
              _emptyBody,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final convState = ref.watch(conversationProvider(widget.conversationId));

    ref.listen(conversationProvider(widget.conversationId), (prev, next) {
      if ((prev?.messages.length ?? 0) < next.messages.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
      }
    });

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: Theme.of(context).brightness == Brightness.dark
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: colors.background,
        appBar: PreferredSize(
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
                    const SizedBox(width: 4),
                    _IconBackButton(colors: colors, onTap: _goBack),
                    const SizedBox(width: 4),
                    ChatAvatar(
                      icon: chatIconForConversation(widget.conversationType),
                      colors: colors,
                      size: 38,
                      iconSize: 19,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                              fontSize: 15,
                              decoration: TextDecoration.none,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: convState.isConnected
                                      ? colors.success
                                      : colors.warning,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                widget.subtitleOverride ??
                                    (convState.isConnected
                                        ? 'Online'
                                        : 'Reconnecting…'),
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                  fontSize: 11,
                                  decoration: TextDecoration.none,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                ),
              ),
            ),
          ),
        ),
        body: Column(
          children: [
            if (!convState.isLoading && !convState.isConnected)
              _ConnectionBanner(colors: colors, onRetry: _retryConnection),
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
                      style: AppTypography.body.copyWith(
                        color: colors.onSurface,
                      ),
                    ),
                  );
                }
                final messages = convState.messages;
                if (messages.isEmpty && !convState.isBotTyping) {
                  return _emptyConversation(colors);
                }
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
                    return MessageBubble(
                      message: messages[i],
                      currentUserRole: widget.currentUserRole,
                    );
                  },
                );
              }(),
            ),
            if (_hasPendingAttachment)
              _AttachmentPreview(
                bytes: _pendingImageBytes!,
                isUploading: _isUploading,
                colors: colors,
                onRemove: _isUploading ? null : _clearPendingAttachment,
              ),
            _InputBar(
              controller: _textController,
              focusNode: _inputFocus,
              colors: colors,
              canSend: _canSend && !_isUploading,
              isSending: _isUploading,
              onAttach: _isUploading ? null : _showAttachmentSheet,
              onSend: _sendMessage,
              onTyping: _onTyping,
            ),
          ],
        ),
      ),
    );
  }
}

class _IconBackButton extends StatelessWidget {
  const _IconBackButton({required this.colors, required this.onTap});
  final AppColorSet colors;
  final VoidCallback onTap;

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
                color: colors.onBackground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner({required this.colors, required this.onRetry});

  final AppColorSet colors;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: colors.warning.withValues(alpha: 0.1)),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedWifiDisconnected01,
            size: 18,
            color: colors.warning,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Chat is reconnecting',
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              foregroundColor: colors.accent,
              visualDensity: VisualDensity.compact,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _AttachmentPreview extends StatelessWidget {
  const _AttachmentPreview({
    required this.bytes,
    required this.isUploading,
    required this.colors,
    required this.onRemove,
  });

  final Uint8List bytes;
  final bool isUploading;
  final AppColorSet colors;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      color: colors.background,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.memory(
              bytes,
              width: 88,
              height: 88,
              fit: BoxFit.cover,
            ),
          ),
          if (isUploading)
            Positioned(
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          Positioned(
            top: -6,
            right: 88 - 12,
            child: Material(
              color: colors.onBackground,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onRemove,
                customBorder: const CircleBorder(),
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: Center(
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedCancel01,
                      size: 13,
                      color: colors.background,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AttachmentOption extends StatelessWidget {
  const _AttachmentOption({
    required this.icon,
    required this.label,
    required this.colors,
    required this.onTap,
  });

  final dynamic icon;
  final String label;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.accent.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: HugeIcon(icon: icon, size: 20, color: colors.accent),
            ),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppTypography.body.copyWith(
                color: colors.onBackground,
                fontSize: 15,
                decoration: TextDecoration.none,
              ),
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
    required this.focusNode,
    required this.colors,
    required this.canSend,
    required this.isSending,
    required this.onAttach,
    required this.onSend,
    required this.onTyping,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final AppColorSet colors;
  final bool canSend;
  final bool isSending;
  final VoidCallback? onAttach;
  final VoidCallback onSend;
  final VoidCallback onTyping;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          border: Border(
            top: BorderSide(
              color: colors.onBackground.withValues(alpha: 0.07),
              width: 0.5,
            ),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Tooltip(
              message: 'Attach image',
              child: Semantics(
                button: true,
                enabled: onAttach != null,
                label: 'Attach image',
                onTap: onAttach,
                child: ExcludeSemantics(
                  child: Material(
                    color: Colors.transparent,
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: onAttach,
                      customBorder: const CircleBorder(),
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: Center(
                          child: HugeIcon(
                            icon: HugeIcons.strokeRoundedAttachment01,
                            size: 22,
                            color: onAttach == null
                                ? colors.onSurfaceDim
                                : colors.onBackground,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  onChanged: (_) => onTyping(),
                  maxLines: 5,
                  minLines: 1,
                  textCapitalization: TextCapitalization.sentences,
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                    decoration: TextDecoration.none,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Message',
                    hintStyle: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                  ),
                  onSubmitted: canSend ? (_) => onSend() : null,
                ),
              ),
            ),
            const SizedBox(width: 4),
            _SendButton(
              colors: colors,
              canSend: canSend,
              isSending: isSending,
              onSend: onSend,
            ),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.colors,
    required this.canSend,
    required this.isSending,
    required this.onSend,
  });

  final AppColorSet colors;
  final bool canSend;
  final bool isSending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final canSubmit = canSend && !isSending;
    return Tooltip(
      message: 'Send message',
      child: Semantics(
        button: true,
        enabled: canSubmit,
        label: 'Send message',
        onTap: canSubmit ? onSend : null,
        child: ExcludeSemantics(
          child: AnimatedScale(
            scale: canSend ? 1.0 : 0.88,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutBack,
            child: TweenAnimationBuilder<Color?>(
              duration: const Duration(milliseconds: 200),
              tween: ColorTween(
                begin: canSend ? colors.accent : colors.surfaceVariant,
                end: canSend ? colors.accent : colors.surfaceVariant,
              ),
              builder: (context, color, _) => Material(
                color: color ?? colors.surfaceVariant,
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: canSubmit ? onSend : null,
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: Center(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        switchInCurve: Curves.easeOut,
                        switchOutCurve: Curves.easeIn,
                        transitionBuilder: (child, animation) =>
                            ScaleTransition(
                              scale: animation,
                              child: FadeTransition(
                                opacity: animation,
                                child: child,
                              ),
                            ),
                        child: isSending
                            ? SizedBox(
                                key: const ValueKey('loading'),
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: colors.accentOnColor,
                                ),
                              )
                            : HugeIcon(
                                key: const ValueKey('send'),
                                icon: HugeIcons.strokeRoundedSent,
                                size: 19,
                                color: canSend
                                    ? colors.accentOnColor
                                    : colors.onSurfaceDim,
                              ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
