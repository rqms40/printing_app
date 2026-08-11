import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/screens/upload_screen.dart';

void main() {
  group('isUploadedFileReady', () {
    test('requires a real positive file metadata id', () {
      expect(
        isUploadedFileReady(
          fileName: 'poster.pdf',
          fileMetadataId: null,
          isUploading: false,
          errorText: null,
        ),
        isFalse,
      );
      expect(
        isUploadedFileReady(
          fileName: 'poster.pdf',
          fileMetadataId: 0,
          isUploading: false,
          errorText: null,
        ),
        isFalse,
      );
      expect(
        isUploadedFileReady(
          fileName: 'poster.pdf',
          fileMetadataId: 42,
          isUploading: false,
          errorText: null,
        ),
        isTrue,
      );
    });

    test('rejects in-progress and failed uploads', () {
      expect(
        isUploadedFileReady(
          fileName: 'poster.pdf',
          fileMetadataId: 42,
          isUploading: true,
          errorText: null,
        ),
        isFalse,
      );
      expect(
        isUploadedFileReady(
          fileName: 'poster.pdf',
          fileMetadataId: 42,
          isUploading: false,
          errorText: 'Upload failed',
        ),
        isFalse,
      );
    });
  });

  test('catalog upload is product-bound and authority gated', () {
    expect(
      catalogUploadFields(
        productSlug: '3d-printing-scale-models',
        catalogServerBacked: true,
      ),
      {'purpose': 'catalog_artwork', 'productSlug': '3d-printing-scale-models'},
    );
    expect(
      catalogUploadFields(productSlug: 'flyers', catalogServerBacked: false),
      {'purpose': 'catalog_artwork', 'productSlug': 'flyers'},
    );
    expect(
      canContinueCatalogUpload(
        productSlug: 'flyers',
        catalogServerBacked: false,
        fileName: 'art.pdf',
        fileMetadataId: 4,
        isUploading: false,
        errorText: null,
      ),
      isFalse,
    );
  });

  test(
    'resolves exact catalog and saved-legacy upload policies fail closed',
    () {
      final catalog = ProductCatalog.v110Snapshot();
      final general = resolveUploadPolicy(
        category: 'flyers',
        productSlug: 'flyers',
        catalog: catalog,
      );
      expect(general?.allowedExtensions, [
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'tif',
        'tiff',
        'ai',
        'psd',
      ]);
      expect(general?.maxSizeMb, 100);

      final model = resolveUploadPolicy(
        category: '3d-printing-scale-models',
        productSlug: '3d-printing-scale-models',
        catalog: catalog,
      );
      expect(model?.allowedExtensions, ['stl', 'obj', '3mf']);
      expect(model?.maxSizeMb, 200);

      final cad = resolveUploadPolicy(
        category: 'blueprint-cad-plotting',
        productSlug: 'blueprint-cad-plotting',
        catalog: catalog,
      );
      expect(cad?.allowedExtensions, ['pdf', 'dwg', 'dxf']);
      expect(cad?.maxSizeMb, 100);

      expect(
        resolveUploadPolicy(
          category: 'removed-product',
          productSlug: 'removed-product',
          catalog: catalog,
        ),
        isNull,
      );
      expect(
        resolveUploadPolicy(
          category: 'removed-product',
          productSlug: null,
          catalog: catalog,
        ),
        isNull,
      );
      expect(
        resolveUploadPolicy(
          category: '3d',
          productSlug: null,
          catalog: catalog,
        )?.maxSizeMb,
        200,
      );
    },
  );

  test('failed upload retains local selection and clears remote metadata', () {
    final bytes = Uint8List.fromList([1, 2, 3]);
    final retained = retainUploadSelectionAfterFailure(
      fileName: 'art.pdf',
      filePath: '/tmp/art.pdf',
      fileBytes: bytes,
      mimeType: 'application/pdf',
      fileSize: 3,
    );
    expect(retained.fileName, 'art.pdf');
    expect(retained.filePath, '/tmp/art.pdf');
    expect(retained.fileBytes, same(bytes));
    expect(retained.mimeType, 'application/pdf');
    expect(retained.fileSize, 3);
    expect(retained.fileMetadataId, isNull);
  });
}
