import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Common test setup utilities.
class TestSetup {
  /// Initializes ApiClient with a mock base URL so it doesn't throw
  /// StateError during tests. Safe to call multiple times (no-op after first).
  static void initApiClient() {
    ApiClient.instance.init(baseUrl: 'http://mock-test/api');
  }

  /// Stubs out flutter_secure_storage method channel so TokenStorage
  /// calls don't crash in unit tests.
  static void stubSecureStorage() {
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
      switch (methodCall.method) {
        case 'read':
          return null;
        case 'write':
          return null;
        case 'delete':
          return null;
        case 'readAll':
          return <String, String>{};
        case 'deleteAll':
          return null;
        default:
          return null;
      }
    });
  }
}
