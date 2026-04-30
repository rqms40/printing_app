import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';

void main() {
  group('AccountState', () {
    test('parses active response', () {
      final state = AccountState.fromJson({
        'accountStatus': 'active',
        'holds': <dynamic>[],
      });

      expect(state.status, AccountGateStatus.active);
      expect(state.holds, isEmpty);
      expect(state.requiredSurveyHold, isNull);
    });

    test('parses survey required response', () {
      final state = AccountState.fromJson({
        'accountStatus': 'survey_required',
        'holds': [
          {
            'type': 'post_delivery_survey',
            'requirementId': 123,
            'orderId': 55,
            'orderRef': 'ORD-10055',
            'requiredAt': '2026-04-30T12:00:00.000Z',
          },
        ],
      });

      expect(state.status, AccountGateStatus.surveyRequired);
      expect(state.requiredSurveyHold?.requirementId, 123);
      expect(state.requiredSurveyHold?.orderRef, 'ORD-10055');
    });

    test('maps unknown account status to unknown', () {
      final state = AccountState.fromJson({
        'accountStatus': 'unexpected_status',
        'holds': <dynamic>[],
      });

      expect(state.status, AccountGateStatus.unknown);
    });

    test('maps missing account status to unknown', () {
      final state = AccountState.fromJson({'holds': <dynamic>[]});

      expect(state.status, AccountGateStatus.unknown);
    });
  });

  group('AccountStateNotifier', () {
    test(
      'keeps unknown state when refresh fails without a known hold',
      () async {
        final notifier = AccountStateNotifier(
          fetchAccountState: () => throw Exception('network failed'),
        );

        await notifier.refresh();

        expect(notifier.state.status, AccountGateStatus.unknown);
        expect(notifier.state.holds, isEmpty);
        expect(notifier.state.isLoading, isFalse);
      },
    );

    test('preserves survey required state when refresh fails', () async {
      var callCount = 0;
      final notifier = AccountStateNotifier(
        fetchAccountState: () async {
          callCount += 1;
          if (callCount == 1) {
            return {
              'accountStatus': 'survey_required',
              'holds': [
                {
                  'type': 'post_delivery_survey',
                  'requirementId': 123,
                  'orderId': 55,
                  'orderRef': 'ORD-10055',
                  'requiredAt': '2026-04-30T12:00:00.000Z',
                },
              ],
            };
          }
          throw Exception('network failed');
        },
      );

      await notifier.refresh();
      final hold = notifier.state.requiredSurveyHold;

      await notifier.refresh();

      expect(notifier.state.status, AccountGateStatus.surveyRequired);
      expect(notifier.state.requiredSurveyHold, same(hold));
      expect(notifier.state.isLoading, isFalse);
    });
  });
}
