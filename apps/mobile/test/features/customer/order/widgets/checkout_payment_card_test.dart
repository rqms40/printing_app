import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/checkout_payment_settings_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_payment_card.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  testWidgets('shows "Choose payment method" when none selected', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final container = ProviderContainer();
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
      ),
    );
    expect(find.text('Choose payment method'), findsOneWidget);
    final paymentControl = find.bySemanticsLabel('Choose payment method');
    expect(paymentControl, findsOneWidget);
    expect(
      tester
          .getSemantics(paymentControl)
          .getSemanticsData()
          .hasAction(ui.SemanticsAction.tap),
      isTrue,
      reason: 'the web semantics button must activate the payment picker',
    );
    semantics.dispose();
  });

  testWidgets('shows method label when selected', (tester) async {
    final container = ProviderContainer();
    container
        .read(checkoutProvider.notifier)
        .setPaymentMethod(PaymentMethod.gridCredits);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
      ),
    );
    expect(find.textContaining('Pilot Credits'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
  });

  testWidgets('applies the saved default payment method for checkout', (
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
                defaultPaymentMethod: PaymentMethod.maya,
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
        child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(container.read(checkoutProvider).paymentMethod, PaymentMethod.maya);
    expect(find.text('Maya'), findsOneWidget);
  });

  testWidgets('credits-only mode clears an unavailable e-wallet selection', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(creditsOnlyMode: true),
        ),
      ],
    );
    addTearDown(container.dispose);
    container
        .read(checkoutProvider.notifier)
        .setPaymentMethod(PaymentMethod.gcash);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(container.read(checkoutProvider).paymentMethod, isNull);
    expect(find.text('Choose payment method'), findsOneWidget);
    expect(find.text('Beta orders use Pilot Credits only.'), findsOneWidget);
  });

  testWidgets('credits-only mode clears unavailable COD selection', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        checkoutPaymentSettingsProvider.overrideWith(
          (_) async => const CheckoutPaymentSettings(creditsOnlyMode: true),
        ),
      ],
    );
    addTearDown(container.dispose);
    container
        .read(checkoutProvider.notifier)
        .setPaymentMethod(PaymentMethod.cod);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutPaymentCard())),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(container.read(checkoutProvider).paymentMethod, isNull);
    expect(find.text('Choose payment method'), findsOneWidget);
    expect(find.text('Beta orders use Pilot Credits only.'), findsOneWidget);
  });
}

class _SeededAuthNotifier extends AuthNotifier {
  _SeededAuthNotifier(AuthState initialState) : super() {
    state = initialState;
  }
}
