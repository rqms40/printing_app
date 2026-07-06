import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/catalog_spec_mappers.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  group('threeDSpecsFromCatalogValues', () {
    test('parses GLB and GLTF file format values from the product catalog', () {
      expect(
        threeDSpecsFromCatalogValues({'file_format': 'glb'}).fileFormat,
        FileFormat3D.glb,
      );
      expect(
        threeDSpecsFromCatalogValues({'file_format': 'gltf'}).fileFormat,
        FileFormat3D.gltf,
      );
    });
  });
}
