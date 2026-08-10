class ProductCatalog {
  const ProductCatalog({
    this.version = '1.10',
    this.groups = const [],
    required this.categories,
  });

  final String version;
  final List<ProductGroup> groups;
  final List<ProductCategory> categories;

  factory ProductCatalog.fromJson(Map<String, dynamic> json) {
    final rawCategories = json['categories'];
    final categories = rawCategories is List
        ? rawCategories
              .whereType<Map>()
              .map(
                (entry) =>
                    ProductCategory.fromJson(Map<String, dynamic>.from(entry)),
              )
              .toList()
        : <ProductCategory>[];
    final rawGroups = json['groups'];
    var groups = rawGroups is List
        ? rawGroups
              .whereType<Map>()
              .map(
                (entry) =>
                    ProductGroup.fromJson(Map<String, dynamic>.from(entry)),
              )
              .toList()
        : <ProductGroup>[];

    if (groups.isEmpty) {
      groups = _groupsFromFlatCategories(categories);
    }
    final groupedProducts = groups.expand((group) => group.products);
    final knownSlugs = categories.map((category) => category.slug).toSet();
    categories.addAll(
      groupedProducts.where((product) => knownSlugs.add(product.slug)),
    );

    final catalog = ProductCatalog(
      version: json['version']?.toString() ?? '',
      groups: groups,
      categories: categories,
    );
    if (catalog.activeGroups.isEmpty) {
      throw const FormatException(
        'Catalog response contains no active orderable groups',
      );
    }
    return catalog;
  }

  /// Exact v1.10 browse snapshot. It is never submission authority.
  factory ProductCatalog.v110Snapshot() =>
      ProductCatalog.fromJson(_v110SnapshotJson());

  factory ProductCatalog.fallback() => ProductCatalog.v110Snapshot();

  /// Historical Paper/3D definitions retained only for saved draft routes.
  factory ProductCatalog.legacyFallback() => const ProductCatalog(
    version: 'legacy',
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
        ..sort(_compareProductOrder);

  List<ProductGroup> get activeGroups {
    final active = groups
        .map((group) => group.withActiveProducts())
        .where((group) => group.products.isNotEmpty)
        .toList();
    active.sort(
      (left, right) => left.sortOrder.compareTo(right.sortOrder) != 0
          ? left.sortOrder.compareTo(right.sortOrder)
          : left.slug.compareTo(right.slug),
    );
    return active;
  }

  ProductGroup? groupBySlug(String? slug) {
    if (slug == null) return null;
    for (final group in activeGroups) {
      if (group.slug == slug) return group;
    }
    return null;
  }

  ProductCategory? productBySlug(String? slug) {
    if (slug == null) return null;
    for (final group in activeGroups) {
      for (final product in group.products) {
        if (product.slug == slug) return product;
      }
    }
    return null;
  }

  ProductCategory? categoryBySlug(String? slug) {
    if (slug == null) return null;
    for (final category in categories) {
      if (category.slug == slug) return category;
    }
    return null;
  }
}

class ProductGroup {
  const ProductGroup({
    required this.slug,
    required this.name,
    required this.description,
    required this.sortOrder,
    required this.products,
  });

  final String slug;
  final String name;
  final String description;
  final int sortOrder;
  final List<ProductCategory> products;

  factory ProductGroup.fromJson(Map<String, dynamic> json) {
    final slug = (json['slug'] ?? json['group_slug'])?.toString() ?? '';
    final name = (json['name'] ?? json['group_name'])?.toString() ?? '';
    final description =
        (json['description'] ?? json['group_description'])?.toString() ?? '';
    final sortOrder = _readInt(
      json['sortOrder'] ?? json['sort_order'] ?? json['group_sort_order'],
      0,
    );
    final rawProducts = json['products'];
    final products = rawProducts is List
        ? rawProducts
              .whereType<Map>()
              .map(
                (entry) => ProductCategory.fromJson(
                  Map<String, dynamic>.from(entry),
                  groupSlug: slug,
                  groupName: name,
                  groupDescription: description,
                  groupSortOrder: sortOrder,
                ),
              )
              .toList()
        : <ProductCategory>[];
    products.sort(_compareProductOrder);
    return ProductGroup(
      slug: slug,
      name: name,
      description: description,
      sortOrder: sortOrder,
      products: products,
    );
  }

  ProductGroup withActiveProducts() => ProductGroup(
    slug: slug,
    name: name,
    description: description,
    sortOrder: sortOrder,
    products: products.where((product) => product.isActive).toList(),
  );
}

List<ProductGroup> _groupsFromFlatCategories(List<ProductCategory> categories) {
  final grouped = <String, List<ProductCategory>>{};
  for (final category in categories) {
    final slug = category.groupSlug;
    if (slug == null || slug.isEmpty) continue;
    grouped.putIfAbsent(slug, () => []).add(category);
  }
  return grouped.entries.map((entry) {
    final products = entry.value.toList()..sort(_compareProductOrder);
    final first = products.first;
    return ProductGroup(
      slug: entry.key,
      name: first.groupName ?? '',
      description: first.groupDescription ?? '',
      sortOrder: first.groupSortOrder ?? 0,
      products: products,
    );
  }).toList();
}

int _compareProductOrder(ProductCategory left, ProductCategory right) {
  final bySortOrder = left.sortOrder.compareTo(right.sortOrder);
  if (bySortOrder != 0) return bySortOrder;
  final byId = left.id.compareTo(right.id);
  if (byId != 0) return byId;
  return left.slug.compareTo(right.slug);
}

const _generalArtworkExtensions = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'tif',
  'tiff',
  'ai',
  'psd',
];

