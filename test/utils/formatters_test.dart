import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/utils/formatters.dart';

void main() {
  group('formatCurrency', () {
    test('formats whole numbers', () {
      expect(formatCurrency(1000.0), contains('1,000.00'));
      expect(formatCurrency(1000.0), contains('₱'));
    });

    test('formats decimal amounts', () {
      expect(formatCurrency(1234.56), contains('1,234.56'));
    });

    test('formats zero', () {
      expect(formatCurrency(0.0), contains('0.00'));
    });

    test('formats small amounts', () {
      final result = formatCurrency(5.5);
      expect(result, contains('5.50'));
    });

    test('formats large amounts', () {
      final result = formatCurrency(999999.99);
      expect(result, contains('999,999.99'));
    });
  });

  group('formatDate', () {
    test('formats a date correctly', () {
      final date = DateTime(2026, 3, 27);
      expect(formatDate(date), 'Mar 27, 2026');
    });

    test('handles single digit day', () {
      final date = DateTime(2026, 1, 5);
      expect(formatDate(date), 'Jan 5, 2026');
    });

    test('handles December', () {
      final date = DateTime(2025, 12, 25);
      expect(formatDate(date), 'Dec 25, 2025');
    });
  });

  group('formatTime', () {
    test('formats afternoon time', () {
      final date = DateTime(2026, 3, 27, 15, 0);
      expect(formatTime(date), '3:00 PM');
    });

    test('formats morning time', () {
      final date = DateTime(2026, 3, 27, 9, 30);
      expect(formatTime(date), '9:30 AM');
    });

    test('formats noon', () {
      final date = DateTime(2026, 3, 27, 12, 0);
      expect(formatTime(date), '12:00 PM');
    });

    test('formats midnight', () {
      final date = DateTime(2026, 3, 27, 0, 0);
      expect(formatTime(date), '12:00 AM');
    });
  });

  group('formatDateTime', () {
    test('combines date and time', () {
      final date = DateTime(2026, 3, 27, 15, 0);
      expect(formatDateTime(date), 'Mar 27, 2026 at 3:00 PM');
    });
  });

  group('formatFileSize', () {
    test('formats bytes', () {
      expect(formatFileSize(500), '500 B');
    });

    test('formats kilobytes', () {
      expect(formatFileSize(1024), '1.0 KB');
      expect(formatFileSize(1536), '1.5 KB');
    });

    test('formats megabytes', () {
      expect(formatFileSize(1048576), '1.0 MB');
      expect(formatFileSize(2621440), '2.5 MB');
    });

    test('formats gigabytes', () {
      expect(formatFileSize(1073741824), '1.0 GB');
    });

    test('handles zero bytes', () {
      expect(formatFileSize(0), '0 B');
    });
  });
}
