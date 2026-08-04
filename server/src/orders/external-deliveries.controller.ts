import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExternalDeliveriesController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('admin/external-deliveries')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  async list(@Query('status') status?: string) {
    return this.ordersService.listExternalDeliveries(status);
  }

  @Patch('admin/external-deliveries/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'pending_admin' | 'booked' | 'delivered' },
  ) {
    await this.ordersService.updateExternalDeliveryStatus(id, body.status);
    return { ok: true };
  }
}