Map<String, dynamic> _v110SnapshotJson() => {
  'version': '1.10',
  'groups': [
    {
      'slug': 'marketing-promo',
      'name': 'Marketing & Promotional Collateral',
      'description':
          'Best for businesses, startups, and events looking to promote services or distribute physical marketing material.',
      'sortOrder': 1,
      'products': [
        _snapshotProduct(
          id: 1,
          slug: 'flyers',
          name: 'Flyers',
          description:
              'Single sheets, event promos, and product announcements.',
          examples: const [
            'Single sheets',
            'Event promos',
            'Product announcements',
          ],
          sortOrder: 1,
          fileProcessingType: 'document',
          quantityUnit: 'copy',
          specs: _printCollateralSpecs(),
        ),
        _snapshotProduct(
          id: 2,
          slug: 'brochures',
          name: 'Brochures',
          description: 'Bi-fold, tri-fold, and company profile brochures.',
          examples: const ['Bi-fold', 'Tri-fold', 'Company profiles'],
          sortOrder: 2,
          fileProcessingType: 'document',
          quantityUnit: 'copy',
          specs: _printCollateralSpecs(),
        ),
        _snapshotProduct(
          id: 3,
          slug: 'posters-standees',
          name: 'Posters & Standees',
          description: 'Indoor event posters, pull-up banners, and x-stands.',
          examples: const [
            'Indoor event posters',
            'Pull-up banners',
            'X-stands',
          ],
          sortOrder: 3,
          fileProcessingType: 'document',
          quantityUnit: 'piece',
          specs: _printCollateralSpecs(),
        ),
        _snapshotProduct(
          id: 4,
          slug: 'business-cards',
          name: 'Business Cards',
          description:
              'Standard, matte, glossy, textured, and QR-code-enabled business cards.',
          examples: const [
            'Standard',
            'Matte',
            'Glossy',
            'Textured',
            'QR-code enabled',
          ],
          sortOrder: 4,
          fileProcessingType: 'document',
          quantityUnit: 'card',
          specs: _printCollateralSpecs(),
        ),
        _snapshotProduct(
          id: 5,
          slug: 'stickers-packaging-labels',
          name: 'Stickers & Packaging Labels',
          description:
              'Die-cut product labels, vinyl stickers, and sheet stickers.',
          examples: const [
            'Die-cut product labels',
            'Vinyl stickers',
            'Sheet stickers',
          ],
          sortOrder: 5,
          fileProcessingType: 'document',
          quantityUnit: 'piece',
          specs: _printCollateralSpecs(),
        ),
        _snapshotProduct(
          id: 6,
          slug: 'tarpaulins-outdoor-banners',
          name: 'Tarpaulins & Outdoor Banners',
          description:
              'Event banners, billboards, and temporary roadside signs.',
          examples: const [
            'Event banners',
            'Billboards',
            'Temporary roadside signs',
          ],
          sortOrder: 6,
          fileProcessingType: 'document',
          quantityUnit: 'piece',
          specs: _printCollateralSpecs(),
        ),
      ],
    },
    {
      'slug': 'corporate-merch',
      'name': 'Corporate & Event Merchandise',
      'description':
          'Best for student organizations, HR teams, event organizers, and corporate branding.',
      'sortOrder': 2,
      'products': [
        _snapshotProduct(
          id: 7,
          slug: 'lanyards-id-accessories',
          name: 'Lanyards & ID Accessories',
          description:
              'Sublimation lanyards, custom ID laces, and badge holders.',
          examples: const [
            'Sublimation lanyards',
            'Custom ID laces',
            'Badge holders',
          ],
          sortOrder: 1,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _merchandiseSpecs(),
        ),
        _snapshotProduct(
          id: 8,
          slug: 'custom-apparel',
          name: 'Custom Apparel',
          description: 'T-shirts, hoodies, polo shirts, and tote bags.',
          examples: const ['T-shirts', 'Hoodies', 'Polo shirts', 'Tote bags'],
          sortOrder: 2,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _merchandiseSpecs(),
        ),
        _snapshotProduct(
          id: 9,
          slug: 'drinkware',
          name: 'Drinkware',
          description:
              'Sublimation mugs, laser-engraved tumblers, and water bottles.',
          examples: const [
            'Sublimation mugs',
            'Laser-engraved tumblers',
            'Water bottles',
          ],
          sortOrder: 3,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _merchandiseSpecs(),
        ),
        _snapshotProduct(
          id: 10,
          slug: 'corporate-giveaways',
          name: 'Corporate Giveaways',
          description:
              'Eco-bags, umbrellas, customized pens, keychains, and notebooks.',
          examples: const [
            'Eco-bags',
            'Umbrellas',
            'Customized pens',
            'Keychains',
            'Notebooks',
          ],
          sortOrder: 4,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _merchandiseSpecs(),
        ),
      ],
    },
    {
      'slug': 'awards-signages',
      'name': 'Recognition, Awards & Signage',
      'description':
          'Best for competitions, graduations, guest speakers, store branding, and office spaces.',
      'sortOrder': 3,
      'products': [
        _snapshotProduct(
          id: 11,
          slug: 'certificates-diplomas',
          name: 'Certificates & Diplomas',
          description:
              'Specialty-paper, foil-stamped, and embossed certificates and diplomas.',
          examples: const ['Specialty paper', 'Foil-stamped', 'Embossed'],
          sortOrder: 1,
          fileProcessingType: 'generic_file',
          quantityUnit: 'copy',
          specs: _awardsAndSignageSpecs(),
        ),
        _snapshotProduct(
          id: 12,
          slug: 'plaques-trophies',
          name: 'Plaques & Trophies',
          description:
              'Custom acrylic cuts, wooden plaques, and 3D-printed awards.',
          examples: const [
            'Custom acrylic cuts',
            'Wooden plaques',
            '3D-printed awards',
          ],
          sortOrder: 2,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _awardsAndSignageSpecs(),
        ),
        _snapshotProduct(
          id: 13,
          slug: 'medals-ribbons',
          name: 'Medals & Ribbons',
          description:
              'Metal or acrylic medals with custom sublimation ribbons.',
          examples: const [
            'Metal medals',
            'Acrylic medals',
            'Custom sublimation ribbons',
          ],
          sortOrder: 3,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _awardsAndSignageSpecs(),
        ),
        _snapshotProduct(
          id: 14,
          slug: 'business-store-signages',
          name: 'Business & Store Signages',
          description:
              'Acrylic build-up letters, Panaflex lightboxes, and LED neon flex.',
          examples: const [
            'Acrylic build-up letters',
            'Panaflex lightboxes',
            'LED neon flex',
          ],
          sortOrder: 4,
          fileProcessingType: 'generic_file',
          quantityUnit: 'piece',
          specs: _awardsAndSignageSpecs(),
        ),
      ],
    },
    {
      'slug': 'specialized-prototyping',
      'name': 'Specialized & Prototyping Services',
      'description':
          'Best for architecture students, engineers, industrial designers, and specialized builds.',
      'sortOrder': 4,
      'products': [
        _snapshotProduct(
          id: 15,
          slug: '3d-printing-scale-models',
          name: '3D Printing & Scale Models',
          description:
              'Rapid prototyping, architectural scale models, and custom parts.',
          examples: const [
            'Rapid prototyping',
            'Architectural scale models',
            'Custom parts',
          ],
          sortOrder: 1,
          fileProcessingType: 'model_3d',
          quantityUnit: 'model',
          maxFileSizeMb: 200,
          allowedExtensions: const ['stl', 'obj', '3mf'],
          specs: _fabrication3dSpecs(),
        ),
        _snapshotProduct(
          id: 16,
          slug: 'blueprint-cad-plotting',
          name: 'Blueprint & CAD Plotting',
          description: 'Large-format architectural and engineering plans.',
          examples: const [
            'Large-format architectural plans',
            'Engineering plans',
          ],
          sortOrder: 2,
          fileProcessingType: 'document',
          quantityUnit: 'copy',
          allowedExtensions: const ['pdf', 'dwg', 'dxf'],
          specs: _cadPlottingSpecs(),
        ),
        _snapshotProduct(
          id: 17,
          slug: 'packaging-box-production',
          name: 'Packaging & Box Production',
          description:
              'Custom product boxes, mailer boxes, and food-grade packaging.',
          examples: const [
            'Custom product boxes',
            'Mailer boxes',
            'Food-grade packaging',
          ],
          sortOrder: 3,
          fileProcessingType: 'generic_file',
          quantityUnit: 'box',
          specs: _packagingSpecs(),
        ),
      ],
    },
  ],
};

