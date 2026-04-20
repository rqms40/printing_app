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
  // Web build served from a remote host uses the server's public IP.
  // iOS simulator / desktop use localhost directly.
  const String kServerUrl = String.fromEnvironment(
    'SERVER_URL',
    defaultValue: '',
  );
  final String baseUrl;
  if (kServerUrl.isNotEmpty) {
    baseUrl = '$kServerUrl/api';
  } else if (kIsWeb) {
    baseUrl = 'http://localhost:3000/api';
  } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    baseUrl = 'http://10.0.2.2:3000/api';
  } else {
    baseUrl = 'http://localhost:3000/api';
  }
  ApiClient.instance.init(baseUrl: baseUrl);

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
