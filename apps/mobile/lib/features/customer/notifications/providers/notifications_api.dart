import 'package:printing_app/shared/services/api_client.dart';

abstract class NotificationsApi {
  Future<List<Map<String, dynamic>>> fetchNotifications();
  Future<void> markAsRead(String id);
  Future<void> markAllAsRead();
}

class NotificationsApiImpl implements NotificationsApi {
  NotificationsApiImpl({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient.instance;

  final ApiClient _apiClient;

  @override
  Future<List<Map<String, dynamic>>> fetchNotifications() async {
    final response = await _apiClient.get('/notifications');
    final data = response.data as List<dynamic>;
    return data.cast<Map<String, dynamic>>();
  }

  @override
  Future<void> markAsRead(String id) {
    return _apiClient.patch('/notifications/$id/read');
  }

  @override
  Future<void> markAllAsRead() {
    return _apiClient.patch('/notifications/read-all');
  }
}
