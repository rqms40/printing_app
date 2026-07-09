import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/home/providers/tam_surveys_feed_provider.dart';
import 'package:printing_app/features/customer/home/screens/home_screen.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/repository/tutorial_repository.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

class _MockDio extends Mock implements Dio {}

class _MockWebSocketService extends Mock implements WebSocketService {
  @override
  Future<void> connectLocation({Function(dynamic)? onLocationUpdate}) async {}
}

/// Pre-seeds tutorial state as fully seen so coach marks/welcome sheets don't
/// intercept tap gestures during widget tests.
class _PreSeenTutorialNotifier extends TutorialNotifier {
  _PreSeenTutorialNotifier() : super(TutorialRepository()) {
    state = TutorialKey.values.toSet();
  }
}

List<Override> _baseTestOverrides() => [
  authProvider.overrideWith((_) {
    final notifier = AuthNotifier(null, true);
    notifier.devBypass('customer');
    return notifier;
  }),
  tutorialProvider.overrideWith((_) => _PreSeenTutorialNotifier()),
  dioProvider.overrideWithValue(_MockDio()),
  webSocketServiceProvider.overrideWithValue(_MockWebSocketService()),
];

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
/// Pre-seeds authProvider with a mock customer so greeting displays a name.
Widget _wrap(
  Widget child, {
  List<Override> overrides = const [],
  TextScaler? textScaler,
}) {
  return ProviderScope(
    overrides: [..._baseTestOverrides(), ...overrides],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      builder: textScaler == null
          ? null
          : (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: textScaler),
              child: child!,
            ),
      home: child,
    ),
  );
}

Widget _wrapRouter(List<Override> overrides) {
  final router = GoRouter(
    initialLocation: '/customer/home',
    routes: [
      GoRoute(path: '/customer/home', builder: (_, _) => const HomeScreen()),
      GoRoute(
        path: '/customer/order/checkout',
        builder: (_, _) => const Scaffold(body: Text('Cart route reached')),
      ),
    ],
  );

  return ProviderScope(
    overrides: [..._baseTestOverrides(), ...overrides],
    child: MaterialApp.router(
      theme: ThemeData(brightness: Brightness.light),
      routerConfig: router,
    ),
  );
}

