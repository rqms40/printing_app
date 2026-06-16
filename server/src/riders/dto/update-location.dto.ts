import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsLatitude, IsLongitude } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ example: 14.5547 })
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 121.0244 })
  @IsNumber()
  @IsLongitude()
  longitude: number;
}
