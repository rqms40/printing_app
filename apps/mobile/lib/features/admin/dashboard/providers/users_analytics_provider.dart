import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

class AnalyticsPoint {
  const AnalyticsPoint({required this.label, required this.value});
  final String label;
  final double value;

  factory AnalyticsPoint.fromJson(Map<String, dynamic> json) {
    return AnalyticsPoint(
      label: json['label'] as String? ?? '',
      value: (json['value'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class RoleCounts {
  const RoleCounts({
    required this.customers,
    required this.drivers,
    required this.admins,
  });
  final int customers;
  final int drivers;
  final int admins;

  factory RoleCounts.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const RoleCounts(customers: 0, drivers: 0, admins: 0);
    return RoleCounts(
      customers: (json['customers'] as num?)?.toInt() ?? 0,
      drivers: (json['drivers'] as num?)?.toInt() ?? 0,
      admins: (json['admins'] as num?)?.toInt() ?? 0,
    );
  }
}

class AnalyticsSummary {
  const AnalyticsSummary({
    required this.totalCustomers,
    required this.newCustomers,
    required this.activeCustomers,
    required this.profileCompletionRate,
    required this.roleCounts,
  });

  final int totalCustomers;
  final int newCustomers;
  final int activeCustomers;
  final double profileCompletionRate;
  final RoleCounts roleCounts;

  factory AnalyticsSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const AnalyticsSummary(
        totalCustomers: 0,
        newCustomers: 0,
        activeCustomers: 0,
        profileCompletionRate: 0.0,
        roleCounts: RoleCounts(customers: 0, drivers: 0, admins: 0),
      );
    }
    return AnalyticsSummary(
      totalCustomers: (json['total_customers'] as num?)?.toInt() ?? 0,
      newCustomers: (json['new_customers'] as num?)?.toInt() ?? 0,
      activeCustomers: (json['active_customers'] as num?)?.toInt() ?? 0,
      profileCompletionRate: (json['profile_completion_rate'] as num?)?.toDouble() ?? 0.0,
      roleCounts: RoleCounts.fromJson(json['role_counts'] as Map<String, dynamic>?),
    );
  }
}

class UsersAnalyticsRecord {
  const UsersAnalyticsRecord({
    required this.summary,
    required this.signupTrend,
    required this.profileCategoryMix,
    required this.profileFieldMix,
    required this.topSegments,
    required this.preferenceMix,
    required this.activitySplit,
    required this.revenueBySegment,
  });

  final AnalyticsSummary summary;
  final List<AnalyticsPoint> signupTrend;
  final List<AnalyticsPoint> profileCategoryMix;
  final List<AnalyticsPoint> profileFieldMix;
  final List<AnalyticsPoint> topSegments;
  final List<AnalyticsPoint> preferenceMix;
  final List<AnalyticsPoint> activitySplit;
  final List<AnalyticsPoint> revenueBySegment;

  factory UsersAnalyticsRecord.fromJson(Map<String, dynamic> json) {
    List<AnalyticsPoint> parsePoints(String key) {
      final list = json[key] as List<dynamic>? ?? [];
      return list.map((e) => AnalyticsPoint.fromJson(e as Map<String, dynamic>)).toList();
    }

    return UsersAnalyticsRecord(
      summary: AnalyticsSummary.fromJson(json['summary'] as Map<String, dynamic>?),
      signupTrend: parsePoints('signup_trend'),
      profileCategoryMix: parsePoints('profile_category_mix'),
      profileFieldMix: parsePoints('profile_field_mix'),
      topSegments: parsePoints('top_segments'),
      preferenceMix: parsePoints('preference_mix'),
      activitySplit: parsePoints('activity_split'),
      revenueBySegment: parsePoints('revenue_by_segment'),
    );
  }
}

class UsersAnalyticsState {
  const UsersAnalyticsState({
    required this.isLoading,
    this.record,
    this.error,
  });

  final bool isLoading;
  final UsersAnalyticsRecord? record;
  final String? error;

  UsersAnalyticsState copyWith({
    bool? isLoading,
    UsersAnalyticsRecord? record,
    String? error,
  }) {
    return UsersAnalyticsState(
      isLoading: isLoading ?? this.isLoading,
      record: record ?? this.record,
      error: error ?? this.error,
    );
  }
}

class UsersAnalyticsNotifier extends StateNotifier<UsersAnalyticsState> {
  UsersAnalyticsNotifier() : super(const UsersAnalyticsState(isLoading: true)) {
    _fetch();
    _listenToOrderUpdates();
  }

  void _listenToOrderUpdates() {
    WebSocketService.instance.listenForOrderUpdates((_) => _fetch());
    WebSocketService.instance.connectOrders();
  }

  Future<void> _fetch() async {
    try {
      final response = await ApiClient.instance.get('/admin/users/analytics?period=6M');
      final json = response.data as Map<String, dynamic>;
      final record = UsersAnalyticsRecord.fromJson(json);
      state = state.copyWith(isLoading: false, record: record, error: null);
    } catch (e) {
      String errMsg = e.toString();
      if (e.toString().contains('401')) {
        errMsg = 'Session expired. Please click Profile to log out and log back in.';
      }
      state = state.copyWith(isLoading: false, error: errMsg);
    }
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, error: null);
    await _fetch();
  }
}

final usersAnalyticsProvider =
    StateNotifierProvider.autoDispose<UsersAnalyticsNotifier, UsersAnalyticsState>(
  (ref) => UsersAnalyticsNotifier(),
);