void main() {
  setUpAll(() async {
    WebSocketService.disableDailyGridSocketForTests = true;
    Hive.init('/tmp/hive_test_home_screen');
    await Hive.openBox('draft_orders');
  });

  tearDownAll(() async {
    WebSocketService.disableDailyGridSocketForTests = false;
    await Hive.close();
  });

  group('HomeScreen', () {
    testWidgets('renders bento grid hero text', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const HomeScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.textContaining('GRIDGO'), findsWidgets);
      expect(find.textContaining('The Daily Grid'), findsOneWidget);
    });

    testWidgets('renders bento grid service tiles', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const HomeScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.textContaining('Paper'), findsWidgets);
      expect(find.textContaining('3D'), findsWidgets);
    });

    testWidgets('renders recent orders section', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const HomeScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Recent Orders'), findsOneWidget);
      expect(find.text('See All'), findsWidgets);
    });

    testWidgets('renders greeting with user name', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const HomeScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Greeting is RichText (time-based + first name only)
      expect(
        find.byWidgetPredicate(
          (w) => w is RichText && w.text.toPlainText().contains('Maria'),
        ),
        findsWidgets,
      );
    });

    testWidgets('hides resume queue card when cart is empty', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrap(const HomeScreen(), overrides: [_emptyCartOverride()]),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Resume your queue'), findsNothing);
    });

    testWidgets('shows resume queue card when cart has items', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrap(
          const HomeScreen(),
          overrides: [
            checkoutProvider.overrideWith(
              (_) => _SeededCartNotifier(
                CheckoutState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
              ),
            ),
          ],
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Resume your queue'), findsOneWidget);
      expect(find.text('1 print job'), findsOneWidget);
      expect(find.text('₱180.00 subtotal'), findsOneWidget);
      expect(find.text('View queue'), findsOneWidget);
    });

    testWidgets('resume queue card exposes button semantics', (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        tester.view.physicalSize = const Size(1080, 3200);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          _wrap(
            const HomeScreen(),
            overrides: [
              checkoutProvider.overrideWith(
                (_) => _SeededCartNotifier(
                  CheckoutState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
                ),
              ),
            ],
          ),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(milliseconds: 500));

        expect(
          tester.getSemantics(
            find.bySemanticsLabel(
              'Resume your queue, 1 print job, ₱180.00 subtotal',
            ),
          ),
          matchesSemantics(
            label: 'Resume your queue, 1 print job, ₱180.00 subtotal',
            isButton: true,
            hasTapAction: true,
          ),
        );
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('resume queue card handles narrow large-text layouts', (
      tester,
    ) async {
      final originalOnError = FlutterError.onError;
      final flutterErrors = <FlutterErrorDetails>[];
      FlutterError.onError = flutterErrors.add;
      addTearDown(() => FlutterError.onError = originalOnError);
      tester.view.physicalSize = const Size(600, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrap(
          const HomeScreen(),
          textScaler: const TextScaler.linear(1.3),
          overrides: [
            checkoutProvider.overrideWith(
              (_) => _SeededCartNotifier(
                CheckoutState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
              ),
            ),
          ],
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      final queueCardOverflows = flutterErrors.where((details) {
        final errorText = details.toString();
        if (!errorText.contains('RenderFlex overflowed')) return false;
        return RegExp(r'home_screen\.dart:(\d+)')
            .allMatches(errorText)
            .map((match) => int.parse(match.group(1)!))
            .any((line) => line >= 300 && line <= 560);
      });

      expect(queueCardOverflows, isEmpty);
      expect(find.text('Resume your queue'), findsOneWidget);
      expect(find.text('1 print job'), findsOneWidget);
      expect(find.text('₱180.00 subtotal'), findsOneWidget);
      expect(find.text('View queue'), findsOneWidget);
    });

    testWidgets('feed header handles narrow layouts without overflowing', (
      tester,
    ) async {
      final originalOnError = FlutterError.onError;
      final flutterErrors = <FlutterErrorDetails>[];
      FlutterError.onError = flutterErrors.add;
      tester.view.physicalSize = const Size(320, 2200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      try {
        await tester.pumpWidget(
          _wrap(const HomeScreen(), overrides: [_feedOverride()]),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump(const Duration(milliseconds: 500));
      } finally {
        FlutterError.onError = originalOnError;
      }

      final feedHeaderOverflows = flutterErrors.where((details) {
        final errorText = details.toString();
        if (!errorText.contains('RenderFlex overflowed')) return false;
        return RegExp(r'home_screen\.dart:(\d+)')
            .allMatches(errorText)
            .map((match) => int.parse(match.group(1)!))
            .any((line) => line >= 1600 && line <= 1650);
      });

      expect(feedHeaderOverflows, isEmpty);
      expect(find.text('Community feedback.'), findsOneWidget);
    });

    testWidgets('tapping resume queue card opens cart screen', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrapRouter([
          checkoutProvider.overrideWith(
            (_) => _SeededCartNotifier(
              CheckoutState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
            ),
          ),
        ]),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Resume your queue'));
      await tester.pumpAndSettle();

      expect(find.text('Cart route reached'), findsOneWidget);
    });
  });
}

Override _feedOverride() {
  return feedSurveysProvider.overrideWith((_) async => const []);
}

Override _emptyCartOverride() {
  return checkoutProvider.overrideWith(
    (_) => _SeededCartNotifier(const CheckoutState()),
  );
}

class _SeededCartNotifier extends CheckoutNotifier {
  _SeededCartNotifier(CheckoutState initial) : super() {
    state = initial;
  }
}

CartItem _cartItem({required int quantity, required double unitPrice}) {
  return CartItem(
    id: 'cart-home-test',
    category: 'paper',
    fileName: 'proposal.pdf',
    fileMetadataId: 42,
    paperSpecs: const PaperSpecs(
      paperSize: PaperSize.a4,
      colorMode: ColorMode.fullColor,
      mediaType: MediaType.matte,
      printSides: PrintSides.backToBack,
      binding: Binding.spiral,
    ),
    quantity: quantity,
    pageCount: 10,
    unitPrice: unitPrice,
    createdAt: DateTime(2026, 4, 25),
  );
}
