import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';

class _TestAuthNotifier extends AuthNotifier {
  int completeProfileCalls = 0;
  Map<String, dynamic>? lastProfilePayload;

  @override
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
    completeProfileCalls += 1;
    lastProfilePayload = {
      'fullName': fullName,
      'nickname': nickname,
      'phone': phone,
      'gender': gender,
      'ageRange': ageRange,
      'profileCategory': profileCategory,
      'profileField': profileField,
      'course': course,
      'organization': organization,
      'printingPreferences': printingPreferences,
    };
    return true;
  }
}

Widget _wrap(Widget child, {_TestAuthNotifier? notifier}) {
  const user = AuthUser(
    id: '1',
    email: 'maria@test.com',
    fullName: 'Maria Santos',
    nickname: 'Mia',
    role: 'customer',
    isProfileComplete: true,
    gender: 'Prefer not to say',
    ageRange: '25_34',
    profileCategory: 'student',
    profileField: 'architecture',
    course: 'BS Architecture',
    organization: 'Mapua University',
    printingPreferences: ['plotting_blueprints'],
  );

  return ProviderScope(
    overrides: [
      profileProvider.overrideWith((ref) => user),
      if (notifier != null) authProvider.overrideWith((ref) => notifier),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('AccountDetailsScreen', () {
    testWidgets('renders nickname and age-range controls alongside profiling', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const AccountDetailsScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Account Details'), findsOneWidget);
      expect(find.text('Nickname'), findsOneWidget);
      expect(find.text('Age Range'), findsOneWidget);
      expect(find.text('25–34'), findsOneWidget);
      expect(find.text('Tell us a bit about yourself'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Professional'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('submits nickname and age range when saving changes', (
      tester,
    ) async {
      final notifier = _TestAuthNotifier();

      await tester.pumpWidget(
        _wrap(const AccountDetailsScreen(), notifier: notifier),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.enterText(find.byType(TextField).first, 'Kai');
      await tester.tap(find.text('Save Changes'));
      await tester.pump(const Duration(milliseconds: 600));

      expect(notifier.completeProfileCalls, 1);
      expect(notifier.lastProfilePayload!['nickname'], 'Kai');
      expect(notifier.lastProfilePayload!['ageRange'], '25_34');
    });
  });
}
