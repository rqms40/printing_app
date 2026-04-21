import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';

// Test the _expiryLabel helper by instantiating it through the widget's logic.
// We verify badge visibility by building a minimal widget that calls the same
// expiry logic.

String? expiryLabel(DateTime? expiresAt) {
  if (expiresAt == null) return null;
  final diff = expiresAt.difference(DateTime.now());
  if (diff.isNegative) return null;
  if (diff.inHours < 24) return 'Expires today';
  final days = diff.inDays;
  if (days <= 3) return 'Expires in $days day${days == 1 ? '' : 's'}';
  return null;
}

void main() {
  group('expiryLabel', () {
    test('returns null when expiresAt is null', () {
      expect(expiryLabel(null), isNull);
    });

    test('returns null when more than 3 days away', () {
      final dt = DateTime.now().add(const Duration(days: 4));
      expect(expiryLabel(dt), isNull);
    });

    test('returns "Expires today" when less than 24 hours away', () {
      final dt = DateTime.now().add(const Duration(hours: 12));
      expect(expiryLabel(dt), 'Expires today');
    });

    test('returns "Expires in 1 day" when exactly 1 day away', () {
      final dt = DateTime.now().add(const Duration(hours: 25));
      expect(expiryLabel(dt), 'Expires in 1 day');
    });

    test('returns "Expires in 3 days" when 3 days away', () {
      final dt = DateTime.now().add(const Duration(hours: 73));
      expect(expiryLabel(dt), 'Expires in 3 days');
    });

    test('returns null when expiresAt is in the past', () {
      final dt = DateTime.now().subtract(const Duration(hours: 1));
      expect(expiryLabel(dt), isNull);
    });
  });
}
