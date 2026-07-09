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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { RequestTopUpDto, UpdateSettingsDto } from './dto/credits.dto';
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
  @Roles('admin')
  updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.creditsService.updateSettings(updateSettingsDto);
  }

  @Post('request-topup')
  requestTopUp(
    @Request() req: RequestWithUser,
    @Body() requestTopUpDto: RequestTopUpDto,
  ) {
    return this.creditsService.requestTopUp(req.user.sub, requestTopUpDto);
  }

  @Get('requests/pending')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getPendingRequests() {
    return this.creditsService.getPendingRequests();
  }

  @Post('approve/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  approveTopUp(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.approveTopUp(id);
  }

  @Post('reject/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  rejectTopUp(@Param('id', ParseIntPipe) id: number) {
    return this.creditsService.rejectTopUp(id);
  }
}
