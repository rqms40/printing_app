import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { DriversService } from './drivers.service';
import { UpdateDriverProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
@Controller('drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return this.driversService.getProfile(req.user.sub);
  }

  @Patch('profile')
  updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.driversService.updateProfile(req.user.sub, dto);
  }

  @Patch('availability')
  setAvailability(
    @Request() req: RequestWithUser,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.driversService.setAvailability(req.user.sub, isAvailable);
  }

  @Patch('location')
  updateLocation(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(req.user.sub, dto);
  }

  @Get('assignments')
  getAssignments(@Request() req: RequestWithUser) {
    return this.driversService.getActiveAssignments(req.user.sub);
  }

  @Patch('assignments/:id/status')
  updateDeliveryStatus(
    @Request() req: RequestWithUser,
    @Param('id') id: number,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.driversService.updateDeliveryStatus(
      req.user.sub,
      id,
      dto.status,
      dto.declineReason,
    );
  }

  @Get('history')
  getHistory(@Request() req: RequestWithUser) {
    return this.driversService.getHistory(req.user.sub);
  }

  @Get('earnings')
  getEarnings(@Request() req: RequestWithUser) {
    return this.driversService.getEarnings(req.user.sub);
  }
}
