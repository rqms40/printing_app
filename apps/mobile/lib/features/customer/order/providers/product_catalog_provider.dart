import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

final productCatalogProvider = FutureProvider<ProductCatalog>((ref) async {
  try {
    final dio = ref.watch(dioProvider);
    final response = await dio.get('/products/catalog');
    final data = response.data;
    if (data is Map) {
      return ProductCatalog.fromJson(Map<String, dynamic>.from(data));
    }
  } catch (_) {
    // Fall back to the seeded catalog shape so tests and offline dev flows
    // still exercise the same dynamic rendering path.
  }
  return ProductCatalog.fallback();
});
