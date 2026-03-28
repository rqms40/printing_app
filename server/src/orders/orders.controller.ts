import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  getOrders(@Request() req: any) {
    return this.ordersService.findByUser(req.user.sub);
  }

  @Get(':id')
  getOrder(@Param('id') id: number) {
    return this.ordersService.findById(id);
  }

  @Post()
  createOrder(@Request() req: any, @Body() body: any) {
    return this.ordersService.create({ ...body, userId: req.user.sub });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
