import 'dart:async';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../firebase_options.dart';
import 'package:printing_app/features/customer/notifications/notification_route.dart';

/// Top-level background message handler (must be top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint('Background message: ${message.notification?.title}');
  // Data-only messages (delivery journey updates) are invisible unless the
  // app renders them; notification-payload messages are already shown by
  // the system in the background, so rendering those again would duplicate.
  if (message.notification == null) {
    await NotificationService.displayRemoteMessage(message);
  }
}

/// How an incoming push should be displayed: which channel it belongs to,
/// whether it carries journey progress, and any attached picture.
@immutable
class NotificationRenderSpec {
  const NotificationRenderSpec({
    required this.id,
    required this.title,
    required this.body,
    required this.channelId,
    required this.channelName,
    required this.channelDescription,
    this.progressCurrent,
    this.progressTotal,
    this.imageUrl,
  });

  final int id;
  final String title;
  final String body;
  final String channelId;
  final String channelName;
  final String channelDescription;
  final int? progressCurrent;
  final int? progressTotal;
  final String? imageUrl;

  bool get hasProgress =>
      progressCurrent != null && progressTotal != null && progressTotal! > 0;
}

/// Maps a push payload to its render spec. Returns null when there is
/// nothing displayable (no title and no body anywhere in the message).
///
/// Contract with the server:
/// - delivery pushes are data-only: `type=delivery_status`, `title`, `body`,
///   `orderId`, optional `progressCurrent`/`progressTotal` (journey stage);
/// - marketing pushes carry `type=marketing` and an optional `imageUrl`.
NotificationRenderSpec? renderSpecForMessage({
  required Map<String, dynamic> data,
  String? notificationTitle,
  String? notificationBody,
}) {
  final title = notificationTitle ?? data['title'] as String?;
  final body = notificationBody ?? data['body'] as String?;
  if (title == null && body == null) return null;

  final type = data['type'] as String?;
  final orderId = data['orderId'] as String?;

  final (channelId, channelName, channelDescription) = switch (type) {
    'delivery_status' => (
      'gridgo_delivery',
      'Delivery updates',
      'Live progress of your print deliveries',
    ),
    'marketing' => (
      'gridgo_marketing',
      'Offers & news',
      'Promotions and announcements from GRIDGO',
    ),
    _ => ('gridgo_general', 'General', 'Everything else from GRIDGO'),
  };

  // One evolving notification per order (Grab-style journey card); anything
  // else gets its own entry.
  final id = type == 'delivery_status' && orderId != null
      ? orderId.hashCode
      : DateTime.now().millisecondsSinceEpoch.remainder(1 << 31);

  return NotificationRenderSpec(
    id: id,
    title: title ?? '',
    body: body ?? '',
    channelId: channelId,
    channelName: channelName,
    channelDescription: channelDescription,
    progressCurrent: int.tryParse(data['progressCurrent']?.toString() ?? ''),
    progressTotal: int.tryParse(data['progressTotal']?.toString() ?? ''),
    imageUrl: data['imageUrl'] as String?,
  );
}

/// FCM notification service — handles push notification setup and permissions.
///
/// Gracefully degrades on platforms that don't support FCM (e.g. Linux desktop)
/// by catching initialization errors and logging them.
class NotificationService {
  static final _messaging = FirebaseMessaging.instance;

  static final _messageController =
      StreamController<Map<String, dynamic>>.broadcast();
  static Stream<Map<String, dynamic>> get messageStream =>
      _messageController.stream;
  static final _tokenRefreshController = StreamController<String>.broadcast();
  static Stream<String> get tokenRefreshStream =>
      _tokenRefreshController.stream;
  static final _routeController = StreamController<String>.broadcast();
  static Stream<String> get routeStream => _routeController.stream;
  static String? _pendingRoute;

  static void handleNotificationTap(Map<String, dynamic> data) {
    final route = riderMessageRouteForPayload(data);
    if (route == null) return;
    if (_routeController.hasListener) {
      _routeController.add(route);
    } else {
      _pendingRoute = route;
    }
  }

  static String? takePendingRoute() {
    final route = _pendingRoute;
    _pendingRoute = null;
    return route;
  }

  static void retainPendingRoute(String route) {
    _pendingRoute = route;
  }

