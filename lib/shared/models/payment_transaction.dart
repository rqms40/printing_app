import 'enums.dart';

class PaymentTransaction {
  const PaymentTransaction({
    required this.id,
    required this.orderId,
    required this.paymentMethod,
    required this.amount,
    required this.status,
    this.externalReferenceId,
    required this.createdAt,
  });

  final String id;
  final String orderId;
  final PaymentMethod paymentMethod;
  final double amount;
  final PaymentStatus status;
  final String? externalReferenceId;
  final DateTime createdAt;

  PaymentTransaction copyWith({
    String? id,
    String? orderId,
    PaymentMethod? paymentMethod,
    double? amount,
    PaymentStatus? status,
    String? externalReferenceId,
    DateTime? createdAt,
  }) {
    return PaymentTransaction(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      amount: amount ?? this.amount,
      status: status ?? this.status,
      externalReferenceId: externalReferenceId ?? this.externalReferenceId,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'PaymentTransaction($id, ${paymentMethod.displayName}, ${status.displayName})';
}
