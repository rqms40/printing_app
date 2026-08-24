class SupplierCatalogAddon {
  const SupplierCatalogAddon({
    required this.name,
    required this.price,
    this.priceType = 'flat',
  });

  final String name;
  final double price;
  final String priceType;

  factory SupplierCatalogAddon.fromJson(Map<String, dynamic> json) {
    return SupplierCatalogAddon(
      name: json['name']?.toString() ?? '',
      price: (json['price'] is num)
          ? (json['price'] as num).toDouble()
          : double.tryParse(json['price']?.toString() ?? '') ?? 0,
      priceType: json['priceType']?.toString() ?? 'flat',
    );
  }
}

class SupplierCatalogOffering {
  const SupplierCatalogOffering({
    required this.id,
    required this.title,
    this.categorySlugs = const [],
    this.specOptions = const {},
    this.addons = const [],
    this.notes = const [],
    this.baseRatePesos,
    this.pricingUnit,
    this.source = 'manual',
    this.sourceFileName,
    this.isActive = true,
  });

  final int id;
  final String title;
  final List<String> categorySlugs;
  final Map<String, List<String>> specOptions;
  final List<SupplierCatalogAddon> addons;
  final List<String> notes;
  final double? baseRatePesos;
  final String? pricingUnit;
  final String source;
  final String? sourceFileName;
  final bool isActive;

  factory SupplierCatalogOffering.fromJson(Map<String, dynamic> json) {
    final slugsRaw = json['categorySlugs'] ?? json['category_slugs'];
    final slugs = <String>[];
    if (slugsRaw is List) {
      for (final item in slugsRaw) {
        final s = item?.toString().trim() ?? '';
        if (s.isNotEmpty) slugs.add(s);
      }
    }

    final specsRaw = json['specOptions'] ?? json['spec_options'];
    final specs = <String, List<String>>{};
    if (specsRaw is Map) {
      for (final entry in specsRaw.entries) {
        final values = <String>[];
        if (entry.value is List) {
          for (final v in entry.value as List) {
            final s = v?.toString().trim() ?? '';
            if (s.isNotEmpty) values.add(s);
          }
        }
        specs[entry.key.toString()] = values;
      }
    }

    final addonsRaw = json['addons'];
    final addons = <SupplierCatalogAddon>[];
    if (addonsRaw is List) {
      for (final item in addonsRaw) {
        if (item is Map) {
          addons.add(
            SupplierCatalogAddon.fromJson(Map<String, dynamic>.from(item)),
          );
        }
      }
    }

    final notesRaw = json['notes'];
    final notes = <String>[];
    if (notesRaw is List) {
      for (final item in notesRaw) {
        final s = item?.toString().trim() ?? '';
        if (s.isNotEmpty) notes.add(s);
      }
    }

    return SupplierCatalogOffering(
      id: (json['id'] is int)
          ? json['id'] as int
          : int.tryParse(json['id']?.toString() ?? '') ?? 0,
      title: json['title']?.toString() ?? 'Catalog item',
      categorySlugs: slugs,
      specOptions: specs,
      addons: addons,
      notes: notes,
      baseRatePesos: json['baseRatePesos'] is num
          ? (json['baseRatePesos'] as num).toDouble()
          : double.tryParse(
              (json['baseRatePesos'] ?? json['base_rate_pesos'])?.toString() ??
                  '',
            ),
      pricingUnit: (json['pricingUnit'] ?? json['pricing_unit'])?.toString(),
      source: json['source']?.toString() ?? 'manual',
      sourceFileName:
          (json['sourceFileName'] ?? json['source_file_name'])?.toString(),
      isActive: json['isActive'] != false,
    );
  }
}
