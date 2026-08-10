class ProductCatalog {
  const ProductCatalog({required this.categories});

  final List<ProductCategory> categories;

  factory ProductCatalog.fromJson(Map<String, dynamic> json) {
    final rawCategories = json['categories'];
    return ProductCatalog(
      categories: rawCategories is List
          ? rawCategories
                .whereType<Map>()
                .map(
                  (entry) => ProductCategory.fromJson(
                    Map<String, dynamic>.from(entry),
                  ),
                )
                .toList()
          : const [],
    );
  }

  factory ProductCatalog.fallback() => const ProductCatalog(
    categories: [
      ProductCategory(
        id: 1,
        name: 'Paper Printing',
        slug: 'paper',
        description: 'Standard and large-format paper printing',
        mobileDescription: 'Print documents, posters, flyers, and handouts.',
        icon: 'FileTextOutlined',
        fileProcessingType: 'document',
        pricingModel: 'per_page_modifiers',
        baseRate: 2,
        quantityUnit: 'page',
        maxFileSizeMb: 50,
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'docx'],
        isActive: true,
        sortOrder: 1,
        specs: [
          ProductSpecDefinition.select(
            id: 1,
            categoryId: 1,
            key: 'paper_size',
            label: 'Paper Size',
            pricingRole: 'multiplier',
            sortOrder: 10,
            options: [
              ProductSpecOption(label: 'A5', value: 'a5', multiplier: 0.8),
              ProductSpecOption(
                label: 'A4',
                value: 'a4',
                multiplier: 1,
                isDefault: true,
              ),
              ProductSpecOption(label: 'A3', value: 'a3', multiplier: 1.5),
              ProductSpecOption(label: 'A2', value: 'a2', multiplier: 2.5),
              ProductSpecOption(label: 'A1', value: 'a1', multiplier: 4),
              ProductSpecOption(
                label: '20x30',
                value: 'twenty_by_thirty',
                multiplier: 3,
              ),
              ProductSpecOption(
                label: 'Custom',
                value: 'custom',
                multiplier: 2,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 2,
            categoryId: 1,
            key: 'color_mode',
            label: 'Color Mode',
            pricingRole: 'multiplier',
            sortOrder: 20,
            options: [
              ProductSpecOption(
                label: 'Black & White',
                value: 'black_and_white',
                multiplier: 1,
                isDefault: true,
              ),
              ProductSpecOption(
                label: 'Full Color',
                value: 'full_color',
                multiplier: 2.5,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 3,
            categoryId: 1,
            key: 'media_type',
            label: 'Media Type',
            pricingRole: 'multiplier',
            sortOrder: 30,
            options: [
              ProductSpecOption(
                label: 'Matte',
                value: 'matte',
                multiplier: 1,
                isDefault: true,
              ),
              ProductSpecOption(
                label: 'Glossy',
                value: 'glossy',
                multiplier: 1.3,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 4,
            categoryId: 1,
            key: 'print_sides',
            label: 'Print Sides',
            pricingRole: 'multiplier',
            sortOrder: 40,
            options: [
              ProductSpecOption(
                label: 'Front Only',
                value: 'front_only',
                multiplier: 1,
                isDefault: true,
              ),
              ProductSpecOption(
                label: 'Back to Back',
                value: 'back_to_back',
                multiplier: 1.8,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 5,
            categoryId: 1,
            key: 'binding',
            label: 'Binding',
            pricingRole: 'fixed_fee',
            sortOrder: 50,
            options: [
              ProductSpecOption(
                label: 'None',
                value: 'none',
                fixedFee: 0,
                isDefault: true,
              ),
              ProductSpecOption(label: 'Staple', value: 'staple', fixedFee: 10),
              ProductSpecOption(label: 'Spiral', value: 'spiral', fixedFee: 25),
              ProductSpecOption(
                label: 'Premium',
                value: 'premium',
                fixedFee: 50,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 6,
            categoryId: 1,
            key: 'print_mode',
            label: 'Print Mode',
            pricingRole: 'none',
            sortOrder: 60,
            defaultValue: 'fitToPage',
            options: [
              ProductSpecOption(
                label: 'Fit to Scale',
                value: 'fitToPage',
                isDefault: true,
              ),
              ProductSpecOption(label: 'Actual Size', value: 'actualSize'),
            ],
          ),
          ProductSpecDefinition(
            id: 7,
            categoryId: 1,
            key: 'page_count',
            label: 'Page Count',
            inputType: 'number',
            valueType: 'number',
            pricingRole: 'estimated_quantity',
            defaultValue: '1',
            unitLabel: 'pages',
            minValue: 1,
            maxValue: 500,
            stepValue: 1,
            sortOrder: 70,
            metadata: {'hidden': true},
          ),
        ],
      ),
      ProductCategory(
        id: 2,
        name: '3D Printing',
        slug: '3d',
        description: 'FDM 3D printing with PLA, ABS, and PETG materials',
        mobileDescription:
            'Upload a 3D model and choose material, color, and print settings.',
        icon: 'AppstoreOutlined',
        fileProcessingType: 'model_3d',
        pricingModel: 'base_plus_material_estimate',
        baseRate: 50,
        quantityUnit: 'gram',
        maxFileSizeMb: 200,
        allowedExtensions: ['stl', 'obj', '3mf', 'glb', 'gltf'],
        isActive: true,
        sortOrder: 2,
        specs: [
          ProductSpecDefinition.select(
            id: 8,
            categoryId: 2,
            key: 'file_format',
            label: 'File Format',
            pricingRole: 'none',
            sortOrder: 10,
            options: [
              ProductSpecOption(label: 'STL', value: 'stl', isDefault: true),
              ProductSpecOption(label: 'OBJ', value: 'obj'),
              ProductSpecOption(label: '3MF', value: '3mf'),
              ProductSpecOption(label: 'GLB', value: 'glb'),
              ProductSpecOption(label: 'GLTF', value: 'gltf'),
            ],
          ),
          ProductSpecDefinition.select(
            id: 9,
            categoryId: 2,
            key: 'material',
            label: 'Material',
            pricingRole: 'unit_cost',
            sortOrder: 20,
            unitLabel: 'g',
            options: [
              ProductSpecOption(
                label: 'PLA',
                value: 'pla',
                unitCost: 3,
                isDefault: true,
              ),
              ProductSpecOption(label: 'ABS', value: 'abs', unitCost: 3),
              ProductSpecOption(label: 'PETG', value: 'petg', unitCost: 4),
            ],
          ),
          ProductSpecDefinition.select(
            id: 10,
            categoryId: 2,
            key: 'color',
            label: 'Color',
            pricingRole: 'none',
            sortOrder: 30,
            options: [
              ProductSpecOption(
                label: 'White',
                value: 'white',
                isDefault: true,
              ),
              ProductSpecOption(label: 'Black', value: 'black'),
              ProductSpecOption(label: 'Gray', value: 'gray'),
            ],
          ),
          ProductSpecDefinition.select(
            id: 11,
            categoryId: 2,
            key: 'infill_percentage',
            label: 'Infill Percentage',
            pricingRole: 'estimated_quantity',
            valueType: 'number',
            unitLabel: '%',
            sortOrder: 40,
            options: [
              ProductSpecOption(
                label: '10%',
                value: '10',
                estimatedQuantity: 20,
                isDefault: true,
              ),
              ProductSpecOption(
                label: '20%',
                value: '20',
                estimatedQuantity: 40,
              ),
              ProductSpecOption(
                label: '50%',
                value: '50',
                estimatedQuantity: 100,
              ),
              ProductSpecOption(
                label: '100%',
                value: '100',
                estimatedQuantity: 200,
              ),
            ],
          ),
          ProductSpecDefinition.select(
            id: 12,
            categoryId: 2,
            key: 'layer_height',
            label: 'Layer Height',
            pricingRole: 'none',
            valueType: 'number',
            unitLabel: 'mm',
            sortOrder: 50,
            options: [
              ProductSpecOption(label: '0.1mm', value: '0.1'),
              ProductSpecOption(label: '0.2mm', value: '0.2', isDefault: true),
              ProductSpecOption(label: '0.3mm', value: '0.3'),
            ],
          ),
          ProductSpecDefinition.select(
            id: 13,
            categoryId: 2,
            key: 'supports',
            label: 'Supports',
            pricingRole: 'fixed_fee',
            valueType: 'boolean',
            sortOrder: 60,
            options: [
              ProductSpecOption(
                label: 'No',
                value: 'false',
                fixedFee: 0,
                isDefault: true,
              ),
              ProductSpecOption(label: 'Yes', value: 'true', fixedFee: 30),
            ],
          ),
          ProductSpecDefinition(
            id: 14,
            categoryId: 2,
            key: 'notes',
            label: 'Notes',
            inputType: 'text',
            valueType: 'string',
            pricingRole: 'none',
            isRequired: false,
            sortOrder: 70,
          ),
        ],
      ),
    ],
  );

  List<ProductCategory> get activeCategories =>
      categories.where((category) => category.isActive).toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  /// Top-level browse nodes (Category L1 + legacy orderable roots).
  List<ProductCategory> get rootCategories => activeCategories
      .where((category) => category.parentId == null)
      .toList()
    ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  /// Orderable leaves only (checkout-eligible products).
  List<ProductCategory> get orderableCategories => activeCategories
      .where((category) => category.isOrderable)
      .toList()
    ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  List<ProductCategory> childrenOf(int? parentId) {
    return activeCategories
        .where((category) => category.parentId == parentId)
        .toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  ProductCategory? categoryBySlug(String? slug) {
    if (slug == null) return null;
    for (final category in categories) {
      if (category.slug == slug) return category;
    }
    return null;
  }

  ProductCategory? categoryById(int id) {
    for (final category in categories) {
      if (category.id == id) return category;
    }
    return null;
  }
}

class ProductCategory {
  const ProductCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.mobileDescription,
    this.audienceLabel,
    this.icon,
    this.parentId,
    this.catalogLevel = 1,
    this.isOrderable = true,
    required this.fileProcessingType,
    required this.pricingModel,
    required this.baseRate,
    required this.quantityUnit,
    required this.maxFileSizeMb,
    required this.allowedExtensions,
    required this.isActive,
    required this.sortOrder,
    this.specs = const [],
  });

  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? mobileDescription;
  final String? audienceLabel;
  final String? icon;
  final int? parentId;
  final int catalogLevel;
  final bool isOrderable;
  final String fileProcessingType;
  final String pricingModel;
  final double baseRate;
  final String quantityUnit;
  final int maxFileSizeMb;
  final List<String> allowedExtensions;
  final bool isActive;
  final int sortOrder;
  final List<ProductSpecDefinition> specs;

  bool get isBrowseGroup => !isOrderable;

  factory ProductCategory.fromJson(Map<String, dynamic> json) {
    final rawSpecs = json['specs'];
    final parentRaw = json['parentId'] ?? json['parent_id'];
    return ProductCategory(
      id: _readInt(json['id'], 0),
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString(),
      mobileDescription:
          (json['mobileDescription'] ?? json['mobile_description'])?.toString(),
      audienceLabel:
          (json['audienceLabel'] ?? json['audience_label'])?.toString(),
      icon: json['icon']?.toString(),
      parentId: parentRaw == null ? null : _readInt(parentRaw, 0),
      catalogLevel: _readInt(
        json['catalogLevel'] ?? json['catalog_level'],
        1,
      ),
      isOrderable: _readBool(
        json['isOrderable'] ?? json['is_orderable'],
        true,
      ),
      fileProcessingType:
          (json['fileProcessingType'] ?? json['file_processing_type'])
              ?.toString() ??
          'generic_file',
      pricingModel:
          (json['pricingModel'] ?? json['pricing_model'])?.toString() ??
          'per_page_modifiers',
      baseRate: _readDouble(json['baseRate'] ?? json['base_rate'], 0),
      quantityUnit:
          (json['quantityUnit'] ?? json['quantity_unit'])?.toString() ?? 'copy',
      maxFileSizeMb: _readInt(
        json['maxFileSizeMb'] ?? json['max_file_size_mb'],
        50,
      ),
      allowedExtensions: _readStringList(
        json['allowedExtensions'] ?? json['allowed_extensions'],
      ),
      isActive: _readBool(json['isActive'] ?? json['is_active'], true),
      sortOrder: _readInt(json['sortOrder'] ?? json['sort_order'], 0),
      specs: rawSpecs is List
          ? rawSpecs
                .whereType<Map>()
                .map(
                  (entry) => ProductSpecDefinition.fromJson(
                    Map<String, dynamic>.from(entry),
                  ),
                )
                .toList()
          : const [],
    );
  }

  List<ProductSpecDefinition> get activeSpecs =>
      specs.where((spec) => spec.isActive).toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  List<ProductSpecDefinition> get visibleSpecs =>
      activeSpecs.where((spec) => !spec.isHidden).toList();

  ProductSpecDefinition? specByKey(String key) {
    for (final spec in specs) {
      if (spec.key == key) return spec;
    }
    return null;
  }

  Map<String, dynamic> defaultSpecValues({
    Map<String, dynamic> overrides = const {},
  }) {
    final values = <String, dynamic>{};
    for (final spec in activeSpecs) {
      values[spec.key] = spec.defaultSelection;
    }
    values.addAll(overrides);
    return values;
  }

  Map<String, String> displayValues(Map<String, dynamic> values) {
    final display = <String, String>{};
    for (final spec in activeSpecs) {
      final value = values[spec.key];
      display[spec.key] = spec.displayValue(value);
    }
    return display;
  }

  double estimatePrice(Map<String, dynamic> values, int quantity) {
    if (pricingModel == 'base_plus_material_estimate') {
      return _estimateBasePlusMaterial(values, quantity);
    }
    return _estimatePerPage(values, quantity);
  }

  double _estimatePerPage(Map<String, dynamic> values, int quantity) {
    final pageCount = _readDouble(
      values['page_count'],
      1,
    ).clamp(1, double.infinity).toDouble();
    var multiplier = 1.0;
    var fixedFees = 0.0;
    for (final spec in activeSpecs) {
      final option = spec.optionForValue(values[spec.key]);
      if (option == null) continue;
      if (spec.pricingRole == 'multiplier') multiplier *= option.multiplier;
      if (spec.pricingRole == 'fixed_fee') fixedFees += option.fixedFee;
    }
    return _roundMoney(
      (baseRate * pageCount * multiplier + fixedFees) * quantity,
    );
  }

  double _estimateBasePlusMaterial(Map<String, dynamic> values, int quantity) {
    var unitCost = 0.0;
    var estimate = 0.0;
    var fixedFees = 0.0;
    for (final spec in activeSpecs) {
      final option = spec.optionForValue(values[spec.key]);
      if (option == null) continue;
      if (spec.pricingRole == 'unit_cost') unitCost = option.unitCost;
      if (spec.pricingRole == 'estimated_quantity') {
        estimate = option.estimatedQuantity ?? estimate;
      }
      if (spec.pricingRole == 'fixed_fee') fixedFees += option.fixedFee;
    }
    return _roundMoney((baseRate + unitCost * estimate + fixedFees) * quantity);
  }
}

class ProductSpecDefinition {
  const ProductSpecDefinition({
    required this.id,
    required this.categoryId,
    required this.key,
    required this.label,
    this.helpText,
    required this.inputType,
    required this.valueType,
    this.isRequired = true,
    this.isActive = true,
    this.defaultValue,
    required this.pricingRole,
    this.unitLabel,
    this.placeholder,
    this.minValue,
    this.maxValue,
    this.stepValue,
    required this.sortOrder,
    this.metadata = const {},
    this.options = const [],
  });

  const ProductSpecDefinition.select({
    required int id,
    required int categoryId,
    required String key,
    required String label,
    String? helpText,
    String valueType = 'string',
    bool isRequired = true,
    bool isActive = true,
    String? defaultValue,
    required String pricingRole,
    String? unitLabel,
    required int sortOrder,
    List<ProductSpecOption> options = const [],
  }) : this(
         id: id,
         categoryId: categoryId,
         key: key,
         label: label,
         helpText: helpText,
         inputType: 'select',
         valueType: valueType,
         isRequired: isRequired,
         isActive: isActive,
         defaultValue: defaultValue,
         pricingRole: pricingRole,
         unitLabel: unitLabel,
         sortOrder: sortOrder,
         options: options,
       );

  final int id;
  final int categoryId;
  final String key;
  final String label;
  final String? helpText;
  final String inputType;
  final String valueType;
  final bool isRequired;
  final bool isActive;
  final String? defaultValue;
  final String pricingRole;
  final String? unitLabel;
  final String? placeholder;
  final double? minValue;
  final double? maxValue;
  final double? stepValue;
  final int sortOrder;
  final Map<String, dynamic> metadata;
  final List<ProductSpecOption> options;

  factory ProductSpecDefinition.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    return ProductSpecDefinition(
      id: _readInt(json['id'], 0),
      categoryId: _readInt(json['categoryId'] ?? json['category_id'], 0),
      key: json['key']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      helpText: (json['helpText'] ?? json['help_text'])?.toString(),
      inputType:
          (json['inputType'] ?? json['input_type'])?.toString() ?? 'select',
      valueType:
          (json['valueType'] ?? json['value_type'])?.toString() ?? 'string',
      isRequired: _readBool(json['isRequired'] ?? json['is_required'], true),
      isActive: _readBool(json['isActive'] ?? json['is_active'], true),
      defaultValue: (json['defaultValue'] ?? json['default_value'])?.toString(),
      pricingRole:
          (json['pricingRole'] ?? json['pricing_role'])?.toString() ?? 'none',
      unitLabel: (json['unitLabel'] ?? json['unit_label'])?.toString(),
      placeholder: json['placeholder']?.toString(),
      minValue: _readNullableDouble(json['minValue'] ?? json['min_value']),
      maxValue: _readNullableDouble(json['maxValue'] ?? json['max_value']),
      stepValue: _readNullableDouble(json['stepValue'] ?? json['step_value']),
      sortOrder: _readInt(json['sortOrder'] ?? json['sort_order'], 0),
      metadata: _readMap(json['metadata']),
      options: rawOptions is List
          ? rawOptions
                .whereType<Map>()
                .map(
                  (entry) => ProductSpecOption.fromJson(
                    Map<String, dynamic>.from(entry),
                  ),
                )
                .where((option) => option.isActive)
                .toList()
          : const [],
    );
  }

  bool get isHidden => metadata['hidden'] == true;

  dynamic get defaultSelection {
    if (inputType == 'select') {
      final defaultOption = options
          .where((option) => option.isDefault)
          .firstOrNull;
      return defaultOption?.value ??
          options.firstOrNull?.value ??
          defaultValue ??
          '';
    }
    if (valueType == 'number') {
      return _readDouble(defaultValue, minValue ?? 0);
    }
    if (valueType == 'boolean') {
      return _readBool(defaultValue, false);
    }
    return defaultValue ?? '';
  }

  ProductSpecOption? optionForValue(dynamic value) {
    final normalized = value?.toString();
    if (normalized == null) return null;
    for (final option in options) {
      if (option.value == normalized) return option;
    }
    return null;
  }

  String displayValue(dynamic value) {
    final option = optionForValue(value);
    if (option != null) return option.label;
    if (value == null || value.toString().isEmpty) return '';
    if (unitLabel != null && unitLabel!.isNotEmpty && valueType == 'number') {
      return '${value.toString()}$unitLabel';
    }
    return value.toString();
  }
}

class ProductSpecOption {
  const ProductSpecOption({
    this.id,
    this.specDefinitionId,
    required this.label,
    required this.value,
    this.multiplier = 1,
    this.fixedFee = 0,
    this.unitCost = 0,
    this.estimatedQuantity,
    this.isDefault = false,
    this.isActive = true,
    this.sortOrder = 0,
  });

  final int? id;
  final int? specDefinitionId;
  final String label;
  final String value;
  final double multiplier;
  final double fixedFee;
  final double unitCost;
  final double? estimatedQuantity;
  final bool isDefault;
  final bool isActive;
  final int sortOrder;

  factory ProductSpecOption.fromJson(Map<String, dynamic> json) {
    return ProductSpecOption(
      id: _readNullableInt(json['id']),
      specDefinitionId: _readNullableInt(
        json['specDefinitionId'] ?? json['spec_definition_id'],
      ),
      label: json['label']?.toString() ?? '',
      value: json['value']?.toString() ?? '',
      multiplier: _readDouble(json['multiplier'], 1),
      fixedFee: _readDouble(json['fixedFee'] ?? json['fixed_fee'], 0),
      unitCost: _readDouble(json['unitCost'] ?? json['unit_cost'], 0),
      estimatedQuantity: _readNullableDouble(
        json['estimatedQuantity'] ?? json['estimated_quantity'],
      ),
      isDefault: _readBool(json['isDefault'] ?? json['is_default'], false),
      isActive: _readBool(json['isActive'] ?? json['is_active'], true),
      sortOrder: _readInt(json['sortOrder'] ?? json['sort_order'], 0),
    );
  }
}

extension IterableFirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

int _readInt(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? _readNullableInt(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? _readNullableDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

bool _readBool(dynamic value, bool fallback) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

List<String> _readStringList(dynamic value) {
  if (value is List) return value.map((entry) => entry.toString()).toList();
  return const [];
}

Map<String, dynamic> _readMap(dynamic value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

double _roundMoney(double value) => (value * 100).roundToDouble() / 100;
