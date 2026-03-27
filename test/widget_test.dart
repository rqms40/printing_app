import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:printing_app/app.dart';

void main() {
  testWidgets('App renders smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));

    // Splash screen should show GRID text
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('GRID'), findsOneWidget);

    // After splash completes, login screen appears
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('Welcome'), findsWidgets);
  });
}
