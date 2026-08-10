import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/supplier/providers/supplier_jobs_provider.dart';
import 'package:printing_app/utils/file_helpers.dart';

void main() {
  group('submitSelfQc evidence guard', () {
    test('rejects null/empty evidence without calling the server', () async {
      final notifier = SupplierJobDetailNotifier(1, bootstrap: false);

      final noFile = await notifier.submitSelfQc(notes: 'looks good');
      expect(noFile, isFalse);
      expect(
        notifier.state.errorMessage,
        'Self-QC evidence file is required',
      );

      final emptyBytes = await notifier.submitSelfQc(
        notes: 'notes only',
        fileBytes: Uint8List(0),
        fileName: 'proof.jpg',
      );
      expect(emptyBytes, isFalse);
      expect(
        notifier.state.errorMessage,
        'Self-QC evidence file is required',
      );

      final missingName = await notifier.submitSelfQc(
        fileBytes: Uint8List.fromList([1, 2, 3]),
        fileName: '  ',
      );
      expect(missingName, isFalse);
      expect(
        notifier.state.errorMessage,
        'Self-QC evidence file is required',
      );
    });

    test('self-QC mime types match upload helper for common evidence', () {
      expect(mimeTypeForExtension('jpg'), 'image/jpeg');
      expect(mimeTypeForExtension('jpeg'), 'image/jpeg');
      expect(mimeTypeForExtension('png'), 'image/png');
      expect(mimeTypeForExtension('webp'), 'image/webp');
      expect(mimeTypeForExtension('pdf'), 'application/pdf');
      expect(getFileExtension('proof.PNG'), 'PNG');
      expect(
        mimeTypeForExtension(getFileExtension('proof.PNG')),
        'image/png',
      );
    });
  });
}
