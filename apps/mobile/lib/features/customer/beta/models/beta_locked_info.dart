class BetaLockedInfo {
  const BetaLockedInfo({
    required this.fullName,
    required this.email,
    required this.betaPhotoUploaded,
    required this.betaSharedOnSocial,
    this.betaCompletedAt,
  });

  final String fullName;
  final String email;
  final bool betaPhotoUploaded;
  final bool betaSharedOnSocial;
  final DateTime? betaCompletedAt;

  factory BetaLockedInfo.fromJson(Map<String, dynamic> json) {
    final userMap = json['user'] as Map<String, dynamic>? ?? const {};
    final fullName = (userMap['fullName'] as String?)?.trim();
    return BetaLockedInfo(
      fullName: fullName == null || fullName.isEmpty ? 'Beta Tester' : fullName,
      email: userMap['email'] as String? ?? '',
      betaPhotoUploaded: json['betaPhotoUploaded'] as bool? ?? false,
      betaSharedOnSocial: json['betaSharedOnSocial'] as bool? ?? false,
      betaCompletedAt: json['betaCompletedAt'] != null
          ? DateTime.tryParse(json['betaCompletedAt'] as String)
          : null,
    );
  }
}
