import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStorageSettingsDto } from './dto/update-storage-settings.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private tamSurveysService: TamSurveysService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: RequestWithUser) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) return null;
    const { passwordHash: _ph1, ...result } = user;
    return result;
  }

  @Post('fcm-token')
  async saveFcmToken(
    @Request() req: RequestWithUser,
    @Body('token') token: string,
  ) {
    await this.usersService.updateFcmToken(req.user.sub, token);
    return { success: true };
  }

  @Put('profile')
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const { dateOfBirth, ...rest } = dto;
    const data: Record<string, any> = { ...rest };
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
    const user = await this.usersService.updateProfile(req.user.sub, data);
    const { passwordHash: _ph2, ...result } = user;
    return result;
  }

  @Get('me/storage-settings')
  async getStorageSettings(@Request() req: RequestWithUser) {
    return this.usersService.getStorageSettings(req.user.sub);
  }

  @Get('me/account-state')
  async getAccountState(@Request() req: RequestWithUser) {
    return this.tamSurveysService.getAccountState(req.user.sub);
  }

  @Patch('me/storage-settings')
  async updateStorageSettings(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateStorageSettingsDto,
  ) {
    return this.usersService.updateStorageSettings(
      req.user.sub,
      dto.fileRetentionDays,
    );
  }
}
