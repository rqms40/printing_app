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

  // API base URL — edit lib/config/api_config.dart to change the default.
  ApiClient.instance.init(baseUrl: '$kServerUrl/api');

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
