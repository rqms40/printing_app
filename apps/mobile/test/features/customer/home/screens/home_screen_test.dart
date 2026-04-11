import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/home/screens/home_screen.dart';

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
/// Pre-seeds authProvider with a mock customer so greeting displays a name.
Widget _wrap(Widget child) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((_) {
        final notifier = AuthNotifier();
        notifier.devBypass('customer'); // sets fullName to 'Maria Santos'
        return notifier;
      }),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  setUpAll(() async {
    Hive.init('/tmp/hive_test_home_screen');
    await Hive.openBox('draft_orders');
  });

  tearDownAll(() async {
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
        find.byWidgetPredicate((w) =>
            w is RichText && w.text.toPlainText().contains('Maria')),
        findsWidgets,
      );
    });
  });
}
