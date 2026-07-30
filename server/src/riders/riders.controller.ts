import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { RidersService } from './riders.service';
import { UpdateRiderProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('riders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('rider')
@Controller('riders')
export class RidersController {
  constructor(private ridersService: RidersService) {}

  @Get('profile')
  getProfile(@Request() req: RequestWithUser) {
    return this.ridersService.getProfile(req.user.sub);
  }

  @Patch('profile')
  updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(req.user.sub, dto);
  }

  @Patch('availability')
  setAvailability(
    @Request() req: RequestWithUser,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.ridersService.setAvailability(req.user.sub, isAvailable);
  }

  @Patch('location')
  updateLocation(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.ridersService.updateLocation(req.user.sub, dto);
  }

  @Get('assignments')
  getAssignments(@Request() req: RequestWithUser) {
    return this.ridersService.getActiveAssignments(req.user.sub);
  }

  @Get('dispatch-plan')
  getDispatchPlan(@Request() req: RequestWithUser) {
    return this.ridersService.getDispatchPlan(req.user.sub);
  }

  @Post('dispatch-plan/re-optimize')
  reoptimizeDispatchPlan(@Request() req: RequestWithUser) {
    return this.ridersService.reoptimizeOwnDispatchPlan(req.user.sub);
  }

  @Patch('assignments/:id/status')
  updateDeliveryStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.ridersService.updateDeliveryStatus(
      req.user.sub,
      id,
      dto.status,
      dto.declineReason,
      dto.proof,
    );
  }

  @Get('history')
  getHistory(@Request() req: RequestWithUser) {
    return this.ridersService.getHistory(req.user.sub);
  }

  @Get('earnings')
  getEarnings(@Request() req: RequestWithUser) {
    return this.ridersService.getEarnings(req.user.sub);
  }
}
