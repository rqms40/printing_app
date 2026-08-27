import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/app_version.dart';

void main() {
  test('admin-visible app version matches pubspec release version', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final match = RegExp(
      r'^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$',
      multiLine: true,
    ).firstMatch(pubspec);
    expect(match, isNotNull);
    expect(match!.group(1), '1.12.7');
    expect(match.group(2), '35');
    expect(AppVersion.version, match.group(1));
    expect(AppVersion.buildNumber, match.group(2));
  });
}
