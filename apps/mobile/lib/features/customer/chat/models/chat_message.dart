enum SenderRole { customer, admin, rider, bot }

class ChatMessage {
  final int id;
  final int conversationId;
  final int? senderId;
  final SenderRole senderRole;
  final String content;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    this.senderId,
    required this.senderRole,
    required this.content,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as int,
        conversationId: json['conversationId'] as int,
        senderId: json['senderId'] as int?,
        senderRole: SenderRole.values.firstWhere(
          (e) => e.name == (json['senderRole'] as String),
          orElse: () => SenderRole.customer,
        ),
        content: json['content'] as String,
        isRead: json['isRead'] as bool? ?? false,
        readAt: json['readAt'] != null
            ? DateTime.parse(json['readAt'] as String)
            : null,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
