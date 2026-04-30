import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';

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
  });
}
