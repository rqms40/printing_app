import 'package:printing_app/features/customer/order/models/checkout_address.dart';

class DestinationGroup {
  const DestinationGroup({
    required this.id,
    required this.label,
    required this.itemIds,
    this.addressId,
    this.temporaryAddress,
  });

  final String id; // local UUID
  final String label;
  final List<String> itemIds; // CartItem.id list
  final int? addressId; // null until customer picks an address
  final TemporaryCheckoutAddress? temporaryAddress;

  bool get hasValidDestination =>
      (addressId != null && addressId! > 0) ||
      (temporaryAddress?.isValid ?? false);

  String get destinationLabel {
    if (temporaryAddress?.isValid ?? false) {
      return temporaryAddress!.displayLabel;
    }
    return label;
  }

  DestinationGroup copyWith({
    String? label,
    List<String>? itemIds,
    int? addressId,
    TemporaryCheckoutAddress? temporaryAddress,
    bool clearAddressId = false,
    bool clearTemporaryAddress = false,
  }) => DestinationGroup(
    id: id,
    label: label ?? this.label,
    itemIds: itemIds ?? this.itemIds,
    addressId: clearAddressId ? null : addressId ?? this.addressId,
    temporaryAddress: clearTemporaryAddress
        ? null
        : temporaryAddress ?? this.temporaryAddress,
  );
}
