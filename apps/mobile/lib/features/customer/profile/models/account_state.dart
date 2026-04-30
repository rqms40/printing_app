enum AccountGateStatus { unknown, active, surveyRequired }

class SurveyRequirementHold {
  const SurveyRequirementHold({
    required this.requirementId,
    required this.orderId,
    required this.orderRef,
    required this.requiredAt,
  });

  final int requirementId;
  final int orderId;
  final String orderRef;
  final DateTime requiredAt;

  factory SurveyRequirementHold.fromJson(Map<String, dynamic> json) {
    return SurveyRequirementHold(
      requirementId: (json['requirementId'] as num).toInt(),
      orderId: (json['orderId'] as num).toInt(),
      orderRef: json['orderRef']?.toString() ?? '',
      requiredAt: DateTime.parse(json['requiredAt'] as String),
    );
  }
}

class AccountState {
  const AccountState({
    required this.status,
    this.holds = const [],
    this.isLoading = false,
  });

  const AccountState.unknown()
    : status = AccountGateStatus.unknown,
      holds = const [],
      isLoading = false;

  final AccountGateStatus status;
  final List<SurveyRequirementHold> holds;
  final bool isLoading;

  SurveyRequirementHold? get requiredSurveyHold =>
      holds.isEmpty ? null : holds.first;

  bool get requiresSurvey => status == AccountGateStatus.surveyRequired;

  AccountState copyWith({
    AccountGateStatus? status,
    List<SurveyRequirementHold>? holds,
    bool? isLoading,
  }) {
    return AccountState(
      status: status ?? this.status,
      holds: holds ?? this.holds,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  factory AccountState.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['accountStatus']?.toString();
    final rawHolds = json['holds'];
    final holds = rawHolds is List
        ? rawHolds
              .whereType<Map>()
              .map(
                (item) => SurveyRequirementHold.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList()
        : <SurveyRequirementHold>[];

    return AccountState(
      status: rawStatus == 'survey_required'
          ? AccountGateStatus.surveyRequired
          : AccountGateStatus.active,
      holds: holds,
    );
  }
}
