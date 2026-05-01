import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';

void main() {
  test('toApi returns the lowercase wire string', () {
    expect(DeliverySpeedTier.priority.toApi(), 'priority');
    expect(DeliverySpeedTier.standard.toApi(), 'standard');
    expect(DeliverySpeedTier.saver.toApi(), 'saver');
    expect(DeliverySpeedTier.scheduled.toApi(), 'scheduled');
  });

  test('fromApi parses known values, defaults to standard', () {
    expect(DeliverySpeedTier.fromApi('priority'), DeliverySpeedTier.priority);
    expect(DeliverySpeedTier.fromApi('garbage'), DeliverySpeedTier.standard);
    expect(DeliverySpeedTier.fromApi(null), DeliverySpeedTier.standard);
  });
}
