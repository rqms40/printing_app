import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Fetches active Daily Grid cards from the server.
/// Uses autoDispose so it refetches when the home screen is re-entered.
final dailyGridProvider = FutureProvider.autoDispose<List<DailyGridItem>>((ref) async {
  final response = await ApiClient.instance.get('/daily-grid');
  final list = response.data as List<dynamic>;
  return list
      .map((e) => DailyGridItem.fromJson(e as Map<String, dynamic>))
      .toList();
});
