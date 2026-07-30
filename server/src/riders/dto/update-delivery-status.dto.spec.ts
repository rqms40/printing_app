import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeliveryStatus } from '../entities/delivery-assignment.entity';
import {
  MAX_SIGNATURE_PROOF_BYTES,
  UpdateDeliveryStatusDto,
} from './update-delivery-status.dto';

describe('UpdateDeliveryStatusDto proof transport bounds', () => {
  const validateSignature = (signatureData: string) =>
    validate(
      plainToInstance(UpdateDeliveryStatusDto, {
        status: DeliveryStatus.DELIVERED,
        proof: { type: 'signature', signatureData },
      }),
    );

  it('accepts a normalized signature at the byte limit', async () => {
    await expect(
      validateSignature('x'.repeat(MAX_SIGNATURE_PROOF_BYTES)),
    ).resolves.toHaveLength(0);
  });

  it('rejects an empty normalized signature', async () => {
    await expect(validateSignature('   ')).resolves.not.toHaveLength(0);
  });

  it('rejects an ASCII signature over the transport limit', async () => {
    await expect(
      validateSignature('x'.repeat(MAX_SIGNATURE_PROOF_BYTES + 1)),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects a multibyte signature over the UTF-8 byte limit', async () => {
    await expect(
      validateSignature('🙂'.repeat(MAX_SIGNATURE_PROOF_BYTES / 4 + 1)),
    ).resolves.not.toHaveLength(0);
  });
});
