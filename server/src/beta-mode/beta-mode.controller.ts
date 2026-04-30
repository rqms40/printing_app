import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { BetaModeService } from './beta-mode.service';
import { UpdateBetaModeSettingsDto } from './dto/beta-mode.dto';

@ApiTags('beta-mode')
@ApiBearerAuth()
@Controller('beta-mode')
export class BetaModeController {
  constructor(private readonly service: BetaModeService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('settings')
  updateSettings(@Body() dto: UpdateBetaModeSettingsDto) {
    return this.service.updateSettings(dto.isEnabled);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('users')
  getBetaUsers() {
    return this.service.getBetaUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users/:userId/enroll')
  @HttpCode(204)
  enrollUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.enrollUser(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('users/:userId/enroll')
  @HttpCode(204)
  unenrollUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.unenrollUser(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('members')
  searchMembers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.searchBetaMembers({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('users/:userId/survey-exempt')
  setSurveyExempt(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { exempt: boolean },
  ) {
    return this.service.setBetaSurveyExempt(userId, !!body.exempt);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getBetaStatus(@Req() req: { user: { sub: number } }) {
    return this.service.getBetaStatus(req.user.sub);
  }
}
