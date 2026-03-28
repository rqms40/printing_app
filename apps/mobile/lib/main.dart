import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'shared/services/api_client.dart';
import 'shared/services/api_health_check.dart';
import 'shared/services/draft_storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DraftStorageService.init();

  // Initialize API client with platform-appropriate base URL
  ApiClient.instance.init(
    baseUrl: kIsWeb
        ? 'http://localhost:3000/api'
        : 'http://10.0.2.2:3000/api', // Android emulator
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
