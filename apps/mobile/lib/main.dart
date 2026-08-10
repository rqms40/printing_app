import 'dart:developer' as developer;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'config/api_config.dart';
import 'shared/services/api_client.dart';
import 'shared/services/api_health_check.dart';
import 'shared/services/draft_storage_service.dart';
import 'shared/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DraftStorageService.init();

  // Initialize Firebase + push notifications
  await NotificationService.init();

  // API base URL — resolved in api_config.dart (web LAN host auto-detected).
  // Prefer: flutter run --dart-define-from-file=dart_defines.json
  ApiClient.instance.init(baseUrl: '$kServerUrl/api');
  developer.log('API base: $kServerUrl/api', name: 'ApiConfig');

  // Check if the API server is reachable; app works with mock data if not.
  final serverReachable = await ApiHealthCheck.isServerReachable();
  if (!serverReachable) {
    developer.log(
      'API server is not reachable at $kServerUrl. '
      'Start docker-compose.dev.yml or set SERVER_URL. App may use mock data.',
      name: 'ApiHealthCheck',
    );
  }

  runApp(const ProviderScope(child: App()));
}
