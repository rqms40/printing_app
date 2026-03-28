import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) return null;
    const { passwordHash, ...result } = user;
    return result;
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const user = await this.usersService.updateProfile(req.user.sub, body);
    const { passwordHash, ...result } = user;
    return result;
  }
}
