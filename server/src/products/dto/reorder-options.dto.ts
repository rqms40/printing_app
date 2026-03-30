// server/src/products/dto/reorder-options.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsPositive, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsInt() @IsPositive() id: number;
  @IsInt() @Min(0) sortOrder: number;
}

export class ReorderOptionsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
