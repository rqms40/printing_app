class DestinationGroup {
  const DestinationGroup({
    required this.id,
    required this.label,
    required this.itemIds,
    this.addressId,
  });

  final String id; // local UUID
  final String label;
  final List<String> itemIds; // CartItem.id list
  final int? addressId; // null until customer picks an address

  DestinationGroup copyWith({
    String? label,
    List<String>? itemIds,
    int? addressId,
  }) =>
      DestinationGroup(
        id: id,
        label: label ?? this.label,
        itemIds: itemIds ?? this.itemIds,
        addressId: addressId ?? this.addressId,
      );
}
