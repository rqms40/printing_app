import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
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
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

// ---------------------------------------------------------------------------
// Auth status
// ---------------------------------------------------------------------------
enum AuthStatus { unauthenticated, authenticated, profileIncomplete }

String? betaHeldAccessTokenFromResponse(Map<dynamic, dynamic> data) {
  final token = data['access_token']?.toString().trim();
  return token == null || token.isEmpty ? null : token;
}

abstract interface class AuthSessionClient {
  Future<Map<String, dynamic>> login(String email, String password);

  Future<Map<String, dynamic>> getProfile();

  Future<Map<String, dynamic>> getCompletionState();

  Future<bool> hasStoredToken();

  Future<void> saveToken(String token);

  Future<void> clearToken();
}

class ApiAuthSessionClient implements AuthSessionClient {
  const ApiAuthSessionClient();

  @override
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await ApiClient.instance.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  @override
  Future<Map<String, dynamic>> getProfile() async {
    final response = await ApiClient.instance.get('/users/profile');
    return Map<String, dynamic>.from(response.data as Map);
  }

  @override
  Future<Map<String, dynamic>> getCompletionState() async {
    final response = await ApiClient.instance.get('/beta-mode/me/completion');
    return Map<String, dynamic>.from(response.data as Map);
  }

  @override
  Future<bool> hasStoredToken() => TokenStorage.hasToken();

  @override
  Future<void> saveToken(String token) => TokenStorage.saveToken(token);

  @override
  Future<void> clearToken() => TokenStorage.clearToken();
}

abstract interface class FcmSessionClient {
  Future<void> registerCurrentToken();

  Future<void> revokeCurrentToken();

  Future<void> invalidateLocalToken();
}

class ApiFcmSessionClient implements FcmSessionClient {
  const ApiFcmSessionClient();

  @override
  Future<void> registerCurrentToken() async {
    final token = await NotificationService.getToken();
    if (token == null) {
      await invalidateLocalToken();
      return;
    }
    try {
      await ApiClient.instance.post('/users/fcm-token', data: {'token': token});
      await NotificationService.markTokenRegistered();
    } catch (_) {
      // If exclusive ownership cannot be transferred to the new account,
      // disable this installation token so the previous owner's pushes cannot
      // appear in the new session.
      await invalidateLocalToken();
    }
  }

  @override
  Future<void> revokeCurrentToken() async {
    final token = await NotificationService.getToken();
    if (token == null) {
      await invalidateLocalToken();
      return;
    }
    try {
      await ApiClient.instance.delete(
        '/users/fcm-token',
        data: {'token': token},
      );
    } finally {
      // If the network is unavailable, invalidating the local Firebase token
      // still prevents pushes for the previous account reaching this device.
      await invalidateLocalToken();
    }
  }

