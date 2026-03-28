import 'enums.dart';

class User {
  const User({
    required this.id,
    required this.uid,
    required this.email,
    this.fullName,
    this.phoneNumber,
    this.gender,
    this.dateOfBirth,
    required this.role,
    required this.isProfileComplete,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String uid;
  final String email;
  final String? fullName;
  final String? phoneNumber;
  final String? gender;
  final DateTime? dateOfBirth;
  final UserRole role;
  final bool isProfileComplete;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  User copyWith({
    String? id,
    String? uid,
    String? email,
    String? fullName,
    String? phoneNumber,
    String? gender,
    DateTime? dateOfBirth,
    UserRole? role,
    bool? isProfileComplete,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      uid: uid ?? this.uid,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      gender: gender ?? this.gender,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      role: role ?? this.role,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() => 'User(id: $id, email: $email, role: ${role.displayName})';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is User && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
