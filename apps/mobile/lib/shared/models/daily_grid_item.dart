class DailyGridItem {
  const DailyGridItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    required this.category,
    this.categoryName,
    required this.sortOrder,
    this.specs,
    this.specDisplayValues = const {},
  });

  final int id;
  final String title;
  final String? subtitle;
  final String? imageUrl;

  /// Product category slug, e.g. 'paper' or '3d'.
  final String category;
  final String? categoryName;
  final int sortOrder;
  final Map<String, dynamic>? specs;
  final Map<String, String> specDisplayValues;

  factory DailyGridItem.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as String? ?? 'paper';
    return DailyGridItem(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      imageUrl: json['imageUrl'] as String?,
      category: category,
      categoryName: (json['categoryName'] ?? json['category_name'])?.toString(),
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      specs:
          _readMap(json['specs']) ??
          _legacySpecsForCategory(
            category,
            paperSpecs: _readMap(json['paperSpecs'] ?? json['paper_specs']),
            threeDSpecs: _readMap(json['threeDSpecs'] ?? json['three_d_specs']),
          ),
      specDisplayValues: _readStringMap(
        json['specDisplayValues'] ?? json['spec_display_values'],
      ),
    );
  }
}

Map<String, dynamic>? _readMap(dynamic value) {
  if (value is! Map) return null;
  return Map<String, dynamic>.from(value);
}

Map<String, String> _readStringMap(dynamic value) {
  if (value is! Map) return const {};
  return value.map(
    (key, entry) => MapEntry(key.toString(), entry?.toString() ?? ''),
  );
}

Map<String, dynamic>? _legacySpecsForCategory(
  String category, {
  Map<String, dynamic>? paperSpecs,
  Map<String, dynamic>? threeDSpecs,
}) {
  if (category == 'paper' && paperSpecs != null) {
    return {
      if (paperSpecs['paperSize'] != null)
        'paper_size': _enumToServerValue(paperSpecs['paperSize']),
      if (paperSpecs['colorMode'] != null)
        'color_mode': _enumToServerValue(paperSpecs['colorMode']),
      if (paperSpecs['mediaType'] != null)
        'media_type': _enumToServerValue(paperSpecs['mediaType']),
      if (paperSpecs['printSides'] != null)
        'print_sides': _enumToServerValue(paperSpecs['printSides']),
      if (paperSpecs['binding'] != null)
        'binding': _enumToServerValue(paperSpecs['binding']),
    };
  }
  if (category == '3d' && threeDSpecs != null) {
    return {
      if (threeDSpecs['fileFormat'] != null)
        'file_format': _enumToServerValue(threeDSpecs['fileFormat']),
      if (threeDSpecs['material'] != null)
        'material': _enumToServerValue(threeDSpecs['material']),
      if (threeDSpecs['color'] != null) 'color': threeDSpecs['color'],
      if (threeDSpecs['infillPercentage'] != null)
        'infill_percentage': threeDSpecs['infillPercentage'],
      if (threeDSpecs['layerHeight'] != null)
        'layer_height': threeDSpecs['layerHeight'],
      if (threeDSpecs['supports'] != null) 'supports': threeDSpecs['supports'],
      if (threeDSpecs['notes'] != null) 'notes': threeDSpecs['notes'],
    };
  }
  return null;
}

String _enumToServerValue(Object? value) {
  final text = value?.toString() ?? '';
  if (text == 'threeMf') return '3mf';
  return text.replaceAllMapped(
    RegExp(r'([a-z0-9])([A-Z])'),
    (match) => '${match.group(1)}_${match.group(2)!.toLowerCase()}',
  );
}
