import 'package:flutter/material.dart';

/// Root [ScaffoldMessenger] key for GRIDGO.
///
/// Use this instead of [ScaffoldMessenger.of] from deep router/provider
/// listeners. Looking up the messenger via context during navigation or
/// WebSocket-driven rebuilds can throw on Flutter web (RTI /
/// `T[_eval] is not a function` inside `findAncestorWidgetOfExactType`).
final GlobalKey<ScaffoldMessengerState> appScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Show a snackbar without requiring a [BuildContext] with a messenger
/// ancestor. No-ops safely if the messenger is not mounted yet.
void showAppSnackBar(SnackBar snackBar, {bool clearExisting = true}) {
  final messenger = appScaffoldMessengerKey.currentState;
  if (messenger == null) return;
  try {
    if (clearExisting) messenger.clearSnackBars();
    messenger.showSnackBar(snackBar);
  } catch (e) {
    debugPrint('showAppSnackBar failed: $e');
  }
}
