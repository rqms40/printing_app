/// Formatting helpers for dispatch-plan road-time ETAs and distances.
library;

/// `'~1 min'` under 90 seconds, `'~N min'` (ceiling) up to an hour, then
/// `'~H h M min'`.
String formatEtaMinutes(int seconds) {
  if (seconds < 90) return '~1 min';
  final minutes = (seconds / 60).ceil();
  if (minutes < 60) return '~$minutes min';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0 ? '~$hours h' : '~$hours h $rest min';
}

/// `'850 m'` under a kilometer, otherwise `'2.3 km'` (one decimal).
String formatDistanceMeters(int meters) {
  if (meters < 1000) return '$meters m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}
