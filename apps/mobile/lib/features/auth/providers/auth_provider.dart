import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/token_storage.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_session_trigger.dart';

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
    this.nickname,
    this.phone,
    this.gender,
    this.ageRange,
    this.dateOfBirth,
    this.credits,
    this.profileCategory,
    this.profileField,
    this.course,
    this.organization,
    this.printingPreferences = const [],
  });

  final String id;
  final String email;
  final String fullName;
  final String role; // 'customer', 'driver', 'admin'
  final bool isProfileComplete;
  final String? nickname;
  final String? phone;
  final String? gender;
  final String? ageRange;
  final DateTime? dateOfBirth;
  final String? credits;
  final String? profileCategory;
  final String? profileField;
  final String? course;
  final String? organization;
  final List<String> printingPreferences;

  AuthUser copyWith({
    String? id,
    String? email,
    String? fullName,
    String? role,
    bool? isProfileComplete,
    String? nickname,
    String? phone,
    String? gender,
    String? ageRange,
    DateTime? dateOfBirth,
    String? credits,
    String? profileCategory,
    String? profileField,
    String? course,
    String? organization,
    List<String>? printingPreferences,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      nickname: nickname ?? this.nickname,
      phone: phone ?? this.phone,
      gender: gender ?? this.gender,
      ageRange: ageRange ?? this.ageRange,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      credits: credits ?? this.credits,
      profileCategory: profileCategory ?? this.profileCategory,
      profileField: profileField ?? this.profileField,
      course: course ?? this.course,
      organization: organization ?? this.organization,
      printingPreferences: printingPreferences ?? this.printingPreferences,
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
// Imported here so logout() can clear the session-scoped flag. Lives in
// the home/widgets layer because that's where it's read.
// (Avoids creating a yet-another barrel just for this constant.)

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier([this._ref]) : super(AuthState.unauthenticated()) {
    _listenToFcmMessages();
  }

  final Ref? _ref;
  StreamSubscription<Map<String, dynamic>>? _fcmSub;

  void _listenToFcmMessages() {
    _fcmSub?.cancel();
    _fcmSub = NotificationService.messageStream.listen((data) {
      if (data['type'] == 'credits_update' && state.user != null) {
        final credits = data['credits']?.toString();
        if (credits != null && credits.isNotEmpty) {
          state = state.copyWith(user: state.user!.copyWith(credits: credits));
        }
      }
    });
  }

  @override
  void dispose() {
    _fcmSub?.cancel();
    super.dispose();
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await ApiClient.instance.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
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
      await _ref?.read(accountStateProvider.notifier).refresh();
      _connectNotificationsWs();
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

  Future<void> register(
    String email,
    String password, {
    required String fullName,
    required String profileCategory,
    required String profileField,
    String? nickname,
    String? phone,
    String? gender,
    String? ageRange,
    DateTime? dob,
    String? course,
    String? organization,
    List<String> printingPreferences = const [],
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await ApiClient.instance.post(
        '/auth/register',
        data: {
          'email': email,
          'password': password,
          'fullName': fullName,
          if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
          'profileCategory': profileCategory,
          'profileField': profileField,
          if (ageRange != null && ageRange.isNotEmpty) 'ageRange': ageRange,
          if (phone != null && phone.isNotEmpty) 'phoneNumber': phone,
          if (gender != null && gender.isNotEmpty) 'gender': gender,
          if (dob != null) 'dateOfBirth': dob.toIso8601String(),
          if (course != null && course.isNotEmpty) 'course': course,
          if (organization != null && organization.isNotEmpty)
            'organization': organization,
          if (printingPreferences.isNotEmpty)
            'printingPreferences': printingPreferences,
        },
      );
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
      await _ref?.read(accountStateProvider.notifier).refresh();
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
        nickname: 'Mia',
        role: 'customer',
        isProfileComplete: true,
        ageRange: '18_24',
        profileCategory: 'student',
        profileField: 'architecture',
        organization: 'Mapua University',
        printingPreferences: ['plotting_blueprints'],
      ),
      'driver': const AuthUser(
        id: '2',
        email: 'juan@test.com',
        fullName: 'Juan Reyes',
        nickname: 'Juan',
        role: 'driver',
        isProfileComplete: true,
        ageRange: '35_44',
        profileCategory: 'professional',
        profileField: 'engineer_contractor',
        organization: 'Grid Logistics',
        printingPreferences: ['technical_specs'],
      ),
      'admin': const AuthUser(
        id: '3',
        email: 'admin@test.com',
        fullName: 'Admin',
        nickname: 'Admin',
        role: 'admin',
        isProfileComplete: true,
        ageRange: '35_44',
        profileCategory: 'professional',
        profileField: 'business_corporate',
        organization: 'Grid Print HQ',
        printingPreferences: ['marketing_materials'],
      ),
    };
    state = AuthState(status: AuthStatus.authenticated, user: users[role]!);
    _ref?.read(accountStateProvider.notifier).clear();
  }

  Future<bool> completeProfile({
    required String fullName,
    String? nickname,
    String? phone,
    String? gender,
    String? ageRange,
    DateTime? dob,
    String? profileCategory,
    String? profileField,
    String? course,
    String? organization,
    List<String>? printingPreferences,
  }) async {
    state = state.copyWith(isLoading: true);
    try {
      final payload = <String, dynamic>{
        'fullName': fullName,
        if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
        if (phone != null && phone.isNotEmpty) 'phoneNumber': phone,
        if (gender != null && gender.isNotEmpty) 'gender': gender,
        if (ageRange != null && ageRange.isNotEmpty) 'ageRange': ageRange,
        if (dob != null) 'dateOfBirth': dob.toIso8601String(),
        if (course != null && course.isNotEmpty) 'course': course,
        if (organization != null && organization.isNotEmpty)
          'organization': organization,
      };
      if (profileCategory != null) payload['profileCategory'] = profileCategory;
      if (profileField != null) payload['profileField'] = profileField;
      if (printingPreferences != null) {
        payload['printingPreferences'] = printingPreferences;
      }

      final response = await ApiClient.instance.put(
        '/users/profile',
        data: payload,
      );
      final user = _parseUser(response.data as Map<String, dynamic>);
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update profile',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await TokenStorage.clearToken();
    WebSocketService.instance.disconnect();
    _ref?.read(accountStateProvider.notifier).clear();
    // Reset session-scoped UI flags so they fire again on next login.
    _ref?.read(nextBatchShownThisSessionProvider.notifier).state = false;
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
      await _ref?.read(accountStateProvider.notifier).refresh();
      _connectNotificationsWs();
    } catch (_) {
      await TokenStorage.clearToken();
      _ref?.read(accountStateProvider.notifier).clear();
      // Token expired or invalid — stay unauthenticated
    }
  }

  Future<void> refreshProfile() async {
    if (state.status == AuthStatus.unauthenticated) return;

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
      // Profile refresh is best-effort; cancellation should still complete.
    }
  }

  void _connectNotificationsWs() {
    WebSocketService.instance.connectNotifications(
      onCreditsUpdate: (data) {
        final credits = data['credits']?.toString();
        if (credits != null && credits.isNotEmpty && state.user != null) {
          state = state.copyWith(user: state.user!.copyWith(credits: credits));
        }
      },
    );
  }

  /// Send the current FCM token to the server for targeted push notifications.
  /// Non-critical — notifications won't work but app still functions if this fails.
  Future<void> _sendFcmToken() async {
    final fcmToken = await NotificationService.getToken();
    if (fcmToken != null) {
      try {
        await ApiClient.instance.post(
          '/users/fcm-token',
          data: {'token': fcmToken},
        );
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
      nickname: (json['nickname'] ?? json['nickName']) as String?,
      phone: json['phoneNumber'] as String?,
      gender: json['gender'] as String?,
      ageRange: (json['ageRange'] ?? json['age_range']) as String?,
      credits: json['credits']?.toString(),
      profileCategory: json['profileCategory'] as String?,
      profileField: json['profileField'] as String?,
      course: json['course'] as String?,
      organization: json['organization'] as String?,
      printingPreferences: _parseStringList(
        json['printingPreferences'] ?? json['printing_preferences'],
      ),
      dateOfBirth: json['dateOfBirth'] != null
          ? DateTime.tryParse(json['dateOfBirth'] as String)
          : null,
    );
  }

  List<String> _parseStringList(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }

    if (value is String && value.isNotEmpty) {
      return value
          .split(',')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
    }

    return const [];
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(ref),
);
