// server/src/products/dto/reorder-options.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItemDto {
  @IsInt() @IsPositive() id: number;
  @IsInt() sortOrder: number;
}

export class ReorderOptionsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
