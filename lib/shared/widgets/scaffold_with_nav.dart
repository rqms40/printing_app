import 'package:flutter/material.dart';
import 'app_bottom_nav.dart';

/// Shell widget that wraps each role's tab navigation.
///
/// Used by [StatefulShellRoute.indexedStack] to render the correct bottom
/// navigation bar while letting GoRouter manage the child content.
class ScaffoldWithNav extends StatelessWidget {
  const ScaffoldWithNav({
    super.key,
    required this.child,
    required this.currentIndex,
    required this.items,
    required this.onTap,
  });

  final Widget child;
  final int currentIndex;
  final List<NavItem> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: AppBottomNav(
        items: items,
        currentIndex: currentIndex,
        onTap: onTap,
      ),
    );
  }
}
