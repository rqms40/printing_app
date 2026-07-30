import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/routes/app_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/address/screens/address_list_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_picker_screen.dart';
import 'package:printing_app/shared/models/address.dart';

class _TrackingAddressNotifier extends AddressNotifier {
  _TrackingAddressNotifier({super.initialState = const []})
    : super(skipBootstrap: true);

  int refreshCalls = 0;

  @override
  Future<bool> refreshAddresses() async {
    refreshCalls += 1;
    return true;
  }
}

class _AuthenticatedCustomerNotifier extends AuthNotifier {
  _AuthenticatedCustomerNotifier() {
    state = const AuthState(
      status: AuthStatus.authenticated,
      user: AuthUser(
        id: 'user-1',
        email: 'mark@example.com',
        fullName: 'Mark Prado',
        role: 'customer',
        isProfileComplete: true,
      ),
    );
  }
}

final _savedAddress = Address(
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  fullAddress: '123 Test Street',
  city: 'Davao City',
  landmark: 'Near the park',
  latitude: 7.0731,
  longitude: 125.6128,
  isDefault: true,
  createdAt: DateTime.utc(2026, 7, 10),
  updatedAt: DateTime.utc(2026, 7, 10),
);

void main() {
  testWidgets('refreshes saved addresses when the list screen opens', (
    tester,
  ) async {
    final notifier = _TrackingAddressNotifier();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [addressProvider.overrideWith((ref) => notifier)],
        child: const MaterialApp(home: AddressListScreen()),
      ),
    );
    await tester.pump();

    expect(notifier.refreshCalls, 1);
  });

  testWidgets('Edit navigates with the selected saved address', (tester) async {
    final notifier = _TrackingAddressNotifier(initialState: [_savedAddress]);
    final router = GoRouter(
      initialLocation: '/customer/addresses',
      routes: [
        GoRoute(
          path: '/customer/addresses',
          builder: (_, _) => const AddressListScreen(),
        ),
        GoRoute(
          path: '/customer/addresses/new',
          builder: (_, state) => Text(
            state.extra is Address
                ? 'editing-${(state.extra! as Address).id}'
                : 'adding',
          ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [addressProvider.overrideWith((ref) => notifier)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    await tester.tap(find.byTooltip('Edit Home'));
    await tester.pumpAndSettle();

    expect(find.text('editing-addr-1'), findsOneWidget);
  });

  testWidgets('app router opens the selected address in edit mode', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        authProvider.overrideWith((ref) => _AuthenticatedCustomerNotifier()),
      ],
    );
    addTearDown(container.dispose);
    final router = container.read(routerProvider);
    addTearDown(router.dispose);
    router.go('/customer/addresses/new', extra: _savedAddress);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump(const Duration(seconds: 1));

    final picker = tester.widget<AddressPickerScreen>(
      find.byType(AddressPickerScreen),
    );
    expect(picker.existingAddress, same(_savedAddress));
    expect(find.text('Edit Address'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}
