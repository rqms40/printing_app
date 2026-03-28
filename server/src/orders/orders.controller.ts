import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

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
  async getOrder(@Request() req: any, @Param('id') id: number) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== req.user.sub && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  @Post()
  createOrder(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create({ ...dto, userId: req.user.sub });
  }

  @Patch(':id/status')
  @Roles('admin')
  @UseGuards(RolesGuard)
  updateStatus(@Param('id') id: number, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
