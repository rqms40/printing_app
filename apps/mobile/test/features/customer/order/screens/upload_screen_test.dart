import 'package:flutter_test/flutter_test.dart';
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
}
