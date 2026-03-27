import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';

/// Exposes the current authenticated user data from auth state.
final profileProvider = Provider<AuthUser?>((ref) {
  final authState = ref.watch(authProvider);
  return authState.user;
});
