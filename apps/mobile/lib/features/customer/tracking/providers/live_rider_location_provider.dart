import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/location_update.dart';

/// Latest rider location received by the customer tracking socket.
///
/// This intentionally does not use the rider's GPS provider. Customer screens
/// should only render locations pushed by the assigned rider, not local/mock GPS.
final liveRiderLocationProvider = StateProvider<LocationUpdate?>(
  (ref) => null,
);
