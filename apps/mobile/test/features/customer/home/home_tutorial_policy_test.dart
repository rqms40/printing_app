import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/screens/home_screen.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  test('loaded repeat-customer history suppresses a missing pipeline key', () {
    expect(
      shouldShowFirstOrderTutorial(
        ordersLoaded: true,
        hasOrderHistory: true,
        pipelineSeen: false,
        activeOrderStatuses: const [],
      ),
      isFalse,
    );
  });

  test('loaded empty history permits an unseen pipeline tutorial', () {
    expect(
      shouldShowFirstOrderTutorial(
        ordersLoaded: true,
        hasOrderHistory: false,
        pipelineSeen: false,
        activeOrderStatuses: const [],
      ),
      isTrue,
    );
  });

  test(
    'loading, seen, and active-delivery states suppress first-order help',
    () {
      expect(
        shouldShowFirstOrderTutorial(
          ordersLoaded: false,
          hasOrderHistory: false,
          pipelineSeen: false,
          activeOrderStatuses: const [],
        ),
        isFalse,
      );
      expect(
        shouldShowFirstOrderTutorial(
          ordersLoaded: true,
          hasOrderHistory: false,
          pipelineSeen: true,
          activeOrderStatuses: const [],
        ),
        isFalse,
      );
      expect(
        shouldShowFirstOrderTutorial(
          ordersLoaded: true,
          hasOrderHistory: false,
          pipelineSeen: false,
          activeOrderStatuses: const [OrderStatus.onTheWay],
        ),
        isFalse,
      );
    },
  );

  test('a second order never restarts first-order help', () {
    expect(
      shouldShowFirstOrderTutorial(
        ordersLoaded: true,
        hasOrderHistory: true,
        pipelineSeen: false,
        activeOrderStatuses: const [OrderStatus.completedPickup],
      ),
      isFalse,
    );
  });

  test('defers home tutorials until the initial order load completes', () {
    expect(
      shouldDeferHomeTutorial(
        ordersLoaded: false,
        activeOrderStatuses: const [],
      ),
      isTrue,
    );
  });

  test('defers home tutorials for every active delivery status', () {
    for (final status in const [
      OrderStatus.riderAssigned,
      OrderStatus.pickedUp,
      OrderStatus.onTheWay,
      OrderStatus.arrivedAtDestination,
    ]) {
      expect(
        shouldDeferHomeTutorial(
          ordersLoaded: true,
          activeOrderStatuses: [status],
        ),
        isTrue,
      );
    }
  });

  test('allows home tutorials after loading when no delivery is active', () {
    expect(
      shouldDeferHomeTutorial(
        ordersLoaded: true,
        activeOrderStatuses: const [OrderStatus.printingInProgress],
      ),
      isFalse,
    );
  });
}
