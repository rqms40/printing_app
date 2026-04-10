import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/token_storage.dart';

// ---------------------------------------------------------------------------
// Auth status
// ---------------------------------------------------------------------------
enum AuthStatus { unauthenticated, authenticated, profileIncomplete }

// ---------------------------------------------------------------------------
// Simple user model (self-contained, no external deps)
// ---------------------------------------------------------------------------
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.isProfileComplete = false,
    this.phone,
    this.gender,
    this.dateOfBirth,
    this.credits,
  });

  final String id;
  final String email;
  final String fullName;
  final String role; // 'customer', 'driver', 'admin'
  final bool isProfileComplete;
  final String? phone;
  final String? gender;
  final DateTime? dateOfBirth;
  final String? credits;

  AuthUser copyWith({
    String? id,
    String? email,
    String? fullName,
    String? role,
    bool? isProfileComplete,
    String? phone,
    String? gender,
    DateTime? dateOfBirth,
    String? credits,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      phone: phone ?? this.phone,
      gender: gender ?? this.gender,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      credits: credits ?? this.credits,
    );
  }
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
class AuthState {
  const AuthState({
    this.status = AuthStatus.unauthenticated,
    this.user,
    this.isLoading = false,
    this.errorMessage,
  });

  factory AuthState.unauthenticated() => const AuthState();

  final AuthStatus status;
  final AuthUser? user;
  final bool isLoading;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

// ---------------------------------------------------------------------------
// Auth notifier
// ---------------------------------------------------------------------------
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState.unauthenticated());

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await ApiClient.instance.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = response.data as Map<String, dynamic>;
      await TokenStorage.saveToken(data['access_token'] as String);
      final user = _parseUser(data['user'] as Map<String, dynamic>);
      await _sendFcmToken();
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ?? 'Login failed'
          : 'Login failed';
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Connection error. Check your network.',
      );
    }
  }

  Future<void> register(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await ApiClient.instance.post('/auth/register', data: {
        'email': email,
        'password': password,
      });
      final data = response.data as Map<String, dynamic>;
      await TokenStorage.saveToken(data['access_token'] as String);
      final user = _parseUser(data['user'] as Map<String, dynamic>);
      await _sendFcmToken();
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ??
              'Registration failed'
          : 'Registration failed';
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Connection error. Check your network.',
      );
    }
  }

  void devBypass(String role) {
    final users = {
      'customer': const AuthUser(
        id: '1',
        email: 'maria@test.com',
        fullName: 'Maria Santos',
        role: 'customer',
        isProfileComplete: true,
      ),
      'driver': const AuthUser(
        id: '2',
        email: 'juan@test.com',
        fullName: 'Juan Reyes',
        role: 'driver',
        isProfileComplete: true,
      ),
      'admin': const AuthUser(
        id: '3',
        email: 'admin@test.com',
        fullName: 'Admin',
        role: 'admin',
        isProfileComplete: true,
      ),
    };
    state = AuthState(
      status: AuthStatus.authenticated,
      user: users[role]!,
    );
  }

  Future<void> completeProfile({
    required String fullName,
    String? phone,
    String? gender,
    DateTime? dob,
  }) async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await ApiClient.instance.put('/users/profile', data: {
        'fullName': fullName,
        if (phone != null && phone.isNotEmpty) 'phoneNumber': phone,
        if (gender != null && gender.isNotEmpty) 'gender': gender,
        if (dob != null) 'dateOfBirth': dob.toIso8601String(),
      });
      final user = _parseUser(response.data as Map<String, dynamic>);
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user.copyWith(isProfileComplete: true),
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update profile',
      );
    }
  }

  Future<void> logout() async {
    await TokenStorage.clearToken();
    state = AuthState.unauthenticated();
  }

  Future<void> tryAutoLogin() async {
    final hasToken = await TokenStorage.hasToken();
    if (!hasToken) return;

    try {
      final response = await ApiClient.instance.get('/users/profile');
      final user = _parseUser(response.data as Map<String, dynamic>);
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
    } catch (_) {
      await TokenStorage.clearToken();
      // Token expired or invalid — stay unauthenticated
    }
  }

  /// Send the current FCM token to the server for targeted push notifications.
  /// Non-critical — notifications won't work but app still functions if this fails.
  Future<void> _sendFcmToken() async {
    final fcmToken = await NotificationService.getToken();
    if (fcmToken != null) {
      try {
        await ApiClient.instance
            .post('/users/fcm-token', data: {'token': fcmToken});
      } catch (_) {
        // Non-critical — notifications won't work but app still functions
      }
    }
  }

  AuthUser _parseUser(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'].toString(),
      email: json['email'] as String,
      fullName: (json['fullName'] as String?) ?? '',
      role: json['role'] as String? ?? 'customer',
      isProfileComplete: json['isProfileComplete'] as bool? ?? false,
      phone: json['phoneNumber'] as String?,
      gender: json['gender'] as String?,
      credits: json['credits']?.toString(),
      dateOfBirth: json['dateOfBirth'] != null
          ? DateTime.tryParse(json['dateOfBirth'] as String)
          : null,
    );
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
final authProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
