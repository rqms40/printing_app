import 'package:intl/intl.dart';

/// Formats a double as Philippine Peso currency.
///
/// Example: `formatCurrency(1234.56)` returns `'₱1,234.56'`
String formatCurrency(double amount) {
  final formatter = NumberFormat.currency(
    locale: 'en_PH',
    symbol: '₱',
    decimalDigits: 2,
  );
  return formatter.format(amount);
}

/// Formats exact PHP minor units without converting through a JS/Dart double.
String formatMinorCurrency(BigInt amountMinor) {
  final negative = amountMinor.isNegative;
  final absolute = amountMinor.abs();
  final major = (absolute ~/ BigInt.from(100)).toString();
  final minor = (absolute % BigInt.from(100)).toString().padLeft(2, '0');
  final grouped = major.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
  return '${negative ? '-' : ''}₱$grouped.$minor';
}

/// Formats a DateTime as a short date string.
///
/// Example: `formatDate(DateTime(2026, 3, 27))` returns `'Mar 27, 2026'`
String formatDate(DateTime date) {
  return DateFormat('MMM d, y').format(date);
}

/// Formats a DateTime as a time string.
///
/// Example: `formatTime(DateTime(2026, 3, 27, 15, 0))` returns `'3:00 PM'`
String formatTime(DateTime date) {
  return DateFormat('h:mm a').format(date);
}

/// Formats a DateTime as a combined date and time string.
///
/// Example: returns `'Mar 27, 2026 at 3:00 PM'`
String formatDateTime(DateTime date) {
  return '${formatDate(date)} at ${formatTime(date)}';
}

/// Formats a byte count as a human-readable file size.
///
/// Example: `formatFileSize(2621440)` returns `'2.5 MB'`
String formatFileSize(int bytes) {
  if (bytes < 1024) {
    return '$bytes B';
  } else if (bytes < 1024 * 1024) {
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  } else {
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}
