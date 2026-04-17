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
    this.profileCategory,
    this.profileField,
    this.course,
    this.organization,
    this.printingPreferences = const [],
    required this.role,
    required this.isProfileComplete,
    required this.isActive,
    this.credits,
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
  final String? profileCategory;
  final String? profileField;
  final String? course;
  final String? organization;
  final List<String> printingPreferences;
  final UserRole role;
  final bool isProfileComplete;
  final bool isActive;
  final String? credits;
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
    String? profileCategory,
    String? profileField,
    String? course,
    String? organization,
    List<String>? printingPreferences,
    UserRole? role,
    bool? isProfileComplete,
    bool? isActive,
    String? credits,
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
      profileCategory: profileCategory ?? this.profileCategory,
      profileField: profileField ?? this.profileField,
      course: course ?? this.course,
      organization: organization ?? this.organization,
      printingPreferences: printingPreferences ?? this.printingPreferences,
      role: role ?? this.role,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      isActive: isActive ?? this.isActive,
      credits: credits ?? this.credits,
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
