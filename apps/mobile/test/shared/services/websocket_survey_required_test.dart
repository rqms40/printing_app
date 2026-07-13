import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../../helpers/test_setup.dart';

class _SurveyAccountStateNotifier extends AccountStateNotifier {
  _SurveyAccountStateNotifier()
    : super(
        fetchAccountState: () async => {
          'accountStatus': 'survey_required',
          'holds': [
            {
              'requirementId': 71,
              'orderId': 42,
              'orderRef': 'ORD-10042',
              'requiredAt': '2026-07-10T12:00:00.000Z',
            },
          ],
        },
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.stubAudioPlayers();
    TestSetup.initApiClient();
    WebSocketService.disableNotificationsSocketForTests = true;
    WebSocketService.disableOrdersSocketForTests = true;
  });

  setUp(WebSocketService.instance.disconnect);

  tearDown(WebSocketService.instance.disconnect);

  tearDownAll(() {
    WebSocketService.disableNotificationsSocketForTests = false;
    WebSocketService.disableOrdersSocketForTests = false;
  });

  test(
    'survey-required is sourced from the authenticated orders namespace',
    () {
      expect(
        WebSocketService.instance.surveyRequiredNamespaceForTests,
        '/ws/orders',
      );
    },
  );

  test(
    'orders survey-required event activates the mandatory survey gate',
    () async {
      final account = _SurveyAccountStateNotifier();
      final container = ProviderContainer(
        overrides: [
          accountStateProvider.overrideWith((ref) => account),
          authProvider.overrideWith((ref) => AuthNotifier(ref, true)),
        ],
      );
      addTearDown(container.dispose);

      container.read(authProvider.notifier).devBypass('customer');
      expect(
        container.read(accountStateProvider).status,
        AccountGateStatus.unknown,
      );

      WebSocketService.instance.dispatchSurveyRequiredForTests({
        'requirementId': 71,
        'orderId': 42,
        'orderRef': 'ORD-10042',
      });
      await Future<void>.delayed(Duration.zero);

      expect(
        container.read(accountStateProvider).status,
        AccountGateStatus.surveyRequired,
      );
      expect(
        container.read(accountStateProvider).requiredSurveyHold?.orderId,
        42,
      );
    },
  );
}