Map<String, dynamic> _snapshotProduct({
  required int id,
  required String slug,
  required String name,
  required String description,
  required List<String> examples,
  required int sortOrder,
  required String fileProcessingType,
  required String quantityUnit,
  required List<Map<String, dynamic>> specs,
  int maxFileSizeMb = 100,
  List<String> allowedExtensions = _generalArtworkExtensions,
}) => {
  'id': id,
  'slug': slug,
  'name': name,
  'description': description,
  'mobileDescription': description,
  'examples': examples,
  'sortOrder': sortOrder,
  'fileProcessingType': fileProcessingType,
  'pricingModel': 'quote_required',
  'pricingStatus': 'pending_quote',
  'baseRate': null,
  'quantityUnit': quantityUnit,
  'maxFileSizeMb': maxFileSizeMb,
  'allowedExtensions': allowedExtensions,
  'isActive': true,
  'specs': specs,
};

Map<String, dynamic> _requiredText(
  String key,
  String label,
  int sortOrder,
  String placeholder, {
  bool isRequired = true,
}) => {
  'id': 0,
  'categoryId': 0,
  'key': key,
  'label': label,
  'helpText': null,
  'inputType': 'text',
  'valueType': 'string',
  'isRequired': isRequired,
  'isActive': true,
  'pricingRole': 'none',
  'placeholder': placeholder,
  'sortOrder': sortOrder,
  'options': const [],
};

