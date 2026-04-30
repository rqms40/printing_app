import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { PrinterProfileService } from './printer-profile.service';
import { UpdatePrinterProfileDto } from './dto/update-printer-profile.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PrinterProfileController {
  constructor(private readonly service: PrinterProfileService) {}

  @Get('printer-profile')
  getCustomer() {
    return this.service.getProfile();
  }

  @Get('admin/printer-profile')
  @UseGuards(RolesGuard)
  @Roles('admin')
  adminGet() {
    return this.service.getProfile();
  }

  @Patch('admin/printer-profile')
  @UseGuards(RolesGuard)
  @Roles('admin')
  adminUpdate(@Body() dto: UpdatePrinterProfileDto) {
    return this.service.updateProfile(dto);
  }
}
