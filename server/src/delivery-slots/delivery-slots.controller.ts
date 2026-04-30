import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Query,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { UpdateSlotTemplateDto } from './dto/update-slot-template.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DeliverySlotsController {
  constructor(
    private readonly slotsService: DeliverySlotsService,
    private readonly settingsService: DeliverySettingsService,
    @InjectRepository(DeliverySlotTemplate)
    private readonly templateRepo: Repository<DeliverySlotTemplate>,
  ) {}

  @Get('delivery-slots')
  async list(
    @Query('date') date: string,
    @Query('pickupOnly') pickupOnly?: string,
  ) {
    return this.slotsService.getAvailability(date, {
      pickupOnly: pickupOnly === 'true',
    });
  }

  @Get('admin/delivery-slot-templates')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminListTemplates() {
    return this.templateRepo.find({
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  @Post('admin/delivery-slot-templates')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminCreateTemplate(@Body() dto: UpdateSlotTemplateDto) {
    return this.templateRepo.save(this.templateRepo.create(dto));
  }

  @Patch('admin/delivery-slot-templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminUpdateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotTemplateDto,
  ) {
    await this.templateRepo.update(id, dto);
    return this.templateRepo.findOneOrFail({ where: { id } });
  }

  @Delete('admin/delivery-slot-templates/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminDeleteTemplate(@Param('id', ParseIntPipe) id: number) {
    await this.templateRepo.delete(id);
    return { ok: true };
  }

  @Get('admin/settings/delivery')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminGetSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('admin/settings/delivery')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminUpdateSettings(@Body() dto: UpdateDeliverySettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Get('admin/delivery-slots/today')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminTodayDashboard(@Query('date') date?: string) {
    const today = date ?? new Date().toISOString().slice(0, 10);
    return this.slotsService.getTodaySnapshot(today);
  }

  /// Returns booking counts for a 7-day window starting at `weekStart`.
  /// Used by the admin "Today's Slots" week-pill navigator so it can show
  /// per-day totals in a single round trip instead of N parallel calls.
  @Get('admin/delivery-slots/week-counts')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminWeekCounts(@Query('weekStart') weekStart: string) {
    return this.slotsService.getWeekBookingCounts(weekStart);
  }

  @Patch('admin/slot-bookings/order')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminReorderBookings(@Body() body: { orderedIds: number[] }) {
    await this.slotsService.reorderBookings(body.orderedIds);
    return { ok: true };
  }

  @Patch('admin/slot-bookings/:id/priority')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminSetPriority(
    @Param('id') id: string,
    @Body() body: { priority: boolean },
  ) {
    const updated = await this.slotsService.setPriority(
      Number(id),
      body.priority,
    );
    return { ok: true, booking: updated };
  }
}
