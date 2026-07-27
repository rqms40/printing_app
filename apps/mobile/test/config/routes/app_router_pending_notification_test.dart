import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/app.dart';
import 'package:printing_app/config/routes/app_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../helpers/test_setup.dart';

class _StoredCustomerSession implements AuthSessionClient {
  var profileCalls = 0;

  @override
  Future<bool> hasStoredToken() async => true;

  @override
  Future<Map<String, dynamic>> getCompletionState() async => {
    'accountStatus': 'active',
  };

  @override
  Future<Map<String, dynamic>> getProfile() async {
    profileCalls += 1;
    return {
      'id': 7,
      'email': 'customer@example.com',
      'fullName': 'Customer',
      'role': 'customer',
      'isProfileComplete': true,
      'tutorialSeenKeys': ['onboarding'],
      'printingPreferences': <String>[],
    };
  }

  @override
  Future<void> clearToken() async {}

  @override
  Future<Map<String, dynamic>> login(String email, String password) =>
      throw UnimplementedError();

  @override
  Future<void> saveToken(String token) async {}
}

class _NoopFcmSession implements FcmSessionClient {
  @override
  Future<void> invalidateLocalToken() async {}

  @override
  Future<void> registerCurrentToken() async {}

  @override
  Future<void> revokeCurrentToken() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubAudioPlayers();
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
    WebSocketService.disableNotificationsSocketForTests = true;
    WebSocketService.disableOrdersSocketForTests = true;
  });

  tearDownAll(() {
    WebSocketService.disableNotificationsSocketForTests = false;
    WebSocketService.disableOrdersSocketForTests = false;
  });

  testWidgets(
    'stored-session auto-login completes before a cold-start rider chat route',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'tutorial_seen_keys': ['onboarding'],
      });
      final session = _StoredCustomerSession();
      NotificationService.handleNotificationTap({
        'type': 'rider_message',
        'conversationId': '5',
        'conversationType': 'rider',
      });
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith(
            (ref) => AuthNotifier(ref, false, session, _NoopFcmSession()),
          ),
          betaStatusProvider.overrideWith((_) async => null),
          accountStateProvider.overrideWith(
            (_) => AccountStateNotifier(
              fetchAccountState: () async => {'accountStatus': 'active'},
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(container: container, child: const App()),
      );
      expect(find.byType(App), findsOneWidget);

      expect(session.profileCalls, 1);
      expect(container.read(authProvider).status, AuthStatus.authenticated);
      expect(
        container
            .read(routerProvider)
            .routeInformationProvider
            .value
            .uri
            .toString(),
        '/customer/chat/5?type=rider',
      );
      expect(find.text('Login'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      container.dispose();
      await tester.pump(Duration.zero);
    },
  );
}
