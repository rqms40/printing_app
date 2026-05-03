import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';

void main() {
  group('DailyGridItem.fromJson', () {
    test('parses dynamic specs correctly', () {
      final json = {
        'id': 1,
        'title': 'Bond A4',
        'category': 'paper',
        'sortOrder': 0,
        'specs': {'paper_size': 'a4', 'color_mode': 'black_and_white'},
        'specDisplayValues': {'paper_size': 'A4'},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.specs, {'paper_size': 'a4', 'color_mode': 'black_and_white'});
      expect(item.specDisplayValues, {'paper_size': 'A4'});
    });

    test('converts legacy paperSpecs when specs are absent', () {
      final json = {
        'id': 2,
        'title': 'Bond A4',
        'category': 'paper',
        'sortOrder': 1,
        'paperSpecs': {'paperSize': 'a4', 'colorMode': 'blackAndWhite'},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.specs, {'paper_size': 'a4', 'color_mode': 'black_and_white'});
    });

    test('converts legacy threeDSpecs when specs are absent', () {
      final json = {
        'id': 3,
        'title': '3D Print',
        'category': '3d',
        'sortOrder': 2,
        'threeDSpecs': {'fileFormat': 'threeMf', 'material': 'pla'},
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.specs, {'file_format': '3mf', 'material': 'pla'});
    });

    test('parses null specs when absent from JSON', () {
      final json = {
        'id': 4,
        'title': 'Card',
        'category': 'paper',
        'sortOrder': 0,
      };
      final item = DailyGridItem.fromJson(json);
      expect(item.specs, isNull);
      expect(item.specDisplayValues, isEmpty);
    });
  });
}
