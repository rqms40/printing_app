import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({ example: 'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg?X-Amz-Signature=...' })
  url: string;
}
