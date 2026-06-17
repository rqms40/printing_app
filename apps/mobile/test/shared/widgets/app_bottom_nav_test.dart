import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/app_bottom_nav.dart';

void main() {
  testWidgets(
    'rider cockpit style keeps active label bright and inactive dim',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: Scaffold(
            bottomNavigationBar: AppBottomNav(
              currentIndex: 0,
              showFab: true,
              style: AppBottomNavStyle.riderCockpit,
              onTap: (_) {},
              items: const [
                NavItem(
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home,
                  label: 'Home',
                ),
                NavItem(
                  icon: Icons.receipt_long_outlined,
                  activeIcon: Icons.receipt_long,
                  label: 'Orders',
                ),
                NavItem(
                  icon: Icons.notifications_none,
                  activeIcon: Icons.notifications,
                  label: 'Alerts',
                ),
                NavItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
      );

      final homeLabel = tester.widget<Text>(find.text('Home'));
      final ordersLabel = tester.widget<Text>(find.text('Orders'));

      expect(homeLabel.style?.color, Colors.white);
      expect(ordersLabel.style?.color, const Color(0xFF777777));
    },
  );
}
