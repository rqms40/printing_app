import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/beta/models/beta_locked_info.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/token_storage.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_session_trigger.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

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
    this.tutorialSeenKeys = const [],
    this.defaultPaymentMethod,
  });

  final String id;
  final String email;
  final String fullName;
  final String role; // 'customer', 'rider', 'admin'
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
  final List<String> tutorialSeenKeys;
  final PaymentMethod? defaultPaymentMethod;

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
    List<String>? tutorialSeenKeys,
    PaymentMethod? defaultPaymentMethod,
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
      tutorialSeenKeys: tutorialSeenKeys ?? this.tutorialSeenKeys,
      defaultPaymentMethod: defaultPaymentMethod ?? this.defaultPaymentMethod,
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
    this.betaLocked,
  });

  factory AuthState.unauthenticated() => const AuthState();

  final AuthStatus status;
  final AuthUser? user;
  final bool isLoading;
  final String? errorMessage;
  final BetaLockedInfo? betaLocked;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? isLoading,
    String? errorMessage,
    BetaLockedInfo? betaLocked,
    bool clearBetaLocked = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      betaLocked: clearBetaLocked ? null : (betaLocked ?? this.betaLocked),
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
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
      await _ref?.read(accountStateProvider.notifier).refresh();
      _connectNotificationsWs();
      _resetSessionScopedData();
    } on DioException catch (e) {
      // Handle beta-completed users: 403 with code='beta_held'
      if (e.response?.statusCode == 403 &&
          e.response?.data is Map &&
          (e.response!.data as Map)['code'] == 'beta_held') {
        final info = BetaLockedInfo.fromJson(
          e.response!.data as Map<String, dynamic>,
        );
        state = state.copyWith(
          isLoading: false,
          betaLocked: info,
          errorMessage: null,
        );
        return;
      }
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
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
      await _ref?.read(accountStateProvider.notifier).refresh();
      _connectNotificationsWs();
      _resetSessionScopedData();
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
      'rider': const AuthUser(
        id: '2',
        email: 'juan@test.com',
        fullName: 'Juan Reyes',
        nickname: 'Juan',
        role: 'rider',
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
    _ref?.read(checkoutProvider.notifier).reset();
    _ref?.read(accountStateProvider.notifier).clear();
    _connectNotificationsWs();
  }

  void setDefaultPaymentMethod(PaymentMethod method) {
    final user = state.user;
    if (user == null) return;
    state = state.copyWith(user: user.copyWith(defaultPaymentMethod: method));
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
      if (user.isProfileComplete) {
        _connectNotificationsWs();
      }
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update profile',
      );
      return false;
    }
  }

  /// Clears user-scoped order state and reloads addresses for the new session,
  /// preventing a previous user's selected delivery address from leaking into a
  /// new account's checkout (which the server rejects as "Invalid delivery
  /// address").
  void _resetSessionScopedData() {
    _ref?.read(checkoutProvider.notifier).reset();
    _ref?.read(addressProvider.notifier).refreshAddresses();
  }

  Future<void> logout() async {
    await TokenStorage.clearToken();
    WebSocketService.instance.disconnect();
    _ref?.read(checkoutProvider.notifier).reset();
    _ref?.read(accountStateProvider.notifier).clear();
    _ref?.read(tutorialProvider.notifier).resetStateOnly();
    try {
      _ref?.read(notificationsProvider.notifier).clearNotifications();
    } catch (_) {}
    try {
      _ref?.read(ordersProvider.notifier).clear();
    } catch (_) {}
    // Reset session-scoped UI flags so they fire again on next login.
    _ref?.read(nextBatchShownThisSessionProvider.notifier).state = false;
    // AuthState() clears everything including betaLocked.
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
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
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
    // Listen for real-time survey-required events so the survey gate activates
    // without the user needing to refresh or re-login.
    WebSocketService.instance.listenForSurveyRequired((_) {
      _ref?.read(accountStateProvider.notifier).refresh();
    });
    // Connect orders WebSocket and refresh active notifications and orders lists
    try {
      WebSocketService.instance.connectOrders(
        onConnect: () {
          _ref?.read(ordersProvider.notifier).refreshOrders();
        },
      );
    } catch (_) {}
    try {
      _ref?.read(notificationsProvider.notifier).refreshNotifications();
    } catch (_) {}
    try {
      _ref?.read(ordersProvider.notifier).refreshOrders();
    } catch (_) {}
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
      tutorialSeenKeys: _parseStringList(json['tutorialSeenKeys']),
      defaultPaymentMethod: _parseDefaultPaymentMethod(
        json['defaultPaymentMethod'] ?? json['default_payment_method'],
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

  PaymentMethod? _parseDefaultPaymentMethod(dynamic value) {
    final normalized = value
        ?.toString()
        .replaceAll(RegExp(r'[_-]'), '')
        .toLowerCase();
    switch (normalized) {
      case 'gcash':
        return PaymentMethod.gcash;
      case 'maya':
        return PaymentMethod.maya;
      case 'cod':
      case 'cash':
        return PaymentMethod.cod;
      case 'credits':
      case 'gridcredits':
        return PaymentMethod.gridCredits;
      default:
        return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(ref),
);
