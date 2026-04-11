import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../../../firebase_options.dart';

/// Top-level background message handler (must be top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint('Background message: ${message.notification?.title}');
}

/// FCM notification service — handles push notification setup and permissions.
///
/// Gracefully degrades on platforms that don't support FCM (e.g. Linux desktop)
/// by catching initialization errors and logging them.
class NotificationService {
  static final _messaging = FirebaseMessaging.instance;

  static final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  static Stream<Map<String, dynamic>> get messageStream => _messageController.stream;

  /// Whether FCM was successfully initialized.
  static bool _initialized = false;

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

    try {
      // Register background handler
      FirebaseMessaging.onBackgroundMessage(
        _firebaseMessagingBackgroundHandler,
      );

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
      debugPrint('FCM Token: $token');

      // Listen for foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final payload = <String, dynamic>{
          ...message.data,
          if (message.notification?.title != null) 'title': message.notification!.title,
          if (message.notification?.body != null) 'body': message.notification!.body,
        };
        _messageController.add(payload);
        debugPrint('Foreground FCM: ${message.notification?.title}');
      });

      // Listen for notification taps (app was in background)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('Notification tapped: ${message.notification?.title}');
        // Could navigate to relevant screen based on message data
      });

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('FCM Token refreshed: $newToken');
        // Send updated token to server
      });

      _initialized = true;
    } catch (e) {
      debugPrint('FCM setup failed (platform may not support FCM): $e');
    }
  }

  /// Get the current FCM token (to send to server for targeted notifications).
  /// Returns null if FCM is not initialized or not supported on this platform.
  static Future<String?> getToken() async {
    if (!_initialized) return null;
    try {
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('Failed to get FCM token: $e');
      return null;
    }
  }
}
