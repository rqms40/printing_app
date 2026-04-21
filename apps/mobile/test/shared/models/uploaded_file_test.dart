import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';

void main() {
  group('UploadedFile.fromJson', () {
    test('parses expiresAt when present', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
        'expiresAt': '2026-04-28T02:00:00.000Z',
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNotNull);
      expect(file.expiresAt!.day, 28);
    });

    test('parses null expiresAt', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
        'expiresAt': null,
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNull);
    });

    test('parses missing expiresAt key as null', () {
      final json = {
        'id': 1,
        'originalName': 'test.pdf',
        'mimeType': 'application/pdf',
        'size': 1024,
        'createdAt': '2026-04-21T00:00:00.000Z',
      };
      final file = UploadedFile.fromJson(json);
      expect(file.expiresAt, isNull);
    });
  });
}
