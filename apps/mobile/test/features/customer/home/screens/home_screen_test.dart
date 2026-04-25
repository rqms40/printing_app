import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/cart/screens/cart_screen.dart';
import 'package:printing_app/features/customer/home/screens/home_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
/// Pre-seeds authProvider with a mock customer so greeting displays a name.
Widget _wrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('customer'); // sets fullName to 'Maria Santos'
        return notifier;
      }),
      ...overrides,
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

Widget _wrapRouter(List<Override> overrides) {
  final router = GoRouter(
    initialLocation: '/customer/home',
    routes: [
      GoRoute(path: '/customer/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/customer/cart', builder: (_, _) => const CartScreen()),
    ],
  );

  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('customer');
        return notifier;
      }),
      ...overrides,
    ],
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

      expect(find.textContaining('GRID'), findsWidgets);
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

      await tester.pumpWidget(_wrap(const HomeScreen()));
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
            cartProvider.overrideWith(
              (_) => _SeededCartNotifier(
                CartState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
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

    testWidgets('tapping resume queue card opens cart screen', (tester) async {
      tester.view.physicalSize = const Size(1080, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrapRouter([
          cartProvider.overrideWith(
            (_) => _SeededCartNotifier(
              CartState(items: [_cartItem(quantity: 2, unitPrice: 90)]),
            ),
          ),
        ]),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Resume your queue'));
      await tester.pumpAndSettle();

      expect(find.text('The Queue'), findsWidgets);
      expect(find.text('proposal.pdf'), findsOneWidget);
    });
  });
}

class _SeededCartNotifier extends CartNotifier {
  _SeededCartNotifier(CartState initial) : super() {
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
