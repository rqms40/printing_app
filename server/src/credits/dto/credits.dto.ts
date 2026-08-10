import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** @deprecated Client top-up is disabled for Pilot Credits. */
export class RequestTopUpDto {
  @IsNumber()
  amountPhp: number;

  @IsString()
  proofOfPaymentUrl: string;
}

export class UpdateSettingsDto {
  @IsNumber()
  conversionRate: number;

  @IsOptional()
  @IsBoolean()
  creditsOnlyMode?: boolean;
}

export class GrantPilotCreditsDto {
  @Type(() => Number)
  @IsInt()
  userId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceId?: string;
}

export class ReserveCreditsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(128)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceId?: string;
}

export class SpendCreditsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(128)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceId?: string;

  /** When set, spend settles a prior reserve with this idempotency key. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reserveIdempotencyKey?: string;
}

export class ReleaseCreditsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(128)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reserveIdempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceId?: string;
}

export class ManualAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  userId: number;

  /** Signed delta: positive credits the account, negative debits. */
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceId?: string;
}
