enum SenderRole { customer, admin, rider, bot, supplier }

class ChatMessage {
  final int id;
  final int conversationId;
  final int? senderId;
  final SenderRole senderRole;
  final String? content;
  final int? attachmentFileId;
  final String? attachmentMimeType;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    this.senderId,
    required this.senderRole,
    this.content,
    this.attachmentFileId,
    this.attachmentMimeType,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  bool get hasImageAttachment =>
      attachmentFileId != null &&
      (attachmentMimeType?.startsWith('image/') ?? false);
  bool get hasContent => (content ?? '').trim().isNotEmpty;

  ChatMessage copyWith({bool? isRead, DateTime? readAt}) => ChatMessage(
    id: id,
    conversationId: conversationId,
    senderId: senderId,
    senderRole: senderRole,
    content: content,
    attachmentFileId: attachmentFileId,
    attachmentMimeType: attachmentMimeType,
    isRead: isRead ?? this.isRead,
    readAt: readAt ?? this.readAt,
    createdAt: createdAt,
  );

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'] as int,
    conversationId: json['conversationId'] as int,
    senderId: json['senderId'] as int?,
    senderRole: SenderRole.values.firstWhere(
      (e) => e.name == (json['senderRole'] as String),
      orElse: () => SenderRole.customer,
    ),
    content: json['content'] as String?,
    attachmentFileId: json['attachmentFileId'] as int?,
    attachmentMimeType: json['attachmentMimeType'] as String?,
    isRead: json['isRead'] as bool? ?? false,
    readAt: json['readAt'] != null
        ? DateTime.parse(json['readAt'] as String)
        : null,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}
