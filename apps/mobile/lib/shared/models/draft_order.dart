import 'paper_specs.dart';
import 'three_d_specs.dart';

class DraftOrder {
  const DraftOrder({
    required this.localId,
    this.category,
    this.paperSpecs,
    this.threeDSpecs,
    this.localFileUri,
    this.quantity,
    this.deliveryOption,
    this.savedAddressId,
    required this.savedAt,
  });

  final String localId;
  final String? category;
  final PaperSpecs? paperSpecs;
  final ThreeDSpecs? threeDSpecs;
  final String? localFileUri;
  final int? quantity;
  final String? deliveryOption;
  final String? savedAddressId;
  final DateTime savedAt;

  DraftOrder copyWith({
    String? localId,
    String? category,
    PaperSpecs? paperSpecs,
    ThreeDSpecs? threeDSpecs,
    String? localFileUri,
    int? quantity,
    String? deliveryOption,
    String? savedAddressId,
    DateTime? savedAt,
  }) {
    return DraftOrder(
      localId: localId ?? this.localId,
      category: category ?? this.category,
      paperSpecs: paperSpecs ?? this.paperSpecs,
      threeDSpecs: threeDSpecs ?? this.threeDSpecs,
      localFileUri: localFileUri ?? this.localFileUri,
      quantity: quantity ?? this.quantity,
      deliveryOption: deliveryOption ?? this.deliveryOption,
      savedAddressId: savedAddressId ?? this.savedAddressId,
      savedAt: savedAt ?? this.savedAt,
    );
  }

  @override
  String toString() => 'DraftOrder($localId, $category)';
}
