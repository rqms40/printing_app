import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Rider delivery collection proof for COD cash. */
export class RecordCodCollectionDto {
  @ApiPropertyOptional({
    description: 'Opaque OTP verification reference (not the raw secret)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  otpRef?: string;

  @ApiPropertyOptional({
    description: 'Photo / receipt file metadata id',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  photoFileId?: number;

  @ApiPropertyOptional({
    description: 'Additional proof refs (receipt keys, object paths)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  receiptRefs?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Rider profile id performing collection',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  riderId?: number;
}

/** Rider/ops: mark COD cash collection failed (customer could not pay). */
export class FailCodCollectionDto {
  @ApiPropertyOptional({
    description: 'Why cash could not be collected',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnReason?: string;

  @ApiPropertyOptional({
    description: 'Photo / evidence file metadata id',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  photoFileId?: number;

  @ApiPropertyOptional({
    description: 'Additional proof refs',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  receiptRefs?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Rider profile id',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  riderId?: number;
}

/** Ops/Super Admin reconciliation of collected COD cash. */
export class ReconcileCodCollectionDto {
  @ApiPropertyOptional({
    description: 'Optional discrepancy note when cash differs from expected',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  discrepancyReason?: string;
}

/** Admin toggle for pilot COD verification / ops risk. */
export class UpdateUserCodEligibilityDto {
  @ApiPropertyOptional({
    description: 'When true, client may use pilot COD (subject to other rules)',
  })
  @IsOptional()
  @IsBoolean()
  pilotCodEligible?: boolean;

  @ApiPropertyOptional({
    description: 'When true, COD is blocked by ops risk policy',
  })
  @IsOptional()
  @IsBoolean()
  codOpsRiskBlocked?: boolean;
}
