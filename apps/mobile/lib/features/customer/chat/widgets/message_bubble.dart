import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/widgets/chat_avatar.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

/// Resolves a presigned URL for a chat attachment file id. Cached per id.
final attachmentPresignedUrlProvider = FutureProvider.family
    .autoDispose<String?, int>((ref, fileId) async {
      final dio = ref.read(dioProvider);
      try {
        final res = await dio.get<Map<String, dynamic>>(
          '/files/$fileId/presigned-url',
        );
        return res.data?['url'] as String?;
      } catch (_) {
        return null;
      }
    });

class MessageBubble extends ConsumerWidget {
  const MessageBubble({
    super.key,
    required this.message,
    this.currentUserRole = SenderRole.customer,
  });

  final ChatMessage message;
  final SenderRole currentUserRole;

  bool get _isOutgoing => message.senderRole == currentUserRole;
  bool get _shouldRenderMarkdown =>
      message.senderRole == SenderRole.bot ||
      message.senderRole == SenderRole.admin ||
      message.senderRole == SenderRole.supplier;

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

  String _senderLabel() => switch (message.senderRole) {
    SenderRole.customer => 'Client',
    SenderRole.admin => 'Human Support',
    SenderRole.rider => 'Rider',
    SenderRole.bot => 'GridBot AI',
    SenderRole.supplier => 'Print Shop',
  };

  String _semanticLabel() {
    final parts = <String>[_senderLabel()];
    if (message.hasContent) parts.add(message.content!);
    if (message.hasImageAttachment) parts.add('Image attachment');
    parts.add(_timeLabel());
    return parts.join('\n');
  }

