import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';

void main() {
  group('DailyGridItem.fromJson', () {
    test('parses paperSpecs correctly', () {
      final json = {
        'id': 1,
        'title': 'Bond A4',
        'category': 'paper',
        'sortOrder': 0,
        'paperSpecs': {'paperSize': 'a4', 'colorMode': 'blackAndWhite'},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.paperSpecs, {'paperSize': 'a4', 'colorMode': 'blackAndWhite'});
      expect(item.threeDSpecs, isNull);
    });

    test('parses threeDSpecs correctly', () {
      final json = {
        'id': 2,
        'title': '3D Print',
        'category': '3d',
        'sortOrder': 1,
        'threeDSpecs': {'material': 'pla', 'infillPercentage': 20},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.threeDSpecs, {'material': 'pla', 'infillPercentage': 20});
      expect(item.paperSpecs, isNull);
    });

    test('parses null specs when absent from JSON', () {
      final json = {
        'id': 3,
        'title': 'Card',
        'category': 'paper',
        'sortOrder': 0,
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.paperSpecs, isNull);
      expect(item.threeDSpecs, isNull);
    });
  });
}
