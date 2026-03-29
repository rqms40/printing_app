import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  getOrders(@Request() req: RequestWithUser) {
    return this.ordersService.findByUser(req.user.sub);
  }

  @Get(':id')
  async getOrder(@Request() req: RequestWithUser, @Param('id') id: number) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== req.user.sub && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  @Post()
  createOrder(@Request() req: RequestWithUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create({ ...dto, userId: req.user.sub });
  }

  @Patch(':id/status')
  @Roles('admin')
  @UseGuards(RolesGuard)
  updateStatus(@Param('id') id: number, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
