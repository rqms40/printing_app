import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { GeoZonesService } from './geo-zones.service';
import {
  CreateGeoZoneDto,
  UpdateCommerceSettingsDto,
  UpdateGeoZoneDto,
} from './dto/geo-zone.dto';

@ApiTags('geo-zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geo-zones')
export class GeoZonesController {
  constructor(private readonly geoZonesService: GeoZonesService) {}

  /** Ops + Super may list zones (read). */
  @Get()
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  list() {
    return this.geoZonesService.listZones();
  }

  @Get('commerce-settings')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  getCommerce() {
    return this.geoZonesService.getCommerceSettings();
  }

  @Patch('commerce-settings')
  @Roles(UserRole.SUPER_ADMIN)
  updateCommerce(@Body() dto: UpdateCommerceSettingsDto) {
    return this.geoZonesService.updateCommerceSettings(dto);
  }

  @Get(':id')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.geoZonesService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateGeoZoneDto) {
    return this.geoZonesService.createZone(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGeoZoneDto,
  ) {
    return this.geoZonesService.updateZone(id, dto);
  }
}
