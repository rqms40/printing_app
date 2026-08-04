import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Supplier declines a pending assignment; order re-enters matching. */
export class DeclineSupplierJobDto {
  @ApiProperty({
    description: 'Why the supplier is declining the job',
    example: 'At capacity this week',
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;
}