  Future<void> _onLinkTapped(String? href) async {
    if (href == null || href.isEmpty) return;
    final uri = Uri.tryParse(href);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Widget _buildText({
    required BuildContext context,
    required Color textColor,
    required AppColorSet colors,
  }) {
    if (!message.hasContent) return const SizedBox.shrink();

    final baseStyle = AppTypography.body.copyWith(
      color: textColor,
      decoration: TextDecoration.none,
      height: 1.45,
    );

    if (!_shouldRenderMarkdown) {
      return Text(message.content!, style: baseStyle);
    }

    final codeBg = _isOutgoing
        ? colors.accentOnColor.withValues(alpha: 0.18)
        : colors.background.withValues(alpha: 0.5);

    return MarkdownBody(
      data: message.content!,
      selectable: true,
      onTapLink: (_, href, _) => _onLinkTapped(href),
      shrinkWrap: true,
      fitContent: true,
      styleSheet: MarkdownStyleSheet(
        p: baseStyle,
        h1: baseStyle.copyWith(fontSize: 18, fontWeight: FontWeight.w700),
        h2: baseStyle.copyWith(fontSize: 16, fontWeight: FontWeight.w700),
        h3: baseStyle.copyWith(fontSize: 15, fontWeight: FontWeight.w700),
        h4: baseStyle.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
        em: baseStyle.copyWith(fontStyle: FontStyle.italic),
        strong: baseStyle.copyWith(fontWeight: FontWeight.w700),
        a: baseStyle.copyWith(
          color: _isOutgoing ? colors.accentOnColor : colors.accent,
          decoration: TextDecoration.underline,
          decorationColor: (_isOutgoing ? colors.accentOnColor : colors.accent)
              .withValues(alpha: 0.5),
        ),
        code: baseStyle.copyWith(
          fontFamily: 'monospace',
          fontSize: 13,
          backgroundColor: codeBg,
          color: textColor,
        ),
        codeblockDecoration: BoxDecoration(
          color: codeBg,
          borderRadius: BorderRadius.circular(8),
        ),
        codeblockPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        blockquote: baseStyle.copyWith(
          color: textColor.withValues(alpha: 0.85),
          fontStyle: FontStyle.italic,
        ),
        blockquoteDecoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: textColor.withValues(alpha: 0.3), width: 3),
          ),
        ),
        blockquotePadding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
        listBullet: baseStyle,
        listBulletPadding: const EdgeInsets.only(right: 6),
        h1Padding: const EdgeInsets.only(top: 6, bottom: 2),
        h2Padding: const EdgeInsets.only(top: 6, bottom: 2),
        h3Padding: const EdgeInsets.only(top: 4, bottom: 2),
        pPadding: const EdgeInsets.only(bottom: 2),
        blockSpacing: 6,
      ),
    );
  }

  Widget _buildImageAttachment({
    required BuildContext context,
    required WidgetRef ref,
    required AppColorSet colors,
  }) {
    final urlAsync = ref.watch(
      attachmentPresignedUrlProvider(message.attachmentFileId!),
    );

    return GestureDetector(
      onTap: urlAsync.asData?.value == null
          ? null
          : () => _showImagePreview(context, urlAsync.asData!.value!),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxHeight: 280,
            minHeight: 100,
            minWidth: 100,
          ),
          child: urlAsync.when(
            data: (url) {
              if (url == null) {
                return _imageError(colors);
              }
              return CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                httpHeaders: const {},
                placeholder: (_, _) => _imageLoading(colors),
                errorWidget: (_, _, _) => _imageError(colors),
              );
            },
            loading: () => _imageLoading(colors),
            error: (_, _) => _imageError(colors),
          ),
        ),
      ),
    );
  }

  Widget _imageLoading(AppColorSet colors) => Container(
    width: 200,
    height: 160,
    color: colors.surfaceVariant,
    alignment: Alignment.center,
    child: SizedBox(
      width: 22,
      height: 22,
      child: CircularProgressIndicator(strokeWidth: 2, color: colors.accent),
    ),
  );

  Widget _imageError(AppColorSet colors) => Container(
    width: 180,
    height: 130,
    color: colors.surfaceVariant,
    alignment: Alignment.center,
    child: HugeIcon(
      icon: HugeIcons.strokeRoundedImageNotFound01,
      size: 28,
      color: colors.onSurfaceDim,
    ),
  );

  void _showImagePreview(BuildContext context, String url) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (_, _, _) => _ImagePreviewScreen(url: url),
      ),
    );
  }

  Widget _buildReadReceipt(AppColorSet colors) {
    if (!_isOutgoing) return const SizedBox.shrink();

    final read = message.isRead;
    final color = read
        ? colors.accent
        : colors.accentOnColor.withValues(alpha: 0.65);

    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: HugeIcon(
        icon: read
            ? HugeIcons.strokeRoundedTickDouble01
            : HugeIcons.strokeRoundedTick01,
        size: 13,
        color: color,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final isOutgoing = _isOutgoing;

    final bgColor = isOutgoing ? colors.accent : colors.surfaceVariant;
    final textColor = isOutgoing ? colors.accentOnColor : colors.onBackground;
    final timeColor = isOutgoing
        ? colors.accentOnColor.withValues(alpha: 0.65)
        : colors.onSurfaceDim;

    final hasImage = message.hasImageAttachment;
    final hasContent = message.hasContent;
    final imageOnly = hasImage && !hasContent;

    return Semantics(
      container: true,
      label: _semanticLabel(),
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final maxBubbleWidth = constraints.maxWidth * 0.78;

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                mainAxisAlignment: isOutgoing
                    ? MainAxisAlignment.end
                    : MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (!isOutgoing) ...[
                    ChatAvatar(
                      icon: chatIconForSender(message.senderRole),
                      colors: colors,
                      size: 88,
                      iconSize: 24,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Flexible(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: maxBubbleWidth),
                      child: Column(
                        crossAxisAlignment: isOutgoing
                            ? CrossAxisAlignment.end
                            : CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: imageOnly
                                ? const EdgeInsets.all(4)
                                : const EdgeInsets.symmetric(
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
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (hasImage)
                                  _buildImageAttachment(
                                    context: context,
                                    ref: ref,
                                    colors: colors,
                                  ),
                                if (hasImage && hasContent)
                                  const SizedBox(height: 8),
                                if (hasContent)
                                  Padding(
                                    padding: imageOnly
                                        ? EdgeInsets.zero
                                        : EdgeInsets.zero,
                                    child: _buildText(
                                      context: context,
                                      textColor: textColor,
                                      colors: colors,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 3),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _timeLabel(),
                                  style: AppTypography.caption.copyWith(
                                    color: timeColor,
                                    fontSize: 10,
                                    decoration: TextDecoration.none,
                                  ),
                                ),
                                _buildReadReceipt(colors),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (isOutgoing) const SizedBox(width: AppSpacing.xs),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Full-screen image viewer with pinch-to-zoom and dismiss.
class _ImagePreviewScreen extends StatelessWidget {
  const _ImagePreviewScreen({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                maxScale: 4,
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                  placeholder: (_, _) => const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 8,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => Navigator.of(context).pop(),
                  customBorder: const CircleBorder(),
                  child: const SizedBox(
                    width: 40,
                    height: 40,
                    child: Center(
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedCancel01,
                        size: 20,
                        color: Colors.white,
                      ),
                    ),
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
