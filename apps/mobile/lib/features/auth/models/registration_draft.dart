class RegistrationDraft {
  const RegistrationDraft({
    this.hasAcceptedPrivacy = false,
    this.nickname = '',
    this.profileCategory,
    this.profileField,
    this.gender,
    this.ageRange,
    this.printingPreferences = const [],
    this.fullName = '',
    this.email = '',
    this.phoneNumber = '',
    this.password = '',
    this.confirmPassword = '',
  });

  final bool hasAcceptedPrivacy;
  final String nickname;
  final String? profileCategory;
  final String? profileField;
  final String? gender;
  final String? ageRange;
  final List<String> printingPreferences;
  final String fullName;
  final String email;
  final String phoneNumber;
  final String password;
  final String confirmPassword;

  bool get hasNickname => nickname.trim().isNotEmpty;
  bool get hasCategory => profileCategory != null;
  bool get hasField => profileField != null;
  bool get hasGender => gender != null && gender!.trim().isNotEmpty;
  bool get hasAgeRange => ageRange != null && ageRange!.trim().isNotEmpty;

  bool get hasAccountFields =>
      fullName.trim().isNotEmpty &&
      email.trim().isNotEmpty &&
      phoneNumber.trim().isNotEmpty &&
      password.isNotEmpty &&
      confirmPassword.isNotEmpty;

  RegistrationDraft copyWith({
    bool? hasAcceptedPrivacy,
    String? nickname,
    Object? profileCategory = _unset,
    Object? profileField = _unset,
    Object? gender = _unset,
    Object? ageRange = _unset,
    List<String>? printingPreferences,
    String? fullName,
    String? email,
    String? phoneNumber,
    String? password,
    String? confirmPassword,
  }) {
    return RegistrationDraft(
      hasAcceptedPrivacy: hasAcceptedPrivacy ?? this.hasAcceptedPrivacy,
      nickname: nickname ?? this.nickname,
      profileCategory: profileCategory == _unset
          ? this.profileCategory
          : profileCategory as String?,
      profileField: profileField == _unset
          ? this.profileField
          : profileField as String?,
      gender: gender == _unset ? this.gender : gender as String?,
      ageRange: ageRange == _unset ? this.ageRange : ageRange as String?,
      printingPreferences: printingPreferences ?? this.printingPreferences,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
    );
  }
}

const _unset = Object();
