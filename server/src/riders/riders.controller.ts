import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Inject,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { RidersService } from './riders.service';
import { RiderPayoutsService } from './rider-payouts.service';
import { UpdateRiderProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { ROUTING_PROVIDER } from './routing/routing-provider';
import type { RoutingProvider } from './routing/routing-provider';
import { numericPoint } from './dispatch-plan.service';

@ApiTags('riders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('rider')
@Controller('riders')
export class RidersController {
  constructor(
    private ridersService: RidersService,
    private riderPayoutsService: RiderPayoutsService,
    @Inject(ROUTING_PROVIDER) private routingProvider: RoutingProvider,
  ) {}

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
  async updateDeliveryStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    try {
      return await this.ridersService.updateDeliveryStatus(
        req.user.sub,
        id,
        dto.status,
        dto.declineReason,
        dto.proof,
        dto.otp,
        dto.checklist,
      );
    } catch (e) {
      console.error('ERROR IN updateDeliveryStatus:', e);
      throw e;
    }
  }

  @Get('history')
  getHistory(@Request() req: RequestWithUser) {
    return this.ridersService.getHistory(req.user.sub);
  }

  @Get('earnings')
  getEarnings(@Request() req: RequestWithUser) {
    return this.ridersService.getEarnings(req.user.sub);
  }

  @Get('payouts')
  getPayouts(@Request() req: RequestWithUser) {
    return this.riderPayoutsService.listForRiderUser(req.user.sub);
  }

  @Get('route')
  async getRoute(
    @Query('fromLat') fromLat: string,
    @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string,
    @Query('toLng') toLng: string,
  ) {
    const from = numericPoint(fromLat, fromLng);
    const to = numericPoint(toLat, toLng);
    if (!from || !to) {
      throw new BadRequestException('Invalid coordinates');
    }
    const legs = await this.routingProvider.getRoute([from, to]);
    if (legs.length === 0) {
      throw new BadRequestException('No route found');
    }
    return legs[0];
  }
}
