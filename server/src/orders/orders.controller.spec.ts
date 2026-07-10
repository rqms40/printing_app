import { BadRequestException } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersController generic status boundary', () => {
  let updateStatus: jest.Mock;
  let controller: OrdersController;

  beforeEach(() => {
    updateStatus = jest.fn();
    controller = new OrdersController({ updateStatus } as OrdersService);
  });

  it('rejects cancellation in favor of the complete cancellation workflow', () => {
    expect(() => {
      void controller.updateStatus({ user: { sub: 31 } }, 42, {
        status: OrderStatus.CANCELLED,
      });
    }).toThrow(BadRequestException);

    expect(updateStatus).not.toHaveBeenCalled();
  });
});
