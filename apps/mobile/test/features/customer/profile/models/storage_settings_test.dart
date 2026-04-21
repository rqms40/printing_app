import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/storage_settings.dart';

void main() {
  group('StorageSettings.fromJson', () {
    test('parses fileRetentionDays when set', () {
      final s = StorageSettings.fromJson({'fileRetentionDays': 7});
      expect(s.fileRetentionDays, 7);
    });

    test('parses null fileRetentionDays', () {
      final s = StorageSettings.fromJson({'fileRetentionDays': null});
      expect(s.fileRetentionDays, isNull);
    });
  });
}
