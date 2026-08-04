import { getMetadataArgsStorage } from 'typeorm';
import {
  Order,
  PaymentAuthorizationStatus,
} from './order.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

function columnOptions(target: Function, propertyName: string) {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options;
}

describe('Order payment authorization entity metadata', () => {
  it('declares marketplace money columns as bigint minor units', () => {
    expect(columnType(Order, 'finalTotalMinor')).toBe('bigint');
    expect(columnType(Order, 'deliveryFeeMinor')).toBe('bigint');
  });

  it('declares authorization status enum, codEligible, and jsonb snapshot', () => {
    expect(columnType(Order, 'paymentAuthorizationStatus')).toBe('enum');
    expect(columnOptions(Order, 'paymentAuthorizationStatus')?.enum).toBe(
      PaymentAuthorizationStatus,
    );
    expect(columnOptions(Order, 'paymentAuthorizationStatus')?.default).toBe(
      PaymentAuthorizationStatus.NONE,
    );
    expect(columnType(Order, 'codEligible')).toBe('boolean');
    expect(columnOptions(Order, 'codEligible')?.default).toBe(false);
    expect(columnType(Order, 'authorizationSnapshot')).toBe('jsonb');
  });
});
