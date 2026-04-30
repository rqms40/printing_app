import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/shared/services/api_client.dart';

typedef FetchAccountState = Future<Map<String, dynamic>> Function();

class AccountStateNotifier extends StateNotifier<AccountState> {
  AccountStateNotifier({FetchAccountState? fetchAccountState})
    : _fetchAccountState = fetchAccountState ?? _fetchAccountStateFromApi,
      super(const AccountState.unknown());

  final FetchAccountState _fetchAccountState;

  Future<void> refresh() async {
    final previousState = state;
    state = state.copyWith(isLoading: true);
    try {
      state = AccountState.fromJson(await _fetchAccountState());
    } catch (_) {
      state = previousState.status == AccountGateStatus.surveyRequired
          ? previousState.copyWith(isLoading: false)
          : const AccountState.unknown();
    }
  }

  void clear() {
    state = const AccountState.unknown();
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
