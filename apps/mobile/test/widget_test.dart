import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:printing_app/app.dart';

void main() {
  testWidgets('App renders smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));

    // Splash screen should show GRIDGO text after initial animation delay
    await tester.pump(const Duration(seconds: 2));
    expect(find.textContaining('GRID'), findsWidgets);

    // Pump remaining splash animation timers so they don't leak.
    // The splash has ~3.5s of animations total; pump generously.
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(seconds: 5));

    // Note: Full navigation testing (splash -> login) requires mocking
    // TokenStorage and ApiClient, which is beyond this smoke test scope.
  });
}
