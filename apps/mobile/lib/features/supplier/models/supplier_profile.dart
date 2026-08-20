/// Supplier shop profile returned by GET /suppliers/me.
class SupplierProfile {
  const SupplierProfile({
    required this.id,
    required this.userId,
    required this.businessName,
    this.description,
    this.contactPhone,
    this.contactEmail,
    this.address,
    this.latitude,
    this.longitude,
    this.logoFileId,
    this.logoUrl,
    this.attributes = const {},
    this.serviceZones = const [],
    this.serviceFocusRanks = const [],
    this.isActive = true,
    this.ratingAverage = 0,
    this.ratingCount = 0,
    this.capabilities = const [],
    this.verificationStatus,
  });

  final int id;
  final int userId;
  final String businessName;
  final String? description;
  final String? contactPhone;
  final String? contactEmail;
  final String? address;
  final double? latitude;
  final double? longitude;
  final int? logoFileId;
  final String? logoUrl;
  final Map<String, String> attributes;
  final List<String> serviceZones;
  /// Ordered service-focus keys (index 0 = highest priority).
  final List<String> serviceFocusRanks;
  final bool isActive;
  final double ratingAverage;
  final int ratingCount;
  final List<SupplierCapability> capabilities;
  final String? verificationStatus;

  factory SupplierProfile.fromJson(Map<String, dynamic> json) {
    final attrsRaw = json['attributes'];
    final Map<String, String> attrs = {};
    if (attrsRaw is Map) {
      for (final entry in attrsRaw.entries) {
        final key = entry.key.toString().trim();
        if (key.isEmpty) continue;
        attrs[key] = entry.value?.toString() ?? '';
      }
    }

    final zonesRaw = json['serviceZones'] ?? json['service_zones'];
    final zones = <String>[];
    if (zonesRaw is List) {
      for (final z in zonesRaw) {
        final s = z?.toString().trim() ?? '';
        if (s.isNotEmpty) zones.add(s);
      }
    }

    final focusRaw = json['serviceFocusRanks'] ?? json['service_focus_ranks'];
    final focusRanks = <String>[];
    if (focusRaw is List) {
      for (final f in focusRaw) {
        final s = f?.toString().trim() ?? '';
        if (s.isNotEmpty) focusRanks.add(s);
      }
    }

    final capsRaw = json['capabilities'];
    final caps = <SupplierCapability>[];
    if (capsRaw is List) {
      for (final c in capsRaw) {
        if (c is Map) {
          caps.add(
            SupplierCapability.fromJson(Map<String, dynamic>.from(c)),
          );
        }
      }
    }

    final verification = json['verification'];
    String? status;
    if (verification is Map) {
      status = verification['status']?.toString();
    }

    return SupplierProfile(
      id: _asInt(json['id']) ?? 0,
      userId: _asInt(json['userId'] ?? json['user_id']) ?? 0,
      businessName:
          (json['businessName'] ?? json['business_name'] ?? '').toString(),
      description: json['description']?.toString(),
      contactPhone:
          (json['contactPhone'] ?? json['contact_phone'])?.toString(),
      contactEmail:
          (json['contactEmail'] ?? json['contact_email'])?.toString(),
      address: json['address']?.toString(),
      latitude: _asDoubleOrNull(json['latitude']),
      longitude: _asDoubleOrNull(json['longitude']),
      logoFileId: _asInt(json['logoFileId'] ?? json['logo_file_id']),
      logoUrl: (json['logoUrl'] ?? json['logo_url'])?.toString(),
      attributes: attrs,
      serviceZones: zones,
      serviceFocusRanks: focusRanks,
      isActive: json['isActive'] == true || json['is_active'] == true,
      ratingAverage: _asDouble(json['ratingAverage'] ?? json['rating_average']),
      ratingCount: _asInt(json['ratingCount'] ?? json['rating_count']) ?? 0,
      capabilities: caps,
      verificationStatus: status,
    );
  }

  SupplierProfile copyWith({
    String? businessName,
    String? description,
    String? contactPhone,
    String? contactEmail,
    String? address,
    double? latitude,
    double? longitude,
    int? logoFileId,
    String? logoUrl,
    Map<String, String>? attributes,
    List<String>? serviceZones,
    List<String>? serviceFocusRanks,
    List<SupplierCapability>? capabilities,
  }) {
    return SupplierProfile(
      id: id,
      userId: userId,
      businessName: businessName ?? this.businessName,
      description: description ?? this.description,
      contactPhone: contactPhone ?? this.contactPhone,
      contactEmail: contactEmail ?? this.contactEmail,
      address: address ?? this.address,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      logoFileId: logoFileId ?? this.logoFileId,
      logoUrl: logoUrl ?? this.logoUrl,
      attributes: attributes ?? this.attributes,
      serviceZones: serviceZones ?? this.serviceZones,
      serviceFocusRanks: serviceFocusRanks ?? this.serviceFocusRanks,
      isActive: isActive,
      ratingAverage: ratingAverage,
      ratingCount: ratingCount,
      capabilities: capabilities ?? this.capabilities,
      verificationStatus: verificationStatus,
    );
  }
}

class SupplierCapability {
  const SupplierCapability({
    required this.id,
    required this.productFamily,
    this.materials = const [],
    this.maxCapacity = 0,
    this.leadTimeDays = 1,
  });

  final int id;
  final String productFamily;
  final List<String> materials;
  final int maxCapacity;
  final int leadTimeDays;

  factory SupplierCapability.fromJson(Map<String, dynamic> json) {
    final materialsRaw = json['materials'];
    final materials = <String>[];
    if (materialsRaw is List) {
      for (final m in materialsRaw) {
        final s = m?.toString().trim() ?? '';
        if (s.isNotEmpty) materials.add(s);
      }
    }
    return SupplierCapability(
      id: _asInt(json['id']) ?? 0,
      productFamily:
          (json['productFamily'] ?? json['product_family'] ?? '').toString(),
      materials: materials,
      maxCapacity:
          _asInt(json['maxCapacity'] ?? json['max_capacity']) ?? 0,
      leadTimeDays:
          _asInt(json['leadTimeDays'] ?? json['lead_time_days']) ?? 1,
    );
  }
}

int? _asInt(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

double _asDouble(Object? value) {
  if (value == null) return 0;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

double? _asDoubleOrNull(Object? value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}
