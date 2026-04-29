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
  async list(@Query('date') date: string) {
    return this.slotsService.getAvailability(date);
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
}
