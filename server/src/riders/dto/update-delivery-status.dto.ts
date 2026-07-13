import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  buildMessage,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import {
  DeliveryStatus,
  ProofOfDeliveryType,
} from '../entities/delivery-assignment.entity';

export const MAX_SIGNATURE_PROOF_BYTES = 65_536;

function MaxUtf8Bytes(maxBytes: number, validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'maxUtf8Bytes',
      constraints: [maxBytes],
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' ||
          Buffer.byteLength(value, 'utf8') <= maxBytes,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be no more than $constraint1 UTF-8 bytes`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

export class ProofOfDeliveryDto {
  @ApiProperty({
    enum: ProofOfDeliveryType,
    example: ProofOfDeliveryType.PHOTO,
  })
  @IsEnum(ProofOfDeliveryType)
  type: ProofOfDeliveryType;

  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsInt()
  @Min(1)
  fileId?: number;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Ignored for photo proof; the server resolves the audited object key from fileId.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  objectKey?: string;

  @ApiPropertyOptional({
    example: '{"format":"gridgo-signature-v1","points":[[12,18],[13,19]]}',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    const rawValue: unknown = value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @MaxLength(MAX_SIGNATURE_PROOF_BYTES)
  @MaxUtf8Bytes(MAX_SIGNATURE_PROOF_BYTES)
  signatureData?: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.PICKED_UP })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiPropertyOptional({ example: 'Customer unreachable' })
  @IsOptional()
  @IsString()
  declineReason?: string;

  @ApiPropertyOptional({ type: ProofOfDeliveryDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProofOfDeliveryDto)
  proof?: ProofOfDeliveryDto;
}
