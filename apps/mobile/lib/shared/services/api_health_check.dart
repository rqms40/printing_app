import 'api_client.dart';

/// Quick check if the NestJS server is reachable.
class ApiHealthCheck {
  static Future<bool> isServerReachable() async {
    try {
      final response = await ApiClient.instance.get('/health');
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