List<Map<String, dynamic>> _printCollateralSpecs() => [
  _requiredText(
    'dimensions_or_standard_size',
    'Dimensions or standard size',
    10,
    'Enter dimensions or a standard size',
  ),
  _requiredText(
    'stock_or_material',
    'Stock or material',
    20,
    'Describe the requested stock or material',
  ),
  _requiredText('color', 'Color', 30, 'Describe the requested color'),
  {
    'id': 0,
    'categoryId': 0,
    'key': 'sides',
    'label': 'Sides',
    'helpText': 'Enter 1 for single-sided or 2 for double-sided printing.',
    'inputType': 'number',
    'valueType': 'number',
    'isRequired': true,
    'isActive': true,
    'pricingRole': 'none',
    'minValue': 1,
    'maxValue': 2,
    'stepValue': 1,
    'sortOrder': 40,
    'options': const [],
  },
  _requiredText('finish', 'Finish', 50, 'Describe the requested finish'),
];

List<Map<String, dynamic>> _merchandiseSpecs() => [
  _requiredText(
    'item_subtype',
    'Item subtype',
    10,
    'Describe the item subtype',
  ),
  _requiredText(
    'variant_or_size',
    'Variant or size',
    20,
    'Enter the requested variant or size',
  ),
  _requiredText('color', 'Color', 30, 'Describe the requested color'),
  _requiredText(
    'branding_method',
    'Branding method',
    40,
    'Describe the requested branding method',
  ),
  _requiredText(
    'artwork_placement',
    'Artwork placement',
    50,
    'Describe where the artwork should appear',
  ),
];

List<Map<String, dynamic>> _awardsAndSignageSpecs() => [
  _requiredText(
    'dimensions',
    'Dimensions',
    10,
    'Enter the required dimensions',
  ),
  _requiredText('material', 'Material', 20, 'Describe the requested material'),
  _requiredText('finish', 'Finish', 30, 'Describe the requested finish'),
  _requiredText(
    'personalization_text',
    'Personalization text',
    40,
    'Enter names, titles, dates, or other personalization',
  ),
  _requiredText(
    'mounting_or_lighting',
    'Mounting or lighting',
    50,
    'Describe mounting or lighting needs, if applicable',
    isRequired: false,
  ),
];

