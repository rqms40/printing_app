import 'dart:ui' as ui;

import 'package:audioplayers/audioplayers.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';
import 'package:printing_app/features/customer/profile/screens/tam_survey_screen.dart';
import 'package:printing_app/shared/services/api_client.dart';

class _FakeAccountStateNotifier extends AccountStateNotifier {
  _FakeAccountStateNotifier({AccountState? refreshedState})
    : _refreshedState = refreshedState {
    state = _surveyRequiredState(requirementId: 123, orderId: 55);
  }

  final AccountState? _refreshedState;
  var refreshCalls = 0;

  @override
  Future<void> refresh() async {
    refreshCalls += 1;
    if (_refreshedState != null) state = _refreshedState;
  }
}

AccountState _surveyRequiredState({
  required int requirementId,
  required int orderId,
}) {
  return AccountState(
    status: AccountGateStatus.surveyRequired,
    holds: [
      SurveyRequirementHold(
        requirementId: requirementId,
        orderId: orderId,
        orderRef: 'ORD-${10000 + orderId}',
        requiredAt: DateTime.utc(2026, 4, 30, 12),
      ),
    ],
  );
}

class _TestAuthNotifier extends AuthNotifier {
  var logoutCalls = 0;
  var completionSubmittedCalls = 0;
  var refreshProfileCalls = 0;

  @override
  void markBetaCompletionSubmitted() {
    completionSubmittedCalls += 1;
  }

  @override
  Future<void> logout() async {
    logoutCalls += 1;
  }

  @override
  Future<void> refreshProfile() async {
    refreshProfileCalls += 1;
  }
}

Widget _wrap({_TestAuthNotifier? authNotifier}) {
  return ProviderScope(
    overrides: [
      accountStateProvider.overrideWith((ref) => _FakeAccountStateNotifier()),
      ordersProvider.overrideWith((ref) => OrdersNotifier(skipBootstrap: true)),
      if (authNotifier != null)
        authProvider.overrideWith((ref) => authNotifier),
    ],
    child: const MaterialApp(home: RequiredTamSurveyScreen()),
  );
}

