import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeoService } from './geo.service';

@ApiTags('geo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('reverse')
  reverse(
    @Query('lat') latRaw: string,
    @Query('lng') lngRaw: string,
  ) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng query params are required');
    }
    return this.geoService.reverseGeocode(lat, lng);
  }

  @Get('autocomplete')
  autocomplete(
    @Query('q') q: string,
    @Query('session') session?: string,
  ) {
    return this.geoService.autocomplete(q ?? '', session);
  }

  @Get('place-details')
  placeDetails(
    @Query('placeId') placeId: string,
    @Query('session') session?: string,
  ) {
    return this.geoService.placeDetails(placeId, session);
  }
}
