import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/firebase_options.dart';

void main() {
  test('provides Firebase options for iOS', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);

    final options = DefaultFirebaseOptions.currentPlatform;

    expect(options.projectId, 'grid-print-85681');
    expect(options.iosBundleId, 'com.example.printingApp');
  });
}
