import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/shared/services/api_client.dart';

class AccountStateNotifier extends StateNotifier<AccountState> {
  AccountStateNotifier() : super(const AccountState.unknown());

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await ApiClient.instance.get('/users/me/account-state');
      state = AccountState.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } catch (_) {
      state = const AccountState(status: AccountGateStatus.active);
    }
  }

  void clear() {
    state = const AccountState.unknown();
  }
}

final accountStateProvider =
    StateNotifierProvider<AccountStateNotifier, AccountState>(
      (ref) => AccountStateNotifier(),
    );
