import { BadRequestException } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';
import type { QualityService } from '../quality/quality.service';

describe('OrdersController generic status boundary', () => {
  let updateStatus: jest.Mock;
  let controller: OrdersController;

  beforeEach(() => {
    updateStatus = jest.fn();
    controller = new OrdersController(
      { updateStatus } as OrdersService,
      {} as QualityService,
    );
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

describe('OrdersController RFQ submission', () => {
  it('routes the authenticated owner to the dedicated RFQ service', async () => {
    const submitRfq = jest.fn().mockResolvedValue({
      batchId: 'BATCH-10001',
      orders: [],
    });
    const controller = new OrdersController(
      { submitRfq } as unknown as OrdersService,
      {} as QualityService,
    );
    const dto = {
      items: [
        {
          categorySlug: 'flyers',
          quantity: 100,
          requiredDate: '2099-12-31',
          fileMetadataId: 41,
          specs: { dimensions_or_standard_size: 'A5' },
        },
      ],
      deliveryOption: 'pickup' as const,
    };

    await expect(
      controller.submitRfq({ user: { sub: 42 } }, dto),
    ).resolves.toEqual({ batchId: 'BATCH-10001', orders: [] });
    expect(submitRfq).toHaveBeenCalledWith(42, dto);
  });
});

describe('OrdersController quote acceptance', () => {
  it('routes the authenticated owner and exact quote selection to the service', async () => {
    const acceptQuote = jest.fn().mockResolvedValue({
      id: 42,
      orderStatus: OrderStatus.AWAITING_PAYMENT,
    });
    const controller = new OrdersController(
      { acceptQuote } as unknown as OrdersService,
      {} as QualityService,
    );
    const dto = {
      supplierAssignmentId: 17,
      paymentMethod: 'pilot_credit' as const,
    };

    await expect(
      controller.acceptQuote({ user: { sub: 9 } }, 42, dto),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.AWAITING_PAYMENT });
    expect(acceptQuote).toHaveBeenCalledWith(42, 9, dto);
  });
});
