enum ConversationType { ai, admin, rider }
enum ConversationStatus { open, assigned, closed }

class Conversation {
  final int id;
  final int customerId;
  final ConversationType type;
  final int? orderId;
  final int? assignedAdminId;
  final int? assignedRiderId;
  final ConversationStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? closedAt;

  const Conversation({
    required this.id,
    required this.customerId,
    required this.type,
    this.orderId,
    this.assignedAdminId,
    this.assignedRiderId,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.closedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as int,
        customerId: json['customerId'] as int,
        type: ConversationType.values.firstWhere(
          (e) => e.name == (json['type'] as String),
          orElse: () => ConversationType.admin,
        ),
        orderId: json['orderId'] as int?,
        assignedAdminId: json['assignedAdminId'] as int?,
        assignedRiderId: json['assignedRiderId'] as int?,
        status: ConversationStatus.values.firstWhere(
          (e) => e.name == (json['status'] as String),
          orElse: () => ConversationStatus.open,
        ),
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        closedAt: json['closedAt'] != null
            ? DateTime.parse(json['closedAt'] as String)
            : null,
      );
}
