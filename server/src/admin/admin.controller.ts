import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
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
import { User } from '../users/entities/user.entity';

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
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  private mapOrder(o: Order) {
    return {
      id: o.id,
      order_id: o.orderId,
      user_id: o.userId,
      category: o.category,
      file_url: o.fileUrl ?? null,
      file_name: o.fileName ?? null,
      quantity: o.quantity,
      total_price: Number(o.totalPrice),
      delivery_fee: Number(o.deliveryFee),
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      order_status: o.orderStatus,
      delivery_option: o.deliveryOption,
      admin_notes: o.adminNotes ?? null,
      decline_reason: o.declineReason ?? null,
      cancellation_reason: o.cancellationReason ?? null,
      estimated_completion_at: o.estimatedCompletionAt ?? null,
      assigned_driver_id: o.assignedDriverId ?? null,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
      paper_specs: o.paperSpec
        ? {
            paper_size: o.paperSpec.paperSize,
            color_mode: o.paperSpec.colorMode,
            media_type: o.paperSpec.mediaType,
            print_sides: o.paperSpec.printSides,
            binding: o.paperSpec.binding,
          }
        : null,
      three_d_specs: o.threeDSpec
        ? {
            file_format: o.threeDSpec.fileFormat,
            material: o.threeDSpec.material,
            color: o.threeDSpec.color,
            infill_percentage: o.threeDSpec.infillPercentage,
            layer_height: Number(o.threeDSpec.layerHeight),
            supports: o.threeDSpec.supports,
            notes: o.threeDSpec.notes ?? null,
          }
        : null,
      status_history: (o.statusHistory ?? []).map((h) => ({
        id: h.id,
        order_id: h.orderId,
        from_status: h.fromStatus,
        to_status: h.toStatus,
        changed_by_user_id: h.changedByUserId,
        notes: h.notes ?? null,
        created_at: h.createdAt,
      })),
    };
  }

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
    const orders = await this.ordersRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['paperSpec', 'threeDSpec'],
    });
    return orders.map((o) => this.mapOrder(o));
  }

  // Single order detail
  @Get('orders/:id')
  async getOrder(@Param('id', ParseIntPipe) id: number) {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id },
      relations: ['paperSpec', 'threeDSpec', 'statusHistory'],
    });
    return this.mapOrder(order);
  }

  // Update any order's status
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // Update admin notes
  @Patch('orders/:id/notes')
  async updateNotes(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNotes') adminNotes: string,
  ) {
    await this.ordersRepo.update(id, { adminNotes });
    return { success: true };
  }

  // Assign driver to order
  @Post('orders/:id/assign')
  async assignDriver(
    @Param('id', ParseIntPipe) id: number,
    @Body('driverId') driverId: number,
  ) {
    await this.ordersRepo.update(id, { assignedDriverId: driverId });
    return this.ordersRepo.findOneOrFail({ where: { id } });
  }

  // All drivers with user info
  @Get('drivers')
  async getAllDrivers() {
    return this.driversService.getAllDriversWithUser();
  }

  // All users
  @Get('users')
  async getAllUsers() {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    return users.map((u) => ({
      id: u.id,
      full_name: u.fullName ?? null,
      email: u.email,
      phone_number: u.phoneNumber ?? null,
      role: u.role,
      is_active: u.isActive,
      is_profile_complete: u.isProfileComplete,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    }));
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

  // Sales trend data (Flutter calls this endpoint)
  @Get('dashboard/sales')
  async getSales() {
    return [
      { month: 'Oct', value: 45200 },
      { month: 'Nov', value: 52800 },
      { month: 'Dec', value: 68500 },
      { month: 'Jan', value: 41300 },
      { month: 'Feb', value: 57900 },
      { month: 'Mar', value: 63400 },
    ];
  }

  // Order volume data (Flutter calls this endpoint)
  @Get('dashboard/volume')
  async getVolume() {
    return [
      { month: 'Oct', value: 38 },
      { month: 'Nov', value: 45 },
      { month: 'Dec', value: 62 },
      { month: 'Jan', value: 35 },
      { month: 'Feb', value: 48 },
      { month: 'Mar', value: 55 },
    ];
  }
}