  static const _pendingTokenDeletionKey = 'fcm_token_deletion_pending';
  static StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  static Future<void> _tokenDeletionTail = Future<void>.value();
  static int _tokenDeletionGeneration = 0;
  static int _completedTokenDeletionGeneration = 0;
  static Future<bool>? _initializationFuture;
  static bool _backgroundHandlerRegistered = false;
  static bool _messageListenersInstalled = false;

  static String _tokenLifecycleLog(String event, String? token) {
    final availability = token == null || token.isEmpty
        ? 'unavailable'
        : 'available';
    return 'FCM token $event ($availability)';
  }

  @visibleForTesting
  static String tokenLifecycleLogForTest(String event, String? token) =>
      _tokenLifecycleLog(event, token);

  /// Whether FCM was successfully initialized.
  static bool _initialized = false;

  static final _localNotifications = FlutterLocalNotificationsPlugin();
  static bool _localNotificationsReady = false;

  /// GRIDGO brand yellow — accents the small icon and progress bar.
  static const _brandColor = Color(0xFFFFDE58);

  static Future<void> _ensureLocalNotifications() async {
    if (_localNotificationsReady) return;
    await _localNotifications.initialize(
      const InitializationSettings(
        // White dot-grid silhouette; Android tints it with the accent color.
        android: AndroidInitializationSettings('ic_notification'),
      ),
    );
    _localNotificationsReady = true;
  }

  /// Renders an FCM message as a system notification.
  ///
  /// Used for foreground messages (Android never shows those on its own) and
  /// for background data-only delivery updates.
  static Future<void> displayRemoteMessage(RemoteMessage message) async {
    final spec = renderSpecForMessage(
      data: message.data,
      notificationTitle: message.notification?.title,
      notificationBody: message.notification?.body,
    );
    if (spec == null) return;

    try {
      await _ensureLocalNotifications();

      AndroidBitmap<Object>? picture;
      final imageUrl = spec.imageUrl ?? message.notification?.android?.imageUrl;
      if (imageUrl != null && imageUrl.isNotEmpty) {
        picture = await _downloadBitmap(imageUrl);
      }

      final android = AndroidNotificationDetails(
        spec.channelId,
        spec.channelName,
        channelDescription: spec.channelDescription,
        importance: Importance.high,
        priority: Priority.high,
        color: _brandColor,
        showProgress: spec.hasProgress,
        maxProgress: spec.progressTotal ?? 0,
        progress: spec.progressCurrent ?? 0,
        onlyAlertOnce: spec.hasProgress,
        styleInformation: picture != null
            ? BigPictureStyleInformation(
                picture,
                contentTitle: spec.title,
                summaryText: spec.body,
              )
            : BigTextStyleInformation(spec.body, contentTitle: spec.title),
      );

      await _localNotifications.show(
        spec.id,
        spec.title,
        spec.body,
        NotificationDetails(android: android),
      );
    } catch (e) {
      debugPrint('Failed to display notification: $e');
    }
  }

  static Future<AndroidBitmap<Object>?> _downloadBitmap(String url) async {
    try {
      final client = HttpClient();
      try {
        final request = await client.getUrl(Uri.parse(url));
        final response = await request.close().timeout(
          const Duration(seconds: 8),
        );
        if (response.statusCode != 200) return null;
        final bytes = await consolidateHttpClientResponseBytes(response);
        return ByteArrayAndroidBitmap(bytes);
      } finally {
        client.close(force: true);
      }
    } catch (e) {
      debugPrint('Notification image download failed: $e');
      return null;
    }
  }

  /// Initialize Firebase + request notification permissions.
  /// Call once at app startup.
  static Future<void> init() async {
    // FCM on web requires a secure context (HTTPS). Skip when running over
    // plain HTTP (e.g. local LAN dev server) to avoid unsupported-browser errors.
    if (kIsWeb) {
      debugPrint('FCM: skipped on web (requires HTTPS)');
      return;
    }

    try {
      // Check if Firebase is already initialized
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
      debugPrint('Firebase initialized successfully');
    } catch (e) {
      debugPrint('Firebase init skipped on this platform: $e');
      return;
    }

    _listenForDeletionRetryConnectivity();

    if (!_backgroundHandlerRegistered) {
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );
      _backgroundHandlerRegistered = true;
    }

    if (await _hasPendingTokenDeletion()) {
      if (!await _retryPendingTokenDeletion()) return;
    }

