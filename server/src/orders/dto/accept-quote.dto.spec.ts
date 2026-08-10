import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AcceptQuoteDto } from './accept-quote.dto';

describe('AcceptQuoteDto', () => {
  it.each(['pilot_credit', 'cod'] as const)(
    'accepts the %s payment rail',
    async (paymentMethod) => {
      const dto = plainToInstance(AcceptQuoteDto, {
        supplierAssignmentId: 41,
        paymentMethod,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects an unsupported payment label and invalid assignment id', async () => {
    const dto = plainToInstance(AcceptQuoteDto, {
      supplierAssignmentId: 0,
      paymentMethod: 'pending_quote',
    });

    const errors = await validate(dto);
    expect(errors.map(({ property }) => property).sort()).toEqual([
      'paymentMethod',
      'supplierAssignmentId',
    ]);
  });
});
