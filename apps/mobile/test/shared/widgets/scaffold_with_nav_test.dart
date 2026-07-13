import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/app_bottom_nav.dart';
import 'package:printing_app/shared/widgets/scaffold_with_nav.dart';

void main() {
  testWidgets('labels the rider quick-actions button', (tester) async {
    final semantics = tester.ensureSemantics();
    const items = [
      NavItem(icon: Icons.home, activeIcon: Icons.home, label: 'Home'),
      NavItem(icon: Icons.list, activeIcon: Icons.list, label: 'Orders'),
      NavItem(
        icon: Icons.notifications,
        activeIcon: Icons.notifications,
        label: 'Alerts',
      ),
      NavItem(icon: Icons.person, activeIcon: Icons.person, label: 'Profile'),
    ];
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: ScaffoldWithNav(
            currentIndex: 1,
            items: items,
            onTap: (_) {},
            showFab: true,
            navStyle: AppBottomNavStyle.riderCockpit,
            quickActions: kRiderQuickActions,
            child: const SizedBox.expand(),
          ),
        ),
      ),
    );

    final control = find.bySemanticsLabel('Open rider quick actions');
    expect(control, findsOneWidget);
    expect(
      tester
          .getSemantics(control)
          .getSemanticsData()
          .hasAction(ui.SemanticsAction.tap),
      isTrue,
    );
    semantics.dispose();
  });
}
