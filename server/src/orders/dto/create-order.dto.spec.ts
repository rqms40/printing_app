import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBatchOrderDto } from './create-order.dto';

describe('CreateBatchOrderDto', () => {
  it('accepts numeric-string deliveryAddressId as a number', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: '3d',
          quantity: '2',
          totalPrice: '120.50',
          fileMetadataId: '12',
          threeDSpecs: {
            fileFormat: 'stl',
            material: 'pla',
            color: 'white',
            infillPercentage: '20',
            layerHeight: '0.20',
            supports: false,
          },
        },
      ],
      deliveryFee: '50',
      paymentMethod: 'gridCredits',
      deliveryOption: 'delivery',
      deliveryAddressId: '9',
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
    expect(dto.deliveryAddressId).toBe(9);
    expect(dto.deliveryFee).toBe(50);
    expect(dto.items[0].quantity).toBe(2);
    expect(dto.items[0].totalPrice).toBe(120.5);
    expect(dto.items[0].fileMetadataId).toBe(12);
    expect(dto.items[0].threeDSpecs?.infillPercentage).toBe(20);
    expect(dto.items[0].threeDSpecs?.layerHeight).toBe(0.2);
  });
});
