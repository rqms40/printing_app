/// Validates an email address format.
///
/// Returns an error message if invalid, or `null` if valid.
String? validateEmail(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Email is required';
  }
  final emailRegex = RegExp(r'^[\w\.\-\+]+@[\w\-]+\.[\w\-\.]+$');
  if (!emailRegex.hasMatch(value.trim())) {
    return 'Enter a valid email address';
  }
  return null;
}

/// Validates a password meets minimum requirements.
///
/// Requires at least 8 characters, one uppercase, one lowercase, and one digit.
/// Returns an error message if invalid, or `null` if valid.
String? validatePassword(String? value) {
  if (value == null || value.isEmpty) {
    return 'Password is required';
  }
  if (value.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!RegExp(r'[A-Z]').hasMatch(value)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!RegExp(r'[a-z]').hasMatch(value)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!RegExp(r'[0-9]').hasMatch(value)) {
    return 'Password must contain at least one number';
  }
  return null;
}

/// Validates that a required field is not empty.
///
/// [fieldName] is used in the error message.
/// Returns an error message if empty, or `null` if valid.
String? validateRequired(String? value, {String fieldName = 'This field'}) {
  if (value == null || value.trim().isEmpty) {
    return '$fieldName is required';
  }
  return null;
}

/// Validates a Philippine phone number format.
///
/// Accepts formats: +639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX
/// Returns an error message if invalid, or `null` if valid.
String? validatePhone(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Phone number is required';
  }
  final cleaned = value.replaceAll(RegExp(r'[\s\-()]'), '');
  final phoneRegex = RegExp(r'^(\+63|0)?9\d{9}$');
  if (!phoneRegex.hasMatch(cleaned)) {
    return 'Enter a valid Philippine phone number';
  }
  return null;
}
