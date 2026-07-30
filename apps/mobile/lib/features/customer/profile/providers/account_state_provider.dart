import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/shared/services/api_client.dart';

typedef FetchAccountState = Future<Map<String, dynamic>> Function();

class AccountStateNotifier extends StateNotifier<AccountState> {
  AccountStateNotifier({FetchAccountState? fetchAccountState})
    : _fetchAccountState = fetchAccountState ?? _fetchAccountStateFromApi,
      super(const AccountState.unknown());

  final FetchAccountState _fetchAccountState;
  int _sessionGeneration = 0;
  int _fetchGeneration = 0;

  bool _isCurrent(int sessionGeneration, int fetchGeneration) =>
      mounted &&
      sessionGeneration == _sessionGeneration &&
      fetchGeneration == _fetchGeneration;

  Future<void> refresh() async {
    final sessionGeneration = _sessionGeneration;
    final fetchGeneration = ++_fetchGeneration;
    final previousState = state;
    state = state.copyWith(isLoading: true);
    try {
      final response = await _fetchAccountState();
      if (!_isCurrent(sessionGeneration, fetchGeneration)) return;
      state = AccountState.fromJson(response);
    } catch (_) {
      if (!_isCurrent(sessionGeneration, fetchGeneration)) return;
      state = previousState.status == AccountGateStatus.surveyRequired
          ? previousState.copyWith(isLoading: false)
          : const AccountState.unknown();
    }
  }

  void clear() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    state = const AccountState.unknown();
  }

  @override
  void dispose() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    super.dispose();
  }
}

Future<Map<String, dynamic>> _fetchAccountStateFromApi() async {
  final response = await ApiClient.instance.get('/users/me/account-state');
  return Map<String, dynamic>.from(response.data as Map);
}

final accountStateProvider =
    StateNotifierProvider<AccountStateNotifier, AccountState>(
      (ref) => AccountStateNotifier(),
    );
