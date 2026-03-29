import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { DriversService } from '../drivers/drivers.service';
import { UpdateStatusDto } from '../orders/dto/update-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private ordersService: OrdersService,
    private driversService: DriversService,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
  ) {}

  // Dashboard KPIs
  @Get('dashboard')
  async getDashboard() {
    const orders = await this.ordersRepo.find();

    const newOrders = orders.filter(
      (o) =>
        o.orderStatus === OrderStatus.ORDER_PLACED ||
        o.orderStatus === OrderStatus.FILE_VERIFIED,
    ).length;

    const inProduction = orders.filter(
      (o) =>
        o.orderStatus === OrderStatus.PRINTING_IN_PROGRESS ||
        o.orderStatus === OrderStatus.FINISHING_MOUNTING ||
        o.orderStatus === OrderStatus.QUALITY_CHECKED,
    ).length;

    const readyForPickup = orders.filter(
      (o) => o.orderStatus === OrderStatus.READY_FOR_DISPATCH,
    ).length;

    const delivered = orders.filter(
      (o) =>
        o.orderStatus === OrderStatus.DELIVERED ||
        o.orderStatus === OrderStatus.COMPLETED_PICKUP,
    ).length;

    const monthlyRevenue = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.totalPrice), 0);

    return {
      newOrdersCount: newOrders,
      inProductionCount: inProduction,
      readyForPickupCount: readyForPickup,
      deliveredCount: delivered,
      monthlyRevenue,
      totalOrders: orders.length,
    };
  }

  // All orders (not filtered by user)
  @Get('orders')
  async getAllOrders() {
    return this.ordersRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  // Update any order's status
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // Assign driver to order
  @Post('orders/:id/assign')
  async assignDriver(
    @Param('id') id: number,
    @Body('driverId') driverId: number,
  ) {
    await this.ordersRepo.update(id, { assignedDriverId: driverId });
    return this.ordersRepo.findOneOrFail({ where: { id } });
  }

  // Available drivers
  @Get('drivers')
  async getAvailableDrivers() {
    return this.driversService.getAvailableDrivers();
  }

  // Sales analytics (mock 6-month data for now)
  @Get('analytics')
  async getAnalytics() {
    return {
      sales: [
        { month: 'Oct', value: 45200 },
        { month: 'Nov', value: 52800 },
        { month: 'Dec', value: 68500 },
        { month: 'Jan', value: 41300 },
        { month: 'Feb', value: 57900 },
        { month: 'Mar', value: 63400 },
      ],
      volume: [
        { month: 'Oct', value: 38 },
        { month: 'Nov', value: 45 },
        { month: 'Dec', value: 62 },
        { month: 'Jan', value: 35 },
        { month: 'Feb', value: 48 },
        { month: 'Mar', value: 55 },
      ],
    };
  }
}
