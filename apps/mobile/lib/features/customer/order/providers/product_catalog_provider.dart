import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

typedef ProductCatalogLoader = Future<Map<String, dynamic>> Function();

final productCatalogLoaderProvider = Provider<ProductCatalogLoader>((ref) {
  final dio = ref.watch(dioProvider);
  return () async {
    final response = await dio.get('/products/catalog');
    final data = response.data;
    if (data is! Map) {
      throw const FormatException('Catalog response must be an object');
    }
    return Map<String, dynamic>.from(data);
  };
});

class ProductCatalogState {
  const ProductCatalogState({
    required this.catalog,
    required this.isServerBacked,
    this.error,
  });

  final ProductCatalog catalog;
  final bool isServerBacked;
  final Object? error;

  bool get canSubmit => isServerBacked && error == null;
}

class ProductCatalogNotifier extends StateNotifier<ProductCatalogState> {
  ProductCatalogNotifier(this._loader)
    : super(
        ProductCatalogState(
          catalog: ProductCatalog.v110Snapshot(),
          isServerBacked: false,
        ),
      ) {
    unawaited(_load());
  }

  final ProductCatalogLoader _loader;
  bool isLoading = false;

  Future<void> retry() => _load();

  Future<void> _load() async {
    if (isLoading) return;
    isLoading = true;
    try {
      final catalog = ProductCatalog.fromJson(await _loader());
      if (!mounted) return;
      isLoading = false;
      state = ProductCatalogState(catalog: catalog, isServerBacked: true);
    } catch (error) {
      if (!mounted) return;
      isLoading = false;
      state = ProductCatalogState(
        catalog: ProductCatalog.v110Snapshot(),
        isServerBacked: false,
        error: error,
      );
    } finally {
      isLoading = false;
    }
  }
}

final productCatalogProvider =
    StateNotifierProvider<ProductCatalogNotifier, ProductCatalogState>((ref) {
      return ProductCatalogNotifier(ref.watch(productCatalogLoaderProvider));
    });
