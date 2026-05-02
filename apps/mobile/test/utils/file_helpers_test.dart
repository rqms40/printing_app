import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/utils/file_helpers.dart';

void main() {
  group('mimeTypeForExtension', () {
    test('maps 3D printing extensions to explicit model MIME types', () {
      expect(mimeTypeForExtension('stl'), 'model/stl');
      expect(mimeTypeForExtension('obj'), 'model/obj');
      expect(mimeTypeForExtension('3mf'), 'model/3mf');
    });

    test('normalizes case and falls back to octet-stream', () {
      expect(mimeTypeForExtension('PDF'), 'application/pdf');
      expect(mimeTypeForExtension('unknown'), 'application/octet-stream');
    });

    test('maps TIFF paper-print extensions to image/tiff', () {
      expect(mimeTypeForExtension('tif'), 'image/tiff');
      expect(mimeTypeForExtension('tiff'), 'image/tiff');
    });
  });

  group('isValidFileType', () {
    test('allows TIFF paper-print extensions', () {
      expect(isValidFileType('poster.tif'), isTrue);
      expect(isValidFileType('scan.tiff'), isTrue);
    });
  });
}
