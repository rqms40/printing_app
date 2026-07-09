import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { orderDeliveryAssignmentsByRoute } from './delivery-route';

function assignment(id: number, latitude: number, longitude: number) {
  return {
    id,
    createdAt: new Date(`2026-07-${String(id).padStart(2, '0')}T00:00:00Z`),
    order: { destination: { latitude, longitude } },
  } as DeliveryAssignment;
}

describe('orderDeliveryAssignmentsByRoute', () => {
  it('orders stops nearest-neighbor from the rider location', () => {
    const result = orderDeliveryAssignmentsByRoute(
      [assignment(1, 7.22, 125.72), assignment(2, 7.065, 125.609)],
      { latitude: 7.064, longitude: 125.608 },
    );

    expect(result.map((row) => row.id)).toEqual([2, 1]);
  });

  it('uses a stable id tie-break for stops at the same coordinates', () => {
    const first = assignment(1, 7.065, 125.609);
    const second = assignment(2, 7.065, 125.609);

    const forward = orderDeliveryAssignmentsByRoute([second, first]);
    const reverse = orderDeliveryAssignmentsByRoute([first, second]);

    expect(forward.map((row) => row.id)).toEqual([1, 2]);
    expect(reverse.map((row) => row.id)).toEqual([1, 2]);
  });

  it('orders missing-coordinate stops consistently', () => {
    const first = assignment(1, 0, 0);
    const second = assignment(2, 0, 0);

    expect(
      orderDeliveryAssignmentsByRoute([second, first]).map((row) => row.id),
    ).toEqual([1, 2]);
  });
});
