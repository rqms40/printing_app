import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/providers/connectivity_provider.dart';
import 'package:printing_app/shared/widgets/offline_banner.dart';
import 'app_bottom_nav.dart';

/// Shell widget that wraps each role's tab navigation.
///
/// Shows an [OfflineBanner] at the top when the device loses connectivity.
/// The banner auto-hides when connection is restored.
class ScaffoldWithNav extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider);

    return Scaffold(
      body: Column(
        children: [
          // Offline banner — slides in/out
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            child: isOnline
                ? const SizedBox.shrink()
                : const OfflineBanner(),
          ),
          // Screen content
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: AppBottomNav(
        items: items,
        currentIndex: currentIndex,
        onTap: onTap,
      ),
    );
  }
}
