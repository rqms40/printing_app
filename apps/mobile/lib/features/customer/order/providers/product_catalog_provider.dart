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
    required this.isLoading,
    this.error,
  });

  final ProductCatalog catalog;
  final bool isServerBacked;
  final bool isLoading;
  final Object? error;

  bool get canSubmit => isServerBacked && !isLoading && error == null;
}

class ProductCatalogNotifier extends StateNotifier<ProductCatalogState> {
  ProductCatalogNotifier(this._loader)
    : super(
        ProductCatalogState(
          catalog: ProductCatalog.v110Snapshot(),
          isServerBacked: false,
          isLoading: false,
        ),
      ) {
    unawaited(_load());
  }

  final ProductCatalogLoader _loader;

  Future<void> retry() => _load();

  Future<void> _load() async {
    if (state.isLoading) return;
    state = ProductCatalogState(
      catalog: state.catalog,
      isServerBacked: state.isServerBacked,
      isLoading: true,
      error: state.error,
    );
    try {
      final catalog = ProductCatalog.fromJson(await _loader());
      if (!mounted) return;
      state = ProductCatalogState(
        catalog: catalog,
        isServerBacked: true,
        isLoading: false,
      );
    } catch (error) {
      if (!mounted) return;
      state = ProductCatalogState(
        catalog: ProductCatalog.v110Snapshot(),
        isServerBacked: false,
        isLoading: false,
        error: error,
      );
    }
  }
}

final productCatalogProvider =
    StateNotifierProvider<ProductCatalogNotifier, ProductCatalogState>((ref) {
      return ProductCatalogNotifier(ref.watch(productCatalogLoaderProvider));
    });