Widget _wrapWithRouter(
  _TestAuthNotifier authNotifier, {
  _FakeAccountStateNotifier? accountNotifier,
}) {
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
      GoRoute(
        path: '/customer/beta/success-wall',
        builder: (_, _) => const Scaffold(body: Text('Beta Success Wall')),
      ),
      GoRoute(
        path: '/customer/home',
        builder: (_, _) => const Scaffold(body: Text('Customer Home')),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      accountStateProvider.overrideWith(
        (ref) => accountNotifier ?? _FakeAccountStateNotifier(),
      ),
      ordersProvider.overrideWith((ref) => OrdersNotifier(skipBootstrap: true)),
      authProvider.overrideWith((ref) => authNotifier),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

Future<void> _completeRequiredSurvey(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 700));

  for (var i = 0; i < 14; i += 1) {
    await tester.tap(find.byKey(const ValueKey('tam-flow-next')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
  }

  await tester.tap(find.byKey(const ValueKey('tam-open-forum-submit')));
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic>? lastSurveyPayload;
  String? lastSurveyPath;
  var normalSurveyPostCalls = 0;
  Map<String, dynamic> requiredSurveyResponse = const {};
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
            Response(
              requestOptions: options,
              statusCode: 201,
              data: requiredSurveyResponse,
            ),
          );
          return;
        }
        if (options.path == '/tam-surveys') {
          normalSurveyPostCalls += 1;
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
    normalSurveyPostCalls = 0;
    requiredSurveyResponse = {'logoutRequired': true};
  });

  group('RequiredTamSurveyScreen', () {
    test('maps TAM survey Likert ratings to bundled audio asset sources', () {
      final expectedAssets = {
        LikertScale.stronglyDisagree: 'audio/Strongly_Disagree.wav',
        LikertScale.disagree: 'audio/Disagree.wav',
        LikertScale.neutral: 'audio/Neutral.wav',
        LikertScale.agree: 'audio/Agree.wav',
        LikertScale.stronglyAgree: 'audio/Strongly_Agree.wav',
      };

      for (final entry in expectedAssets.entries) {
        final source = tamSurveySoundSourceFor(entry.key, isWeb: false);

        expect(source, isA<AssetSource>());
        expect((source as AssetSource).path, entry.value);

        final webSource = tamSurveySoundSourceFor(entry.key, isWeb: true);

        expect(webSource, isA<UrlSource>());
        expect((webSource as UrlSource).url, 'assets/assets/${entry.value}');
        expect(webSource.mimeType, 'audio/wav');
      }
    });

    testWidgets('disables system pop', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump(const Duration(seconds: 1));

      expect(
        find.byWidgetPredicate(
          (widget) => widget is PopScope<dynamic> && widget.canPop == false,
        ),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('auto-launches the face-slider flow without overview', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(_wrap());
      // First frame paints the placeholder, the post-frame callback then
      // pushes the face-slider modal route (~450ms transition).
      await tester.pump();
      expect(find.text('Opening your beta feedback survey…'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 700));

      expect(
        find.bySemanticsLabel('Required beta feedback survey'),
        findsOneWidget,
      );
      expect(find.bySemanticsLabel(RegExp('Question 1 of 14')), findsOneWidget);
      final rating = find.bySemanticsLabel(
        RegExp('Feedback rating for question 1'),
      );
      expect(rating, findsOneWidget);
      expect(tester.getSemantics(rating).flagsCollection.isSlider, isTrue);

      final slider = tester.widget<Slider>(find.byType(Slider));
      expect(slider.min, 0);
      expect(slider.max, 4);
      expect(slider.divisions, 4);
      expect(find.text('NEUTRAL'), findsOneWidget);
      expect(find.text('Question 1 of 14'), findsOneWidget);
      final nextControl = find.bySemanticsLabel('Next');
      expect(nextControl, findsOneWidget);
      final nextSemantics = tester.getSemantics(nextControl);
      expect(nextSemantics.flagsCollection.isButton, isTrue);
      expect(
        nextSemantics.getSemanticsData().hasAction(ui.SemanticsAction.tap),
        isTrue,
      );

      final sliderRect = tester.getRect(find.byType(Slider));
      await tester.tapAt(Offset(sliderRect.right - 8, sliderRect.center.dy));
      await tester.pump();

      expect(find.text('STRONGLY\nAGREE'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('tam-flow-next')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));

      expect(find.text('Question 2 of 14'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      semantics.dispose();
    });

    testWidgets('submits required survey payload and opens beta success wall', (
      tester,
    ) async {
      final authNotifier = _TestAuthNotifier();
      await tester.pumpWidget(_wrapWithRouter(authNotifier));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));

      for (var i = 0; i < 14; i += 1) {
        await tester.tap(find.byKey(const ValueKey('tam-flow-next')));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 700));
      }

      final textFields = find.byType(TextField, skipOffstage: false);
      await tester.ensureVisible(textFields.at(0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.bySemanticsLabel(RegExp(r'^Price feedback')), findsOneWidget);
      await tester.enterText(
        textFields.at(0),
        'Yes, the delivery convenience is worth the order price.',
      );

      await tester.ensureVisible(textFields.at(1));
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        find.bySemanticsLabel(RegExp(r'^Upload process feedback')),
        findsOneWidget,
      );
      await tester.enterText(
        textFields.at(1),
        'I nearly left while waiting for the 3D preview.',
      );

      await tester.ensureVisible(textFields.at(2));
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        find.bySemanticsLabel(RegExp(r'^Future feature feedback')),
        findsOneWidget,
      );
      await tester.enterText(textFields.at(2), 'Add saved presets.');

      await tester.ensureVisible(textFields.at(3));
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        find.bySemanticsLabel(RegExp(r'^Additional delivery feedback')),
        findsOneWidget,
      );
      await tester.enterText(
        textFields.at(3),
        'Fast delivery and clear updates.',
      );
      await tester.tap(find.byKey(const ValueKey('tam-open-forum-submit')));
      await tester.pump(const Duration(milliseconds: 100));

      expect(lastSurveyPath, '/tam-surveys/requirements/123/submit');
      expect(normalSurveyPostCalls, 0);
      expect(lastSurveyPayload?['openForumFeedback'], {
        'feature': 'Add saved presets.',
        'delivery': 'Fast delivery and clear updates.',
        'price_value':
            'Yes, the delivery convenience is worth the order price.',
        'upload_friction': 'I nearly left while waiting for the 3D preview.',
      });

      final surveyData = lastSurveyPayload?['surveyData'] as Map?;
      expect(surveyData, hasLength(14));
      expect(surveyData?.values, everyElement(2));

      await tester.pump(const Duration(milliseconds: 1400));
      await tester.pump(const Duration(milliseconds: 500));

      expect(authNotifier.logoutCalls, 0);
      expect(authNotifier.completionSubmittedCalls, 1);
      expect(find.text('Beta Success Wall'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('opens the next pending order survey without holding account', (
      tester,
    ) async {
      requiredSurveyResponse = {'logoutRequired': false};
      final authNotifier = _TestAuthNotifier();
      final accountNotifier = _FakeAccountStateNotifier(
        refreshedState: _surveyRequiredState(requirementId: 124, orderId: 56),
      );

      await tester.pumpWidget(
        _wrapWithRouter(authNotifier, accountNotifier: accountNotifier),
      );
      await _completeRequiredSurvey(tester);
      await tester.pump(const Duration(milliseconds: 700));
      await tester.pump(const Duration(milliseconds: 700));

      expect(lastSurveyPath, '/tam-surveys/requirements/123/submit');
      expect(accountNotifier.refreshCalls, 1);
      expect(authNotifier.completionSubmittedCalls, 0);
      expect(authNotifier.refreshProfileCalls, 0);
      expect(find.text('Question 1 of 14'), findsOneWidget);
      expect(find.text('Beta Success Wall'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('returns home when beta is off and no survey remains', (
      tester,
    ) async {
      requiredSurveyResponse = {'logoutRequired': false};
      final authNotifier = _TestAuthNotifier();
      final accountNotifier = _FakeAccountStateNotifier(
        refreshedState: const AccountState(status: AccountGateStatus.active),
      );

      await tester.pumpWidget(
        _wrapWithRouter(authNotifier, accountNotifier: accountNotifier),
      );
      await _completeRequiredSurvey(tester);
      await tester.pumpAndSettle();

      expect(accountNotifier.refreshCalls, 1);
      expect(authNotifier.completionSubmittedCalls, 0);
      expect(authNotifier.refreshProfileCalls, 1);
      expect(find.text('Customer Home'), findsOneWidget);
      expect(find.text('Beta Success Wall'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
    });
  });
}