  @override
  Future<void> invalidateLocalToken() => NotificationService.deleteToken();
}

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
    this.clientAccountType,
    this.printingPreferences = const [],
    this.tutorialSeenKeys = const [],
    this.defaultPaymentMethod,
  });

  final String id;
  final String email;
  final String fullName;
  final String role; // client|supplier|rider|ops_admin|super_admin (+ legacy)
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
  /// Optional marketplace metadata: business | organization | teacher.
  final String? clientAccountType;
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
    String? clientAccountType,
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
      clientAccountType: clientAccountType ?? this.clientAccountType,
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
    this.betaCompletionJustSubmitted = false,
  });

  factory AuthState.unauthenticated() => const AuthState();

  final AuthStatus status;
  final AuthUser? user;
  final bool isLoading;
  final String? errorMessage;
  final BetaLockedInfo? betaLocked;
  final bool betaCompletionJustSubmitted;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? isLoading,
    String? errorMessage,
    BetaLockedInfo? betaLocked,
    bool clearBetaLocked = false,
    bool? betaCompletionJustSubmitted,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      betaLocked: clearBetaLocked ? null : (betaLocked ?? this.betaLocked),
      betaCompletionJustSubmitted:
          betaCompletionJustSubmitted ?? this.betaCompletionJustSubmitted,
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
  AuthNotifier([
    this._ref,
    bool? devAuthEnabled,
    AuthSessionClient? sessionClient,
    FcmSessionClient? fcmSessionClient,
  ]) : _devAuthEnabled = devAuthEnabled ?? AppConstants.enableDevAuth,
       _sessionClient = sessionClient ?? const ApiAuthSessionClient(),
       _fcmSessionClient = fcmSessionClient ?? const ApiFcmSessionClient(),
       _manageFcmSession = fcmSessionClient != null || _ref != null,
       super(AuthState.unauthenticated()) {
    _listenToFcmMessages();
  }

  final Ref? _ref;
  final bool _devAuthEnabled;
  final AuthSessionClient _sessionClient;
  final FcmSessionClient _fcmSessionClient;
  final bool _manageFcmSession;
  bool _isDevBypassSession = false;
  StreamSubscription<Map<String, dynamic>>? _fcmSub;
  StreamSubscription<String>? _fcmTokenRefreshSub;
  void Function()? _removeCreditsUpdateListener;
  void Function()? _removeSurveyRequiredListener;
  int _authGeneration = 0;
  Future<void> _tokenMutationTail = Future<void>.value();

  int _beginAuthOperation() => ++_authGeneration;

  bool _isAuthOperationCurrent(int generation) =>
      mounted && generation == _authGeneration;

  Future<void> _queueTokenMutation(Future<void> Function() mutation) {
    final next = _tokenMutationTail
        .catchError((Object _) {})
        .then((_) => mutation());
    _tokenMutationTail = next.catchError((Object _) {});
    return next;
  }

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
    _fcmTokenRefreshSub?.cancel();
    if (_manageFcmSession) {
      _fcmTokenRefreshSub = NotificationService.tokenRefreshStream.listen((_) {
        if (state.user == null || _isDevBypassSession) return;
        final authGeneration = _authGeneration;
        unawaited(_refreshFcmToken(authGeneration));
      });
    }
  }

  @override
  void dispose() {
    _authGeneration += 1;
    _fcmSub?.cancel();
    _fcmTokenRefreshSub?.cancel();
    _clearRealtimeCallbacks();
    super.dispose();
  }

  void _clearRealtimeCallbacks() {
    _removeCreditsUpdateListener?.call();
    _removeCreditsUpdateListener = null;
    _removeSurveyRequiredListener?.call();
    _removeSurveyRequiredListener = null;
  }

  void _disconnectRealtimeSession() {
    _clearRealtimeCallbacks();
    WebSocketService.instance.disconnect();
  }

  Future<void> login(String email, String password) async {
    final authGeneration = _beginAuthOperation();
    _isDevBypassSession = false;
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final data = await _sessionClient.login(email, password);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _activateSessionToken(
        data['access_token'] as String,
        authGeneration,
      );
      if (!_isAuthOperationCurrent(authGeneration)) return;
      final user = _parseUser(data['user'] as Map<String, dynamic>);
      _disconnectRealtimeSession();
      _prepareSessionScopedData();
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(accountStateProvider.notifier).refresh();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      _connectNotificationsWs();
      _startSessionScopedData();
    } on DioException catch (e) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      // Handle beta-completed users: 403 with code='beta_held'
      if (e.response?.statusCode == 403 &&
          e.response?.data is Map &&
          (e.response!.data as Map)['code'] == 'beta_held') {
        final responseData = e.response!.data as Map<String, dynamic>;
        final heldToken = betaHeldAccessTokenFromResponse(responseData);
        if (heldToken != null) {
          await _queueTokenMutation(() async {
            if (!_isAuthOperationCurrent(authGeneration)) return;
            await _sessionClient.saveToken(heldToken);
          });
        }
        if (!_isAuthOperationCurrent(authGeneration)) return;
        final info = BetaLockedInfo.fromJson(responseData);
        _disconnectRealtimeSession();
        _prepareSessionScopedData();
        state = AuthState(betaLocked: info);
        return;
      }
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ?? 'Login failed'
          : 'Login failed';
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
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
    final authGeneration = _beginAuthOperation();
    _isDevBypassSession = false;
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
      if (!_isAuthOperationCurrent(authGeneration)) return;
      final data = response.data as Map<String, dynamic>;
      await _activateSessionToken(
        data['access_token'] as String,
        authGeneration,
      );
      if (!_isAuthOperationCurrent(authGeneration)) return;
      final user = _parseUser(data['user'] as Map<String, dynamic>);
      _disconnectRealtimeSession();
      _prepareSessionScopedData();
      state = AuthState(
        status: user.isProfileComplete
            ? AuthStatus.authenticated
            : AuthStatus.profileIncomplete,
        user: user,
      );
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(accountStateProvider.notifier).refresh();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      _connectNotificationsWs();
      _startSessionScopedData();
    } on DioException catch (e) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ??
                'Registration failed'
          : 'Registration failed';
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Connection error. Check your network.',
      );
    }
  }

  void devBypass(String role) {
    if (!_devAuthEnabled) {
      throw UnsupportedError(
        'Development authentication is disabled. Rebuild with '
        '--dart-define=ENABLE_DEV_AUTH=true to opt in.',
      );
    }

    const clientUser = AuthUser(
      id: '1',
      email: 'maria@test.com',
      fullName: 'Maria Santos',
      nickname: 'Mia',
      role: 'client',
      isProfileComplete: true,
      ageRange: '18_24',
      profileCategory: 'student',
      profileField: 'architecture',
      organization: 'Mapua University',
      printingPreferences: ['plotting_blueprints'],
    );
    final users = {
      'client': clientUser,
      // Legacy alias for older call sites / tests.
      'customer': clientUser,
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
    _beginAuthOperation();
    _isDevBypassSession = true;
    _disconnectRealtimeSession();
    _prepareSessionScopedData();
    state = AuthState(status: AuthStatus.authenticated, user: users[role]!);
    _connectNotificationsWs();
    _startSessionScopedData();
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
    final authGeneration = _authGeneration;
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
      if (!_isAuthOperationCurrent(authGeneration)) return false;
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
      if (!_isAuthOperationCurrent(authGeneration)) return false;
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to update profile',
      );
      return false;
    }
  }

  /// Clears state that belongs to one authenticated identity before a new
  /// identity becomes visible to the widget tree.
  void _prepareSessionScopedData() {
    _ref?.read(checkoutProvider.notifier).reset();
    _ref?.read(addressProvider.notifier).clear();
    _ref?.read(accountStateProvider.notifier).clear();
    try {
      unawaited(
        _ref?.read(notificationsProvider.notifier).clearNotifications(),
      );
    } catch (_) {}
    try {
      _ref?.read(ordersProvider.notifier).clear();
    } catch (_) {}
    _ref?.read(ordersInitialLoadCompleteProvider.notifier).state = false;
    _ref?.read(liveRiderLocationProvider.notifier).state = null;
    _ref?.read(liveLocationSocketHealthProvider.notifier).state =
        LocationSocketHealth.disconnected;
  }

  void _startSessionScopedData() {
    unawaited(_ref?.read(addressProvider.notifier).refreshAddresses());
    unawaited(_ref?.read(ordersProvider.notifier).startSession());
  }

  Future<void> logout() async {
    final authGeneration = _beginAuthOperation();
    final shouldRevokeFcmToken = _manageFcmSession && !_isDevBypassSession;
    _disconnectRealtimeSession();
    _prepareSessionScopedData();
    _ref?.read(tutorialProvider.notifier).resetStateOnly();
    // Reset session-scoped UI flags so they fire again on next login.
    _ref?.read(nextBatchShownThisSessionProvider.notifier).state = false;
    // AuthState() clears everything including betaLocked.
    state = AuthState.unauthenticated();
    await _queueTokenMutation(() async {
      try {
        if (shouldRevokeFcmToken) {
          await _revokeFcmTokenBestEffort();
        }
      } finally {
        await _sessionClient.clearToken();
      }
    });
    if (!_isAuthOperationCurrent(authGeneration)) return;
  }

  Future<void> tryAutoLogin() async {
    final authGeneration = _beginAuthOperation();
    _isDevBypassSession = false;
    final hasToken = await _sessionClient.hasStoredToken();
    if (!_isAuthOperationCurrent(authGeneration)) return;
    if (!hasToken) return;

    try {
      final completion = await _sessionClient.getCompletionState();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      if (completion['accountStatus'] == 'beta_held') {
        _disconnectRealtimeSession();
        _prepareSessionScopedData();
        state = AuthState(betaLocked: BetaLockedInfo.fromJson(completion));
        return;
      }
    } catch (_) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      // Normal customers are not eligible for the held-safe endpoint. Continue
      // with the ordinary profile request before deciding the token is invalid.
    }

    final AuthUser user;
    try {
      user = _parseUser(await _sessionClient.getProfile());
      if (!_isAuthOperationCurrent(authGeneration)) return;
    } catch (_) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _queueTokenMutation(() async {
        if (!_isAuthOperationCurrent(authGeneration)) return;
        try {
          await _revokeFcmTokenBestEffort();
        } finally {
          await _sessionClient.clearToken();
        }
      });
      if (!_isAuthOperationCurrent(authGeneration)) return;
      _disconnectRealtimeSession();
      _prepareSessionScopedData();
      state = AuthState.unauthenticated();
      return;
    }

    if (!_isAuthOperationCurrent(authGeneration)) return;
    try {
      await _queueTokenMutation(() async {
        if (!_isAuthOperationCurrent(authGeneration)) return;
        await _secureFcmRegistration(authGeneration);
      });
    } catch (_) {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _queueTokenMutation(_sessionClient.clearToken);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      _disconnectRealtimeSession();
      _prepareSessionScopedData();
      state = const AuthState(
        errorMessage: 'Could not secure notifications. Please try again.',
      );
      return;
    }
    if (!_isAuthOperationCurrent(authGeneration)) return;
    _disconnectRealtimeSession();
    _prepareSessionScopedData();
    state = AuthState(
      status: user.isProfileComplete
          ? AuthStatus.authenticated
          : AuthStatus.profileIncomplete,
      user: user,
    );
    try {
      await TutorialRepository().syncFromServer(user.tutorialSeenKeys);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(tutorialProvider.notifier).loadFromPrefs();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _ref?.read(accountStateProvider.notifier).refresh();
      if (!_isAuthOperationCurrent(authGeneration)) return;
      _connectNotificationsWs();
      _startSessionScopedData();
    } catch (_) {
      // The identity is already verified. Local tutorial/account bootstrap is
      // retryable and must never erase an otherwise valid session.
    }
  }

  void markBetaCompletionSubmitted() {
    final role = state.user?.role;
    if (state.status != AuthStatus.authenticated ||
        (role != 'client' && role != 'customer')) {
      return;
    }
    _beginAuthOperation();
    _disconnectRealtimeSession();
    state = state.copyWith(betaCompletionJustSubmitted: true);
  }

  Future<void> refreshProfile() async {
    if (state.status == AuthStatus.unauthenticated) return;
    final authGeneration = _authGeneration;
    final userId = state.user?.id;

    try {
      final user = _parseUser(await _sessionClient.getProfile());
      if (!_isAuthOperationCurrent(authGeneration) ||
          state.status == AuthStatus.unauthenticated ||
          state.user?.id != userId) {
        return;
      }
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
    _removeCreditsUpdateListener ??= WebSocketService.instance
        .listenForCreditsUpdate(_handleCreditsUpdate);
    unawaited(WebSocketService.instance.connectNotifications());
    // Listen for real-time survey-required events so the survey gate activates
    // without the user needing to refresh or re-login.
    _removeSurveyRequiredListener ??= WebSocketService.instance
        .listenForSurveyRequired((_) {
          _ref?.read(accountStateProvider.notifier).refresh();
        });
    // The orders provider owns reconnect subscriptions. Auth only ensures the
    // authenticated namespace is available.
    unawaited(WebSocketService.instance.connectOrders());
    try {
      _ref?.read(notificationsProvider.notifier).refreshNotifications();
    } catch (_) {}
    try {
      _ref?.read(ordersProvider.notifier).refreshOrders();
    } catch (_) {}
  }

  void _handleCreditsUpdate(Map<String, dynamic> data) {
    final credits = data['credits']?.toString();
    if (credits != null && credits.isNotEmpty && state.user != null) {
      state = state.copyWith(user: state.user!.copyWith(credits: credits));
    }
  }

  Future<void> _activateSessionToken(String token, int authGeneration) async {
    await _queueTokenMutation(() async {
      if (!_isAuthOperationCurrent(authGeneration)) return;
      await _sessionClient.saveToken(token);
      if (!_isAuthOperationCurrent(authGeneration)) return;
      try {
        await _secureFcmRegistration(authGeneration);
      } catch (_) {
        await _sessionClient.clearToken();
        rethrow;
      }
    });
  }

  Future<void> _refreshFcmToken(int authGeneration) async {
    try {
      await _queueTokenMutation(() async {
        if (!_isAuthOperationCurrent(authGeneration)) return;
        await _secureFcmRegistration(authGeneration);
      });
    } catch (_) {
      // A failed refresh has already attempted fail-closed local invalidation.
    }
  }

  /// A normal return means that this installation token either belongs to the
  /// current account or has been invalidated locally. If the auth operation
  /// changed while registration was in flight, compensate before the next
  /// queued session mutation can run.
  Future<void> _secureFcmRegistration(int authGeneration) async {
    if (!_manageFcmSession) return;
    try {
      await _fcmSessionClient.registerCurrentToken();
    } catch (_) {
      // Registration failures are safe only when local delivery is actually
      // invalidated. Let invalidation failures abort the new auth session.
      await _fcmSessionClient.invalidateLocalToken();
    }
    if (!_isAuthOperationCurrent(authGeneration)) {
      await _revokeFcmTokenBestEffort();
    }
  }

  Future<void> _revokeFcmTokenBestEffort() async {
    if (!_manageFcmSession) return;
    try {
      await _fcmSessionClient.revokeCurrentToken();
    } catch (_) {
      await _invalidateFcmTokenBestEffort();
    }
  }

  Future<void> _invalidateFcmTokenBestEffort() async {
    try {
      await _fcmSessionClient.invalidateLocalToken();
    } catch (_) {
      // Logout/authentication must remain available while FCM is unavailable.
    }
  }

  /// Prefer marketplace role strings; keep legacy values as-is for dual-read.
  static String _normalizeRole(String? raw) {
    switch (raw) {
      case 'client':
      case 'supplier':
      case 'rider':
      case 'ops_admin':
      case 'super_admin':
      case 'customer':
      case 'admin':
        return raw!;
      default:
        return 'client';
    }
  }

  AuthUser _parseUser(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'].toString(),
      email: json['email'] as String,
      fullName: (json['fullName'] as String?) ?? '',
      role: _normalizeRole(json['role'] as String?),
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
      clientAccountType:
          (json['clientAccountType'] ?? json['client_account_type']) as String?,
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
      case 'gridcredit':
      case 'pilotcredit':
      case 'pilotcredits':
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
