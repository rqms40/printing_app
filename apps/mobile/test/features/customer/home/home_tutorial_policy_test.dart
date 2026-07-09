import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/home/screens/home_screen.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
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
