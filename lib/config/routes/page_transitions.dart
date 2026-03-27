import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Slide from right + fade in (standard forward navigation)
CustomTransitionPage<void> slideTransition(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 300),
    reverseTransitionDuration: const Duration(milliseconds: 250),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slideIn = Tween(begin: const Offset(0.08, 0), end: Offset.zero)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
      final fadeIn = Tween(begin: 0.0, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));
      return FadeTransition(
        opacity: fadeIn,
        child: SlideTransition(position: slideIn, child: child),
      );
    },
  );
}

/// Slide up + fade (for order flow steps, modals)
CustomTransitionPage<void> slideUpTransition(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 350),
    reverseTransitionDuration: const Duration(milliseconds: 250),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slideUp = Tween(begin: const Offset(0, 0.06), end: Offset.zero)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
      final fadeIn = Tween(begin: 0.0, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));
      return FadeTransition(
        opacity: fadeIn,
        child: SlideTransition(position: slideUp, child: child),
      );
    },
  );
}

/// Fade only (for tab switches, splash transitions)
CustomTransitionPage<void> fadeTransition(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 250),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(opacity: animation, child: child);
    },
  );
}

/// Scale in + fade (for detail screens, confirmations)
CustomTransitionPage<void> scaleTransition(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 300),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final scale = Tween(begin: 0.95, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
      final fadeIn = Tween(begin: 0.0, end: 1.0)
          .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));
      return FadeTransition(
        opacity: fadeIn,
        child: ScaleTransition(scale: scale, child: child),
      );
    },
  );
}
