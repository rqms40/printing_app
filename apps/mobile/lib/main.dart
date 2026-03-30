import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'shared/services/api_client.dart';
import 'shared/services/api_health_check.dart';
import 'shared/services/draft_storage_service.dart';
import 'shared/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DraftStorageService.init();

  // Initialize Firebase + push notifications
  await NotificationService.init();

  // Initialize API client with platform-appropriate base URL.
  // Android emulator uses 10.0.2.2 to reach host machine's localhost.
  // All other platforms (web, desktop, iOS simulator) use localhost directly.
  final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  ApiClient.instance.init(
    baseUrl: isAndroid
        ? 'http://10.0.2.2:3000/api'
        : 'http://localhost:3000/api',
  );

  // Check if the API server is reachable; app works with mock data if not.
  final serverReachable = await ApiHealthCheck.isServerReachable();
  if (!serverReachable) {
    developer.log(
      'API server is not reachable. App will operate with mock data.',
      name: 'ApiHealthCheck',
    );
  }

  runApp(const ProviderScope(child: App()));
}
