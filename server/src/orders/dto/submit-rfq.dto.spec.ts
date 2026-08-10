import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SubmitRfqDto } from './submit-rfq.dto';

const validPayload = () => ({
  items: [
    {
      categorySlug: 'flyers',
      quantity: '100',
      requiredDate: '2099-12-31',
      fileMetadataId: '41',
      specs: {
        dimensions_or_standard_size: 'A5',
        stock_or_material: 'C2S 100gsm',
        color: 'Full color',
        sides: 2,
        finish: 'Matte',
      },
      specialInstructions: 'Keep the safe area clear.',
      destinationIndex: 0,
    },
  ],
  deliveryOption: 'delivery',
  deliveryAddressId: '9',
});

describe('SubmitRfqDto', () => {
  it('accepts and transforms the dedicated RFQ batch contract', async () => {
    const dto = plainToInstance(SubmitRfqDto, validPayload());

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.items[0]).toMatchObject({
      categorySlug: 'flyers',
      quantity: 100,
      requiredDate: '2099-12-31',
      fileMetadataId: 41,
      destinationIndex: 0,
    });
    expect(dto.deliveryAddressId).toBe(9);
  });

  it('accepts 20 items and rejects 21 items', async () => {
    const payload = validPayload();
    const twenty = plainToInstance(SubmitRfqDto, {
      ...payload,
      items: Array.from({ length: 20 }, () => ({ ...payload.items[0] })),
    });
    const twentyOne = plainToInstance(SubmitRfqDto, {
      ...payload,
      items: Array.from({ length: 21 }, () => ({ ...payload.items[0] })),
    });

    await expect(validate(twenty)).resolves.toEqual([]);
    await expect(validate(twentyOne)).resolves.not.toEqual([]);
  });

  it.each([
    ['empty items', { items: [] }],
    ['zero quantity', { items: [{ ...validPayload().items[0], quantity: 0 }] }],
    [
      'malformed required date',
      { items: [{ ...validPayload().items[0], requiredDate: '31/12/2099' }] },
    ],
    [
      'missing specs',
      { items: [{ ...validPayload().items[0], specs: undefined }] },
    ],
    [
      'missing artwork metadata id',
      { items: [{ ...validPayload().items[0], fileMetadataId: undefined }] },
    ],
    ['unsupported delivery option', { deliveryOption: 'courier' }],
  ])('rejects %s', async (_case, overrides) => {
    const dto = plainToInstance(SubmitRfqDto, {
      ...validPayload(),
      ...overrides,
    });

    await expect(validate(dto)).resolves.not.toEqual([]);
  });
});
