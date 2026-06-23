import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/providers/checkout_payment_settings_provider.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
  });

  testWidgets('lists 4 methods, returns chosen one', (tester) async {
    PaymentMethod? picked;
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await PaymentMethodSheet.show(ctx, current: null);
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('GCash'), findsOneWidget);
    expect(find.text('Maya'), findsOneWidget);
    expect(find.text('Cash on Delivery'), findsOneWidget);
    expect(find.text('GRIDGO Credits'), findsOneWidget);
    await tester.tap(find.text('Maya'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();
    expect(picked, PaymentMethod.maya);
  });

  testWidgets('saving as default patches profile and updates auth state', (
    tester,
  ) async {
    final patchPayloads = <Map<String, dynamic>>[];
    final interceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/users/me/default-payment-method' &&
            options.method == 'PATCH') {
          patchPayloads.add(Map<String, dynamic>.from(options.data as Map));
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'ok': true},
            ),
          );
          return;
        }
        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(interceptor);
    addTearDown(() => ApiClient.instance.dio.interceptors.remove(interceptor));

    final container = ProviderContainer(
      overrides: [
        authProvider.overrideWith(
          (_) => _SeededAuthNotifier(
            const AuthState(
              status: AuthStatus.authenticated,
              user: AuthUser(
                id: '1',
                email: 'maria@test.com',
                fullName: 'Maria Santos',
                role: 'customer',
                isProfileComplete: true,
                credits: '500',
              ),
            ),
          ),
        ),
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(creditsOnlyMode: false),
        ),
      ],
    );
    addTearDown(container.dispose);

    PaymentMethod? picked;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await PaymentMethodSheet.show(ctx, current: null);
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Maya'));
    await tester.pump();
    await tester.tap(find.text('Save as default for future orders'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();

    expect(picked, PaymentMethod.maya);
    expect(patchPayloads, [
      {'method': 'maya'},
    ]);
    expect(
      container.read(authProvider).user?.defaultPaymentMethod,
      PaymentMethod.maya,
    );
  });

  testWidgets(
    'credits-only settings keep e-wallets available but disable COD',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith(
            (_) => _SeededAuthNotifier(
              const AuthState(
                status: AuthStatus.authenticated,
                user: AuthUser(
                  id: '1',
                  email: 'maria@test.com',
                  fullName: 'Maria Santos',
                  role: 'customer',
                  isProfileComplete: true,
                  credits: '500',
                ),
              ),
            ),
          ),
          checkoutPaymentSettingsProvider.overrideWith(
            (_) async => const CheckoutPaymentSettings(creditsOnlyMode: true),
          ),
        ],
      );
      addTearDown(container.dispose);

      PaymentMethod? picked;
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Builder(
              builder: (ctx) => Scaffold(
                body: ElevatedButton(
                  onPressed: () async {
                    picked = await PaymentMethodSheet.show(ctx, current: null);
                  },
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('GCash'), findsOneWidget);
      expect(find.text('Maya'), findsOneWidget);
      expect(find.text('Cash on Delivery'), findsOneWidget);
      expect(find.text('GRIDGO Credits'), findsOneWidget);
      expect(find.text('Temporarily unavailable'), findsOneWidget);
      expect(find.text('Top up'), findsNothing);

      await tester.tap(find.text('GCash'));
      await tester.pump();
      await tester.tap(find.text('Use this'));
      await tester.pumpAndSettle();
      expect(picked, PaymentMethod.gcash);
    },
  );

  testWidgets('credits-only settings keep Maya selectable for beta checkout', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        authProvider.overrideWith(
          (_) => _SeededAuthNotifier(
            const AuthState(
              status: AuthStatus.authenticated,
              user: AuthUser(
                id: '1',
                email: 'maria@test.com',
                fullName: 'Maria Santos',
                role: 'customer',
                isProfileComplete: true,
                credits: '500',
              ),
            ),
          ),
        ),
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(creditsOnlyMode: true),
        ),
      ],
    );
    addTearDown(container.dispose);

    PaymentMethod? picked;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  picked = await PaymentMethodSheet.show(ctx, current: null);
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Maya'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();

    expect(picked, PaymentMethod.maya);
  });
}

class _SeededAuthNotifier extends AuthNotifier {
  _SeededAuthNotifier(AuthState initialState) : super() {
    state = initialState;
  }
}
