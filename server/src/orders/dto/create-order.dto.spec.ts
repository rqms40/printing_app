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
          specialInstructions: 'Orient the logo toward the front edge.',
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
    expect(dto.items[0].specialInstructions).toBe(
      'Orient the logo toward the front edge.',
    );
    expect(dto.items[0].threeDSpecs?.infillPercentage).toBe(20);
    expect(dto.items[0].threeDSpecs?.layerHeight).toBe(0.2);
  });

  it('accepts a temporary pinned delivery address', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: 'paper',
          quantity: 1,
        },
      ],
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      temporaryAddress: {
        label: 'Temporary drop',
        fullAddress: 'Unit 12, Jacinto Extension, Davao City',
        city: 'Davao City',
        landmark: 'Beside the blue gate',
        latitude: '7.0731',
        longitude: '125.6128',
      },
    });

    const errors = await validate(dto);

    expect(errors).toEqual([]);
    expect(dto.temporaryAddress?.latitude).toBe(7.0731);
    expect(dto.temporaryAddress?.longitude).toBe(125.6128);
  });

  it('rejects a temporary address without address text or coordinates', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: 'paper',
          quantity: 1,
        },
      ],
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      temporaryAddress: {
        city: 'Davao City',
        latitude: 120,
        longitude: 250,
      },
    });

    const errors = await validate(dto);

    expect(errors).not.toEqual([]);
  });
});

import { CreateBatchOrderDto } from './create-order.dto';

describe('CreateBatchOrderDto extended fields', () => {
  it('accepts slot fields and destinations[]', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: 'paper',
          fileMetadataId: 1,
          quantity: 1,
          paperSpecs: {
            paperSize: 'a4',
            colorMode: 'blackAndWhite',
            mediaType: 'glossy',
            printSides: 'frontOnly',
            binding: 'none',
          },
          destinationIndex: 0,
        },
      ],
      paymentMethod: 'cash',
      deliveryOption: 'delivery',
      slotTemplateId: 1,
      slotDate: '2026-04-30',
      speedTier: 'priority',
      destinations: [{ addressId: 5, label: 'Office' }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts mixed saved and temporary destinations[]', async () => {
    const dto = plainToInstance(CreateBatchOrderDto, {
      items: [
        {
          category: 'paper',
          fileMetadataId: 1,
          quantity: 1,
          destinationIndex: 0,
        },
        {
          category: 'paper',
          fileMetadataId: 2,
          quantity: 1,
          destinationIndex: 1,
        },
      ],
      paymentMethod: 'cash',
      deliveryOption: 'delivery',
      destinations: [
        { addressId: '5', label: 'Home' },
        {
          label: 'Event booth',
          address: {
            fullAddress: 'SMX Booth A12, Davao City',
            city: 'Davao City',
            landmark: 'Near loading bay',
            latitude: '7.0731',
            longitude: '125.6128',
          },
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.destinations?.[0].addressId).toBe(5);
    expect(dto.destinations?.[1].address?.latitude).toBe(7.0731);
    expect(dto.destinations?.[1].address?.longitude).toBe(125.6128);
  });
});
