import 'package:dio/dio.dart';
import 'token_storage.dart';

/// Centralized API client for all NestJS backend calls.
///
/// - Auto-attaches JWT token to requests
/// - Handles 401 (clears token)
/// - Configurable base URL
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  // LAN-reachable default so phones on the same Wi-Fi can hit the dev server
  // without a per-device build. Overridden by main.dart via init(baseUrl:)
  // using the kServerUrl from api_config.dart, which respects the
  // --dart-define=SERVER_URL build flag.
  static const String _defaultBaseUrl = 'http://192.168.40.201:3000/api';

  late final Dio _dio;
  bool _initialized = false;

  /// Call once at app startup.
  void init({String? baseUrl}) {
    if (_initialized) return;

    _dio = Dio(BaseOptions(
      baseUrl: baseUrl ?? _defaultBaseUrl,
      // Generous timeouts: 3D model uploads can be 200 MB. The server also
      // does inline file analysis (3MF → GLB conversion can take a few
      // seconds for large meshes) before responding, so receiveTimeout
      // covers both transfer + processing time.
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(minutes: 5),
      receiveTimeout: const Duration(minutes: 5),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Attach JWT token to every request
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await TokenStorage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await TokenStorage.clearToken();
          // The auth provider will detect this and redirect to login
        }
        handler.next(error);
      },
    ));

    _initialized = true;
  }

  Dio get dio {
    if (!_initialized) {
      throw StateError('ApiClient not initialized. Call ApiClient.instance.init() first.');
    }
    return _dio;
  }

  // Convenience methods
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters, Options? options}) =>
      dio.get<T>(path, queryParameters: queryParameters, options: options);

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Options? options,
    void Function(int, int)? onSendProgress,
  }) =>
      dio.post<T>(
        path,
        data: data,
        options: options,
        onSendProgress: onSendProgress,
      );

  Future<Response<T>> put<T>(String path, {dynamic data, Options? options}) =>
      dio.put<T>(path, data: data, options: options);

  Future<Response<T>> patch<T>(String path, {dynamic data, Options? options}) =>
      dio.patch<T>(path, data: data, options: options);

  Future<Response<T>> delete<T>(String path, {Options? options}) =>
      dio.delete<T>(path, options: options);
}
