import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliverySlotsService } from './delivery-slots.service';

@Controller('delivery-slots')
@UseGuards(JwtAuthGuard)
export class DeliverySlotsController {
  constructor(private readonly slotsService: DeliverySlotsService) {}

  @Get()
  async list(@Query('date') date: string) {
    return this.slotsService.getAvailability(date);
  }
}
