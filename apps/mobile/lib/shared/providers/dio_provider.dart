import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Provides the underlying Dio instance for use in providers.
/// Override in tests to inject mock clients.
final dioProvider = Provider<Dio>((ref) => ApiClient.instance.dio);
