class BetaStatus {
  const BetaStatus({
    required this.globallyEnabled,
    required this.isBetaUser,
    this.rank,
  });

  final bool globallyEnabled;
  final bool isBetaUser;
  final int? rank;

  factory BetaStatus.fromJson(Map<String, dynamic> json) => BetaStatus(
        globallyEnabled: json['globallyEnabled'] as bool,
        isBetaUser: json['isBetaUser'] as bool,
        rank: json['rank'] as int?,
      );
}
