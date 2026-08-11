import 'dart:ui' as ui;

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

  testWidgets('lists pilot rails (credits + QR + COD), hides live wallets by default', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    PaymentMethod? picked;
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
                role: 'client',
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

    expect(find.text('Pilot Credits'), findsOneWidget);
    expect(find.textContaining('QR'), findsWidgets);
    expect(find.text('Cash on Delivery'), findsOneWidget);
    expect(find.text('GCash'), findsNothing);
    expect(find.text('Maya'), findsNothing);
    expect(
      find.textContaining('Max ₱1,500'),
      findsOneWidget,
    );

    final codControl = find.bySemanticsLabel(RegExp(r'^Cash on Delivery\.'));
    expect(codControl, findsOneWidget);
    expect(
      tester
          .getSemantics(codControl)
          .getSemanticsData()
          .hasAction(ui.SemanticsAction.tap),
      isTrue,
      reason: 'enabled payment semantics must expose its selection action',
    );
    await tester.tap(find.text('Cash on Delivery'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();
    expect(picked, PaymentMethod.cod);
    semantics.dispose();
  });

  testWidgets('sandbox flag shows live GCash/Maya wallets', (tester) async {
    PaymentMethod? picked;
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
                role: 'client',
                isProfileComplete: true,
                credits: '500',
              ),
            ),
          ),
        ),
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(
            creditsOnlyMode: false,
            showLiveWallets: true,
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

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
    // Live wallets render below pilot rails — prove they appear, then pick COD.
    await tester.tap(find.text('Cash on Delivery'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();
    expect(picked, PaymentMethod.cod);
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
                role: 'client',
                isProfileComplete: true,
                credits: '500',
              ),
            ),
          ),
        ),
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(
            creditsOnlyMode: false,
            showLiveWallets: true,
          ),
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
    await tester.tap(find.text('Cash on Delivery'));
    await tester.pump();
    await tester.tap(find.text('Save as default for future orders'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();

    expect(picked, PaymentMethod.cod);
    expect(patchPayloads, [
      {'method': 'cod'},
    ]);
    expect(
      container.read(authProvider).user?.defaultPaymentMethod,
      PaymentMethod.cod,
    );
  });

  testWidgets(
    'credits-only settings show only Pilot Credits',
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
                  role: 'client',
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

      expect(find.text('Pilot Credits'), findsOneWidget);
      expect(find.text('Cash on Delivery'), findsNothing);
      expect(find.text('GCash'), findsNothing);
      expect(find.text('Maya'), findsNothing);
      expect(
        find.text('Only Pilot Credits is available during beta testing'),
        findsOneWidget,
      );

      await tester.tap(find.text('Pilot Credits'));
      await tester.pump();
      await tester.tap(find.text('Use this'));
      await tester.pumpAndSettle();
      expect(picked, PaymentMethod.gridCredits);
    },
  );

  testWidgets('default method for Pilot Credits uses credits wire value', (
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
                role: 'client',
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

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  await PaymentMethodSheet.show(ctx, current: null);
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
    await tester.tap(find.text('Pilot Credits'));
    await tester.pump();
    await tester.tap(find.text('Save as default for future orders'));
    await tester.pump();
    await tester.tap(find.text('Use this'));
    await tester.pumpAndSettle();

    expect(patchPayloads, [
      {'method': 'credits'},
    ]);
  });
}

class _SeededAuthNotifier extends AuthNotifier {
  _SeededAuthNotifier(AuthState initialState) : super() {
    state = initialState;
  }
}
