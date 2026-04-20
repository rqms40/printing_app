import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';

export class RequestTopUpDto {
  @IsNumber()
  amountPhp: number;

  // The upload system first uploads standard files and gives us an ID or URL.
  // The client should pass the URL returned by the /files/upload API here.
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