List<Map<String, dynamic>> _fabrication3dSpecs() => [
  _requiredText(
    'dimensions_or_scale',
    'Dimensions or scale',
    10,
    'Enter finished dimensions or scale',
  ),
  _requiredText('material', 'Material', 20, 'Describe the requested material'),
  _requiredText('color', 'Color', 30, 'Describe the requested color'),
  _requiredText(
    'layer_or_infill_preference',
    'Layer or infill preference',
    40,
    'Describe layer height or infill preferences',
  ),
];

List<Map<String, dynamic>> _cadPlottingSpecs() => [
  _requiredText(
    'sheet_size',
    'Sheet size',
    10,
    'Enter the required sheet size',
  ),
  _requiredText(
    'drawing_scale',
    'Drawing scale',
    20,
    'Enter the drawing scale',
  ),
  _requiredText(
    'color_mode',
    'Color mode',
    30,
    'Describe the required color mode',
  ),
  _requiredText(
    'folding_or_binding',
    'Folding or binding',
    40,
    'Describe folding or binding requirements',
  ),
];

List<Map<String, dynamic>> _packagingSpecs() => [
  _requiredText(
    'box_style',
    'Box style',
    10,
    'Describe the requested box style',
  ),
  _requiredText(
    'internal_dimensions',
    'Internal dimensions',
    20,
    'Enter the internal length, width, and height',
  ),
  _requiredText('material', 'Material', 30, 'Describe the requested material'),
  _requiredText('finish', 'Finish', 40, 'Describe the requested finish'),
  {
    'id': 0,
    'categoryId': 0,
    'key': 'food_grade_requirement',
    'label': 'Food-grade requirement',
    'helpText': 'Indicate whether food-grade packaging is required.',
    'inputType': 'boolean',
    'valueType': 'boolean',
    'isRequired': true,
    'isActive': true,
    'pricingRole': 'none',
    'sortOrder': 50,
    'options': const [],
  },
];

class ProductCategory {
  const ProductCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.mobileDescription,
    this.icon,
    this.examples = const [],
    this.groupSlug,
    this.groupName,
    this.groupDescription,
    this.groupSortOrder,
    this.pricingStatus,
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
  final String? icon;
  final List<String> examples;
  final String? groupSlug;
  final String? groupName;
  final String? groupDescription;
  final int? groupSortOrder;
  final String? pricingStatus;
  final String fileProcessingType;
  final String pricingModel;
  final double? baseRate;
  final String quantityUnit;
  final int maxFileSizeMb;
  final List<String> allowedExtensions;
  final bool isActive;
  final int sortOrder;
  final List<ProductSpecDefinition> specs;

  factory ProductCategory.fromJson(
    Map<String, dynamic> json, {
    String? groupSlug,
    String? groupName,
    String? groupDescription,
    int? groupSortOrder,
  }) {
    final rawSpecs = json['specs'];
    return ProductCategory(
      id: _readInt(json['id'], 0),
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString(),
      mobileDescription:
          (json['mobileDescription'] ?? json['mobile_description'])?.toString(),
      icon: json['icon']?.toString(),
      examples: _readStringList(json['examples']),
      groupSlug:
          (json['groupSlug'] ?? json['group_slug'])?.toString() ?? groupSlug,
      groupName:
          (json['groupName'] ?? json['group_name'])?.toString() ?? groupName,
      groupDescription:
          (json['groupDescription'] ?? json['group_description'])?.toString() ??
          groupDescription,
      groupSortOrder:
          _readNullableInt(
            json['groupSortOrder'] ?? json['group_sort_order'],
          ) ??
          groupSortOrder,
      pricingStatus: (json['pricingStatus'] ?? json['pricing_status'])
          ?.toString(),
      fileProcessingType:
          (json['fileProcessingType'] ?? json['file_processing_type'])
              ?.toString() ??
          'generic_file',
      pricingModel:
          (json['pricingModel'] ?? json['pricing_model'])?.toString() ??
          'per_page_modifiers',
      baseRate: _readNullableDouble(json['baseRate'] ?? json['base_rate']),
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
    if (pricingModel == 'quote_required') {
      throw StateError('RFQ products do not have a client-estimated price');
    }
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
      ((baseRate ?? 0) * pageCount * multiplier + fixedFees) * quantity,
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
    return _roundMoney(
      ((baseRate ?? 0) + unitCost * estimate + fixedFees) * quantity,
    );
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
