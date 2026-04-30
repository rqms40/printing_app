import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';
import 'package:printing_app/shared/services/api_client.dart';

class _FakeAccountStateNotifier extends AccountStateNotifier {
  _FakeAccountStateNotifier() {
    state = AccountState(
      status: AccountGateStatus.surveyRequired,
      holds: [
        SurveyRequirementHold(
          requirementId: 123,
          orderId: 55,
          orderRef: 'ORD-10055',
          requiredAt: DateTime.utc(2026, 4, 30, 12),
        ),
      ],
    );
  }

  @override
  Future<void> refresh() async {}
}

class _TestAuthNotifier extends AuthNotifier {
  var logoutCalls = 0;

  @override
  Future<void> logout() async {
    logoutCalls += 1;
  }
}

Widget _wrap({_TestAuthNotifier? authNotifier}) {
  return ProviderScope(
    overrides: [
      accountStateProvider.overrideWith((ref) => _FakeAccountStateNotifier()),
      if (authNotifier != null)
        authProvider.overrideWith((ref) => authNotifier),
    ],
    child: const MaterialApp(home: RequiredTamSurveyScreen()),
  );
}

Widget _wrapWithRouter(_TestAuthNotifier authNotifier) {
  final router = GoRouter(
    initialLocation: '/required',
    routes: [
      GoRoute(
        path: '/required',
        builder: (_, _) => const RequiredTamSurveyScreen(),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (_, _) => const Scaffold(body: Text('Login Screen')),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      accountStateProvider.overrideWith((ref) => _FakeAccountStateNotifier()),
      authProvider.overrideWith((ref) => authNotifier),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic>? lastSurveyPayload;
  String? lastSurveyPath;
  Interceptor? apiInterceptor;

  setUpAll(() {
    const secureStorageChannel = MethodChannel(
      'plugins.it_nomads.com/flutter_secure_storage',
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorageChannel, (_) async => null);

    ApiClient.instance.init(baseUrl: 'http://mock-test/api');
    apiInterceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/tam-surveys/requirements/123/submit') {
          lastSurveyPath = options.path;
          lastSurveyPayload = Map<String, dynamic>.from(options.data as Map);
          handler.resolve(
            Response(requestOptions: options, statusCode: 201, data: {}),
          );
          return;
        }
        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(apiInterceptor!);
  });

  tearDownAll(() {
    final interceptor = apiInterceptor;
    if (interceptor != null) {
      ApiClient.instance.dio.interceptors.remove(interceptor);
    }
  });

  setUp(() {
    lastSurveyPath = null;
    lastSurveyPayload = null;
  });

  group('RequiredTamSurveyScreen', () {
    testWidgets('disables system pop', (tester) async {
      await tester.pumpWidget(_wrap());

      expect(
        find.byWidgetPredicate(
          (widget) => widget is PopScope<dynamic> && widget.canPop == false,
        ),
        findsOneWidget,
      );
    });

    testWidgets('uses the TAM face slider question flow', (tester) async {
      await tester.pumpWidget(_wrap());

      final slider = tester.widget<Slider>(find.byType(Slider));
      expect(slider.min, 0);
      expect(slider.max, 4);
      expect(slider.divisions, 4);
      expect(find.text('NEUTRAL'), findsOneWidget);

      final sliderRect = tester.getRect(find.byType(Slider));
      await tester.tapAt(Offset(sliderRect.right - 8, sliderRect.center.dy));
      await tester.pump();

      expect(find.text('STRONGLY\nAGREE'), findsOneWidget);

      await tester.tap(find.widgetWithText(ElevatedButton, 'Next'));
      await tester.pumpAndSettle();

      expect(find.text('Question 2 of 14'), findsOneWidget);
    });

    testWidgets('submits required survey payload and logs out', (tester) async {
      final authNotifier = _TestAuthNotifier();
      await tester.pumpWidget(_wrapWithRouter(authNotifier));

      for (var i = 0; i < 14; i += 1) {
        await tester.tap(find.widgetWithText(ElevatedButton, 'Next'));
        await tester.pumpAndSettle();
      }

      await tester.enterText(
        find.byType(TextField).at(0),
        'Add saved presets.',
      );
      await tester.enterText(
        find.byType(TextField).at(1),
        'Fast delivery and clear updates.',
      );
      await tester.tap(find.text('Submit Feedback'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(lastSurveyPath, '/tam-surveys/requirements/123/submit');
      expect(lastSurveyPayload?['openForumFeedback'], {
        'feature': 'Add saved presets.',
        'delivery': 'Fast delivery and clear updates.',
      });

      final surveyData = lastSurveyPayload?['surveyData'] as Map?;
      expect(surveyData, hasLength(14));
      expect(surveyData?.values, everyElement(2));

      await tester.pump(const Duration(milliseconds: 1400));
      await tester.pumpAndSettle();

      expect(authNotifier.logoutCalls, 1);
      expect(find.text('Login Screen'), findsOneWidget);
    });
  });
}
