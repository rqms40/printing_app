import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/location_update.dart';

/// Latest driver location received by the customer tracking socket.
///
/// This intentionally does not use the driver's GPS provider. Customer screens
/// should only render locations pushed by the assigned driver, not local/mock GPS.
final liveDriverLocationProvider = StateProvider<LocationUpdate?>(
  (ref) => null,
);
