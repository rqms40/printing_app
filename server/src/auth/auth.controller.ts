import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, {
      fullName: dto.fullName,
      nickname: dto.nickname,
      phoneNumber: dto.phoneNumber,
      gender: dto.gender,
      ageRange: dto.ageRange,
      dateOfBirth: dto.dateOfBirth,
      profileCategory: dto.profileCategory,
      profileField: dto.profileField,
      course: dto.course,
      organization: dto.organization,
      clientAccountType: dto.clientAccountType,
      printingPreferences: dto.printingPreferences,
      matchingPreference: dto.matchingPreference,
      serviceFocusRanks: dto.serviceFocusRanks,
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
