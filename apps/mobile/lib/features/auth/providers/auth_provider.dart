import 'package:flutter_riverpod/flutter_riverpod.dart';

// ---------------------------------------------------------------------------
// Auth status
// ---------------------------------------------------------------------------
enum AuthStatus { unauthenticated, authenticated, profileIncomplete }

// ---------------------------------------------------------------------------
// Simple user model (self-contained, no external deps)
// ---------------------------------------------------------------------------
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.isProfileComplete = false,
    this.phone,
    this.gender,
    this.dateOfBirth,
  });

  final String id;
  final String email;
  final String fullName;
  final String role; // 'customer', 'driver', 'admin'
  final bool isProfileComplete;
  final String? phone;
  final String? gender;
  final DateTime? dateOfBirth;

  AuthUser copyWith({
    String? id,
    String? email,
    String? fullName,
    String? role,
    bool? isProfileComplete,
    String? phone,
    String? gender,
    DateTime? dateOfBirth,
  }) {
    return AuthUser(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      phone: phone ?? this.phone,
      gender: gender ?? this.gender,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
    );
  }
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
class AuthState {
  const AuthState({
    this.status = AuthStatus.unauthenticated,
    this.user,
    this.isLoading = false,
    this.errorMessage,
  });

  factory AuthState.unauthenticated() => const AuthState();

  final AuthStatus status;
  final AuthUser? user;
  final bool isLoading;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

// ---------------------------------------------------------------------------
// Auth notifier
// ---------------------------------------------------------------------------
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState.unauthenticated());

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    await Future.delayed(const Duration(milliseconds: 800));
    state = AuthState(
      status: AuthStatus.authenticated,
      user: AuthUser(
        id: '1',
        email: email,
        fullName: 'Maria Santos',
        role: 'customer',
        isProfileComplete: true,
      ),
    );
  }

  Future<void> register(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    await Future.delayed(const Duration(milliseconds: 800));
    state = AuthState(
      status: AuthStatus.profileIncomplete,
      user: AuthUser(
        id: '1',
        email: email,
        fullName: '',
        role: 'customer',
      ),
    );
  }

  void devBypass(String role) {
    final users = {
      'customer': const AuthUser(
        id: '1',
        email: 'maria@test.com',
        fullName: 'Maria Santos',
        role: 'customer',
        isProfileComplete: true,
      ),
      'driver': const AuthUser(
        id: '2',
        email: 'juan@test.com',
        fullName: 'Juan Reyes',
        role: 'driver',
        isProfileComplete: true,
      ),
      'admin': const AuthUser(
        id: '3',
        email: 'admin@test.com',
        fullName: 'Admin',
        role: 'admin',
        isProfileComplete: true,
      ),
    };
    state = AuthState(
      status: AuthStatus.authenticated,
      user: users[role]!,
    );
  }

  void completeProfile(
    String fullName,
    String phone,
    String gender,
    DateTime? dob,
  ) {
    state = AuthState(
      status: AuthStatus.authenticated,
      user: state.user!.copyWith(
        fullName: fullName,
        phone: phone,
        gender: gender,
        dateOfBirth: dob,
        isProfileComplete: true,
      ),
    );
  }

  void logout() => state = AuthState.unauthenticated();
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
final authProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
