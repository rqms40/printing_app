import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/navigation/legacy_order_route_guard.dart';

void main() {
  group('legacy saved-draft route guard', () {
    test('fresh Paper and 3D routes return to the grouped catalog', () {
      expect(
        resolveLegacyOrderDraftRedirect(
          requestedCategory: 'paper',
          savedDraftCategory: null,
        ),
        '/customer/order/new',
      );
      expect(
        resolveLegacyOrderDraftRedirect(
          requestedCategory: '3d',
          savedDraftCategory: null,
        ),
        '/customer/order/new',
      );
    });

    test('only an exact historical draft category may use a legacy route', () {
      expect(
        resolveLegacyOrderDraftRedirect(
          requestedCategory: 'paper',
          savedDraftCategory: 'paper',
        ),
        isNull,
      );
      expect(
        resolveLegacyOrderDraftRedirect(
          requestedCategory: '3d',
          savedDraftCategory: '3d',
        ),
        isNull,
      );
      expect(
        resolveLegacyOrderDraftRedirect(
          requestedCategory: 'paper',
          savedDraftCategory: '3d',
        ),
        '/customer/order/new',
      );
    });
  });
}
