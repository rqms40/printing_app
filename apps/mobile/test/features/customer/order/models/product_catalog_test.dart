import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';

void main() {
  test('server-null spec defaults remain unset for every input type', () {
    const definitions = [
      ProductSpecDefinition.select(
        id: 1,
        categoryId: 1,
        key: 'stock',
        label: 'Stock',
        pricingRole: 'none',
        sortOrder: 1,
        options: [
          ProductSpecOption(label: 'Single-sided', value: 'single'),
          ProductSpecOption(label: 'Double-sided', value: 'double'),
        ],
      ),
      ProductSpecDefinition(
        id: 2,
        categoryId: 1,
        key: 'copies',
        label: 'Copies',
        inputType: 'number',
        valueType: 'number',
        pricingRole: 'none',
        minValue: 1,
        sortOrder: 2,
      ),
      ProductSpecDefinition(
        id: 3,
        categoryId: 1,
        key: 'food_grade_requirement',
        label: 'Food-grade requirement',
        inputType: 'boolean',
        valueType: 'boolean',
        pricingRole: 'none',
        sortOrder: 3,
      ),
      ProductSpecDefinition(
        id: 4,
        categoryId: 1,
        key: 'finish',
        label: 'Finish',
        inputType: 'text',
        valueType: 'string',
        pricingRole: 'none',
        sortOrder: 4,
      ),
    ];
    const product = ProductCategory(
      id: 1,
      name: 'Packaging',
      slug: 'packaging',
      fileProcessingType: 'generic_file',
      pricingModel: 'quote_required',
      baseRate: null,
      quantityUnit: 'piece',
      maxFileSizeMb: 100,
      allowedExtensions: ['pdf'],
      isActive: true,
      sortOrder: 1,
      specs: definitions,
    );

    expect(product.defaultSpecValues(), {
      'stock': null,
      'copies': null,
      'food_grade_requirement': null,
      'finish': null,
    });

    final snapshot = ProductCatalog.v110Snapshot();
    final snapshotSpecs = snapshot.categories.expand((item) => item.specs);
    final sides = snapshotSpecs.firstWhere((spec) => spec.key == 'sides');
    final foodGrade = snapshotSpecs.firstWhere(
      (spec) => spec.key == 'food_grade_requirement',
    );
    expect(sides.inputType, 'number');
    expect(sides.defaultSelection, isNull);
    expect(foodGrade.inputType, 'boolean');
    expect(foodGrade.defaultSelection, isNull);
  });
  group('ProductCatalog.fromJson', () {
    test('parses grouped camelCase data in stable active order', () {
      final catalog = ProductCatalog.fromJson({
        'version': '1.10',
        'groups': [
          {
            'slug': 'second',
            'name': 'Second',
            'description': 'Second group',
            'sortOrder': 2,
            'products': [
              _product(id: 3, slug: 'last', sortOrder: 2),
              _product(id: 2, slug: 'first', sortOrder: 1),
            ],
          },
          {
            'slug': 'first',
            'name': 'First',
            'description': 'First group',
            'sortOrder': 1,
            'products': [
              _product(id: 1, slug: 'hidden', isActive: false),
              _product(id: 4, slug: 'visible'),
            ],
          },
        ],
      });

      expect(catalog.version, '1.10');
      expect(catalog.activeGroups.map((group) => group.slug), [
        'first',
        'second',
      ]);
      expect(catalog.groupBySlug('first')?.products.single.slug, 'visible');
      expect(catalog.groupBySlug('second')?.products.map((item) => item.slug), [
        'first',
        'last',
      ]);
      expect(catalog.productBySlug('hidden'), isNull);
      expect(catalog.productBySlug('first')?.examples, ['Example one']);
    });

    test('parses snake_case flat compatibility data into groups', () {
      final catalog = ProductCatalog.fromJson({
        'version': '1.10',
        'categories': [
          _product(
            id: 20,
            slug: 'legacy-paper',
            groupSlug: null,
            isActive: false,
          ),
          {
            'id': 21,
            'name': 'leaf',
            'slug': 'leaf',
            'description': 'leaf description',
            'examples': ['Example one'],
            'group_slug': 'snake-group',
            'group_name': 'Snake Group',
            'group_description': 'Snake description',
            'group_sort_order': 4,
            'mobile_description': 'Mobile copy',
            'file_processing_type': 'generic_file',
            'pricing_model': 'quote_required',
            'pricing_status': 'pending_quote',
            'base_rate': null,
            'quantity_unit': 'piece',
            'max_file_size_mb': 100,
            'allowed_extensions': ['pdf', 'png'],
            'is_active': true,
            'sort_order': 2,
            'specs': const [],
          },
        ],
      });

      final product = catalog.productBySlug('leaf')!;
      expect(catalog.activeGroups.single.name, 'Snake Group');
      expect(catalog.activeGroups.single.description, 'Snake description');
      expect(product.groupSlug, 'snake-group');
      expect(product.mobileDescription, 'Mobile copy');
      expect(product.pricingModel, 'quote_required');
      expect(product.pricingStatus, 'pending_quote');
      expect(product.baseRate, isNull);
      expect(product.allowedExtensions, ['pdf', 'png']);
      expect(catalog.productBySlug('legacy-paper'), isNull);
    });

    test('sorts flat compatibility products by sort order then id', () {
      final catalog = ProductCatalog.fromJson({
        'version': '1.10',
        'categories': [
          _product(id: 30, slug: 'later', sortOrder: 2),
          _product(id: 20, slug: 'second-tie', sortOrder: 1),
          _product(id: 10, slug: 'first-tie', sortOrder: 1),
        ],
      });

      expect(catalog.activeGroups.single.products.map((item) => item.slug), [
        'first-tie',
        'second-tie',
        'later',
      ]);
    });

    test('rejects a malformed response with no orderable groups', () {
      expect(
        () => ProductCatalog.fromJson({'version': '1.10', 'groups': 'bad'}),
        throwsFormatException,
      );
    });
  });

  group('ProductCatalog.v110Snapshot', () {
    test(
      'matches the canonical four-group seventeen-product browse contract',
      () {
        final catalog = ProductCatalog.v110Snapshot();

        expect(catalog.version, '1.10');
        expect(catalog.activeGroups.map((group) => group.slug), [
          'marketing-promo',
          'corporate-merch',
          'awards-signages',
          'specialized-prototyping',
        ]);
        expect(catalog.activeGroups.map((group) => group.products.length), [
          6,
          4,
          4,
          3,
        ]);
        expect(
          catalog.activeGroups
              .expand((group) => group.products)
              .map((p) => p.slug),
          [
            'flyers',
            'brochures',
            'posters-standees',
            'business-cards',
            'stickers-packaging-labels',
            'tarpaulins-outdoor-banners',
            'lanyards-id-accessories',
            'custom-apparel',
            'drinkware',
            'corporate-giveaways',
            'certificates-diplomas',
            'plaques-trophies',
            'medals-ribbons',
            'business-store-signages',
            '3d-printing-scale-models',
            'blueprint-cad-plotting',
            'packaging-box-production',
          ],
        );
        expect(catalog.productBySlug('paper'), isNull);
        expect(catalog.productBySlug('3d'), isNull);
      },
    );

    test('preserves examples, specs, upload policy, and quote state', () {
      final catalog = ProductCatalog.v110Snapshot();
      final flyers = catalog.productBySlug('flyers')!;
      final models = catalog.productBySlug('3d-printing-scale-models')!;
      final cad = catalog.productBySlug('blueprint-cad-plotting')!;
      final packaging = catalog.productBySlug('packaging-box-production')!;

      expect(flyers.examples, [
        'Single sheets',
        'Event promos',
        'Product announcements',
      ]);
      expect(flyers.specs.map((spec) => spec.key), [
        'dimensions_or_standard_size',
        'stock_or_material',
        'color',
        'sides',
        'finish',
      ]);
      expect(flyers.pricingModel, 'quote_required');
      expect(flyers.pricingStatus, 'pending_quote');
      expect(flyers.baseRate, isNull);
      expect(() => flyers.estimatePrice(const {}, 1), throwsStateError);
      expect(flyers.maxFileSizeMb, 100);
      expect(flyers.allowedExtensions, [
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'tif',
        'tiff',
        'ai',
        'psd',
      ]);
      expect(models.maxFileSizeMb, 200);
      expect(models.allowedExtensions, ['stl', 'obj', '3mf']);
      expect(cad.allowedExtensions, ['pdf', 'dwg', 'dxf']);
      expect(
        packaging.specByKey('food_grade_requirement')?.valueType,
        'boolean',
      );
    });
  });
}

Map<String, dynamic> _product({
  required int id,
  required String slug,
  int sortOrder = 1,
  bool isActive = true,
  String? groupSlug = 'group',
}) {
  return {
    'id': id,
    'name': slug,
    'slug': slug,
    'description': '$slug description',
    'examples': ['Example one'],
    'groupSlug': ?groupSlug,
    if (groupSlug != null) 'groupName': 'Group',
    if (groupSlug != null) 'groupDescription': 'Group description',
    if (groupSlug != null) 'groupSortOrder': 1,
    'fileProcessingType': 'generic_file',
    'pricingModel': 'quote_required',
    'pricingStatus': 'pending_quote',
    'baseRate': null,
    'quantityUnit': 'piece',
    'maxFileSizeMb': 100,
    'allowedExtensions': ['pdf'],
    'isActive': isActive,
    'sortOrder': sortOrder,
    'specs': const [],
  };
}