    await _ensureMessagingInitialized();
  }

  static Future<bool> _ensureMessagingInitialized({
    bool announceCurrentToken = false,
  }) async {
    if (!_initialized) {
      var initialization = _initializationFuture;
      if (initialization == null) {
        initialization = _initializeMessaging();
        _initializationFuture = initialization;
      }

      final initialized = await initialization;
      if (identical(_initializationFuture, initialization)) {
        _initializationFuture = null;
      }
      if (!initialized) return false;
    }

    if (!announceCurrentToken) return true;

    try {
      final token = await _messaging.getToken();
      if (token != null && token.isNotEmpty) {
        _tokenRefreshController.add(token);
      }
      return true;
    } catch (e) {
      debugPrint('FCM token recovery failed: $e');
      return false;
    }
  }

  static Future<bool> _initializeMessaging() async {
    try {
      // Request permission (iOS/Android 13+)
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        debugPrint('FCM: Notification permission granted');
      } else {
        debugPrint('FCM: Notification permission denied');
      }

      // Get FCM token
      final token = await _messaging.getToken();
      debugPrint(_tokenLifecycleLog('acquired', token));

      if (!_messageListenersInstalled) {
        // Listen for foreground messages. Android never surfaces these on
        // its own, so render them as system notifications too.
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          final payload = <String, dynamic>{
            ...message.data,
            if (message.notification?.title != null)
              'title': message.notification!.title,
            if (message.notification?.body != null)
              'body': message.notification!.body,
          };
          _messageController.add(payload);
          unawaited(displayRemoteMessage(message));
          debugPrint('Foreground FCM: ${message.notification?.title}');
        });

        // Listen for notification taps (app was in background)
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('Notification tapped: ${message.notification?.title}');
          handleNotificationTap(message.data);
        });

        // Listen for token refresh
        _messaging.onTokenRefresh.listen((newToken) {
          debugPrint(_tokenLifecycleLog('refreshed', newToken));
          _tokenRefreshController.add(newToken);
        });
        _messageListenersInstalled = true;
      }

      _initialized = true;
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        handleNotificationTap(initialMessage.data);
      }
      return true;
    } catch (e) {
      debugPrint('FCM setup failed (platform may not support FCM): $e');
      return false;
    }
  }

  /// Get the current FCM token (to send to server for targeted notifications).
  /// Returns null if FCM is not initialized or not supported on this platform.
  static Future<String?> getToken() async {
    if (kIsWeb && !_initialized) return null;
    if (!await _ensureTokenReady()) return null;
    try {
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('Failed to get FCM token: $e');
      return null;
    }
  }

  /// Invalidates this app installation's current token. The server-side
  /// ownership is revoked separately while the user's access token is valid.
  static Future<void> deleteToken() async {
    // Plain-HTTP web deliberately never initializes FCM, so there cannot be a
    // browser token to invalidate. Native retrieval failures still fall
    // through and attempt deletion even when getToken() returned null.
    if (kIsWeb && !_initialized) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_pendingTokenDeletionKey);
      return;
    }
    try {
      await _enqueueTokenDeletion();
    } catch (e) {
      debugPrint('Failed to delete FCM token: $e');
      rethrow;
    }
  }

  static Future<void> markTokenRegistered() async {
    _completedTokenDeletionGeneration = _tokenDeletionGeneration;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_pendingTokenDeletionKey);
  }

  @visibleForTesting
  static void emitTokenRefreshForTest(String token) {
    _tokenRefreshController.add(token);
  }

  static Future<bool> _hasPendingTokenDeletion() async {
    if (_completedTokenDeletionGeneration < _tokenDeletionGeneration) {
      return true;
    }
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_pendingTokenDeletionKey) ?? false;
  }

  static void _listenForDeletionRetryConnectivity() {
    _connectivitySub ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((result) => result != ConnectivityResult.none)) {
        unawaited(_resumeAfterPendingDeletion());
      }
    });
  }

  static Future<bool> _retryPendingTokenDeletion({
    Future<void> Function()? deleteAction,
  }) async {
    if (!await _hasPendingTokenDeletion()) {
      await _awaitTokenDeletionQuiescence();
      return !await _hasPendingTokenDeletion();
    }
    Object? deletionError;
    try {
      await _enqueueTokenDeletion(deleteAction: deleteAction);
    } catch (e) {
      deletionError = e;
    }
    await _awaitTokenDeletionQuiescence();
    if (await _hasPendingTokenDeletion()) {
      debugPrint(
        'FCM token deletion retry failed: '
        '${deletionError ?? 'a newer deletion request is still pending'}',
      );
      return false;
    }
    return true;
  }

  static Future<void> _awaitTokenDeletionQuiescence() async {
    while (true) {
      final observedGeneration = _tokenDeletionGeneration;
      final observedTail = _tokenDeletionTail;
      await observedTail;
      if (observedGeneration == _tokenDeletionGeneration &&
          identical(observedTail, _tokenDeletionTail)) {
        return;
      }
    }
  }

  static Future<bool> _resumeAfterPendingDeletion({
    Future<void> Function()? deleteAction,
    Future<void> Function()? initializeAction,
  }) async {
    if (!await _retryPendingTokenDeletion(deleteAction: deleteAction)) {
      return false;
    }
    if (initializeAction != null) {
      await initializeAction();
      return true;
    }
    return _ensureMessagingInitialized(announceCurrentToken: true);
  }

  static Future<bool> _ensureTokenReady({
    Future<bool> Function()? hasPendingDeletion,
    Future<bool> Function()? resumeDeletion,
    Future<bool> Function()? initializeMessaging,
  }) async {
    final hasPending = await (hasPendingDeletion ?? _hasPendingTokenDeletion)();
    if (hasPending &&
        !await (resumeDeletion ?? _resumeAfterPendingDeletion)()) {
      return false;
    }
    return (initializeMessaging ?? _ensureMessagingInitialized)();
  }

  static Future<void> _enqueueTokenDeletion({
    Future<void> Function()? deleteAction,
  }) {
    final deletionGeneration = ++_tokenDeletionGeneration;
    final previousDeletion = _tokenDeletionTail;
    final queueSlot = Completer<void>();
    _tokenDeletionTail = queueSlot.future;

    return _runQueuedTokenDeletion(
      deletionGeneration: deletionGeneration,
      previousDeletion: previousDeletion,
      queueSlot: queueSlot,
      deleteAction: deleteAction,
    );
  }

  static Future<void> _runQueuedTokenDeletion({
    required int deletionGeneration,
    required Future<void> previousDeletion,
    required Completer<void> queueSlot,
    Future<void> Function()? deleteAction,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_pendingTokenDeletionKey, true);
      await previousDeletion;
      try {
        await (deleteAction ?? _deleteTokenNow).call();
      } on FirebaseException catch (error) {
        // iOS Simulator has no APNs token. In that state there is no FCM
        // token to revoke, so retaining a failed deletion blocks sign-in.
        if (error.code != 'apns-token-not-set') rethrow;
        debugPrint('FCM token deletion skipped: APNs token is unavailable.');
      }
      if (deletionGeneration == _tokenDeletionGeneration) {
        _completedTokenDeletionGeneration = deletionGeneration;
        await prefs.remove(_pendingTokenDeletionKey);
      }
    } finally {
      queueSlot.complete();
    }
  }

  static Future<void> _deleteTokenNow() async {
    await _messaging.deleteToken();
  }

  @visibleForTesting
  static Future<void> markTokenDeletionPendingForTest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pendingTokenDeletionKey, true);
  }

  @visibleForTesting
  static Future<bool> hasPendingTokenDeletionForTest() =>
      _hasPendingTokenDeletion();

  @visibleForTesting
  static Future<bool> retryPendingTokenDeletionForTest(
    Future<void> Function() deleteAction,
  ) => _retryPendingTokenDeletion(deleteAction: deleteAction);

  @visibleForTesting
  static Future<bool> resumeAfterPendingDeletionForTest(
    Future<void> Function() deleteAction,
    Future<void> Function() initializeAction,
  ) => _resumeAfterPendingDeletion(
    deleteAction: deleteAction,
    initializeAction: initializeAction,
  );

  @visibleForTesting
  static Future<bool> requestTokenDeletionForTest(
    Future<void> Function() deleteAction,
  ) async {
    try {
      await _enqueueTokenDeletion(deleteAction: deleteAction);
      return true;
    } catch (_) {
      return false;
    }
  }

  @visibleForTesting
  static Future<bool> ensureTokenReadyForTest({
    required Future<bool> Function() hasPendingDeletion,
    required Future<bool> Function() resumeDeletion,
    required Future<bool> Function() initializeMessaging,
  }) => _ensureTokenReady(
    hasPendingDeletion: hasPendingDeletion,
    resumeDeletion: resumeDeletion,
    initializeMessaging: initializeMessaging,
  );
}
