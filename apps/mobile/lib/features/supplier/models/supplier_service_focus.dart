/// Catalog of supplier service-focus areas used in onboarding and settings.
class SupplierServiceFocus {
  const SupplierServiceFocus({
    required this.key,
    required this.label,
    required this.description,
  });

  final String key;
  final String label;
  final String description;
}

/// Fixed catalog — keep keys in sync with server SUPPLIER_SERVICE_FOCUS_KEYS.
abstract final class SupplierServiceFocusCatalog {
  static const List<SupplierServiceFocus> all = [
    SupplierServiceFocus(
      key: 'signages',
      label: 'Signages',
      description: 'Indoor/outdoor signs, storefronts, acrylic, metal',
    ),
    SupplierServiceFocus(
      key: 'tarpaulins',
      label: 'Tarpaulins',
      description: 'Events, banners, large-format outdoor prints',
    ),
    SupplierServiceFocus(
      key: 'document_printing',
      label: 'Document Printing',
      description: 'Reports, theses, booklets, office documents',
    ),
    SupplierServiceFocus(
      key: 'apparel',
      label: 'Apparel / Shirt Printing',
      description: 'DTG, sublimation, heat press, uniforms',
    ),
    SupplierServiceFocus(
      key: 'stickers_labels',
      label: 'Stickers & Labels',
      description: 'Die-cut, vinyl, product labels, packaging',
    ),
    SupplierServiceFocus(
      key: 'large_format',
      label: 'Large Format',
      description: 'Posters, wall murals, vehicle wrap panels',
    ),
    SupplierServiceFocus(
      key: '3d_printing',
      label: '3D Printing',
      description: 'Prototypes, models, custom parts',
    ),
    SupplierServiceFocus(
      key: 'invitations_cards',
      label: 'Invitations & Cards',
      description: 'Wedding, events, calling cards, specialty paper',
    ),
  ];

  static SupplierServiceFocus? byKey(String key) {
    for (final item in all) {
      if (item.key == key) return item;
    }
    return null;
  }

  static String labelFor(String key) => byKey(key)?.label ?? key;
}
