import 'package:printing_app/shared/models/address.dart';

class TemporaryCheckoutAddress {
  const TemporaryCheckoutAddress({
    this.label,
    required this.fullAddress,
    this.barangay,
    required this.city,
    this.province,
    this.zipCode,
    this.landmark,
    required this.latitude,
    required this.longitude,
  });

  final String? label;
  final String fullAddress;
  final String? barangay;
  final String city;
  final String? province;
  final String? zipCode;
  final String? landmark;
  final double latitude;
  final double longitude;

  bool get isValid {
    final hasAddress = fullAddress.trim().isNotEmpty && city.trim().isNotEmpty;
    final hasCoordinates =
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180 &&
        !(latitude == 0 && longitude == 0);
    return hasAddress && hasCoordinates;
  }

  String get displayLabel {
    final trimmedLabel = label?.trim();
    if (trimmedLabel != null && trimmedLabel.isNotEmpty) return trimmedLabel;
    return 'Pinned location';
  }

  Map<String, dynamic> toJson() => {
    'label': _nullableText(label),
    'fullAddress': fullAddress.trim(),
    'barangay': _nullableText(barangay),
    'city': city.trim(),
    'province': _nullableText(province),
    'zipCode': _nullableText(zipCode),
    'landmark': _nullableText(landmark),
    'latitude': latitude,
    'longitude': longitude,
  };

  static String? _nullableText(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

class CheckoutAddressSelection {
  const CheckoutAddressSelection.saved(this.savedAddress)
    : temporaryAddress = null;

  const CheckoutAddressSelection.temporary(this.temporaryAddress)
    : savedAddress = null;

  final Address? savedAddress;
  final TemporaryCheckoutAddress? temporaryAddress;
}
