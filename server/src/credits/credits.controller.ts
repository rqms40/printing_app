import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import {
  GrantPilotCreditsDto,
  ManualAdjustmentDto,
  UpdateSettingsDto,
} from './dto/credits.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('settings')
  getSettings() {
    return this.creditsService.getSettings();
  }

  @Put('settings')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.creditsService.updateSettings(updateSettingsDto);
  }

  /**
   * Client balance + ledger history (Pilot Credits).
   * Reserve/spend/release are service-layer only (order payment path);
   * they are not exposed as client HTTP mint/debit endpoints.
   */
  @Get('me')
  getMyCredits(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.creditsService.getBalanceAndHistory(
      req.user.sub,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  /**
   * Ops/Super Admin: grant Pilot Credits (test instrument).
   */
  @Post('grant')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  grantPilotCredits(
    @Request() req: RequestWithUser,
    @Body() dto: GrantPilotCreditsDto,
  ) {
    return this.creditsService.grantPilotCredits(dto, req.user.sub);
  }

  /**
   * Ops/Super Admin: signed manual adjustment.
   */
  @Post('manual-adjustment')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  manualAdjustment(
    @Request() req: RequestWithUser,
    @Body() dto: ManualAdjustmentDto,
  ) {
    return this.creditsService.manualAdjustment(dto, req.user.sub);
  }

  /**
   * Client top-up disabled — Pilot Credits are grant-only.
   */
  @Post('request-topup')
  @HttpCode(HttpStatus.GONE)
  requestTopUp() {
    return this.creditsService.requestTopUp();
  }

  @Get('requests/pending')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  getPendingRequests() {
    return this.creditsService.getPendingRequests();
  }

  @Post('approve/:id')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  approveTopUp(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.approveTopUp(id);
  }

  @Post('reject/:id')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  rejectTopUp(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.rejectTopUp(id);
  }
}
