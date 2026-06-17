import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/home/widgets/rider_resume_active_card.dart';

void main() {
  testWidgets('shows order ref and stop count', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: RiderResumeActiveCard(
            orderRef: 'ORD-10005',
            stopCount: 3,
            onTap: _noop,
          ),
        ),
      ),
    );
    expect(find.textContaining('ORD-10005'), findsOneWidget);
    expect(find.textContaining('3'), findsWidgets);
  });
}

void _noop() {}
