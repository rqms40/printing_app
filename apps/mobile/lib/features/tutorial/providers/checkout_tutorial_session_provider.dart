import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Session-only flag: true once the checkout Multi-drop coach mark (Step A)
/// has been dismissed during this app session. Resets on app restart.
/// When true, [PaymentMethodSheet] fires the GRID Credits coach mark (Step B).
final checkoutMultidropSeenInSessionProvider =
    StateProvider<bool>((ref) => false);
