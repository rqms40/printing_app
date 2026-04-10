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
  updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    // Note: In a real app we would add @Roles(UserRole.ADMIN) guard here
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
  getPendingRequests() {
    // Note: In a real app we would add @Roles(UserRole.ADMIN) guard here
    return this.creditsService.getPendingRequests();
  }

  @Post('approve/:id')
  approveTopUp(@Param('id', ParseIntPipe) id: number) {
    // Note: In a real app we would add @Roles(UserRole.ADMIN) guard here
    return this.creditsService.approveTopUp(id);
  }

  @Post('reject/:id')
  rejectTopUp(@Param('id', ParseIntPipe) id: number) {
    // Note: In a real app we would add @Roles(UserRole.ADMIN) guard here
    return this.creditsService.rejectTopUp(id);
  }
}
