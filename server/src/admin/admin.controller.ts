import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { DriversService } from '../drivers/drivers.service';
import { UpdateStatusDto } from '../orders/dto/update-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { CreditsService } from '../credits/credits.service';
import {
  buildAdminUserDetailPayload,
  buildAdminUsersAnalyticsPayload,
  normalizeUserInsightsPeriod,
} from './user-insights';
import { TamSurvey } from '../tam-surveys/entities/tam-survey.entity';
import { TamSurveySettings } from '../tam-surveys/entities/tam-survey-settings.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../drivers/entities/delivery-assignment.entity';

type AnalyticsPeriod = '7D' | '30D' | '6M';
type AnalyticsPoint = { label: string; value: number };
type MonthlyAnalyticsPoint = { month: string; value: number };

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private ordersService: OrdersService,
    private driversService: DriversService,
    private creditsService: CreditsService,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(TamSurvey)
    private tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveySettings)
    private tamSurveySettingsRepo: Repository<TamSurveySettings>,
    @InjectRepository(DriverProfile)
    private driverProfilesRepo: Repository<DriverProfile>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentsRepo: Repository<DeliveryAssignment>,
  ) {}

  @Patch('tam-surveys/settings')
  async updateTamSurveySettings(@Body() body: { isEnabled: boolean }) {
    let settings = await this.tamSurveySettingsRepo.findOne({
      where: { id: 1 },
    });
    if (!settings) {
      settings = this.tamSurveySettingsRepo.create({
        id: 1,
        isEnabled: body.isEnabled,
      });
    } else {
      settings.isEnabled = body.isEnabled;
    }
    await this.tamSurveySettingsRepo.save(settings);
    return settings;
  }

  private normalizeAnalyticsPeriod(period?: string): AnalyticsPeriod {
    return period === '7D' || period === '30D' || period === '6M'
      ? period
      : '6M';
  }

  private startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private startOfUtcMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addUtcDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private addUtcMonths(date: Date, months: number) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
    );
  }

  private formatDayLabel(date: Date) {
    return `${MONTH_LABELS[date.getUTCMonth()]} ${String(
      date.getUTCDate(),
    ).padStart(2, '0')}`;
  }

  private formatMonthLabel(date: Date) {
    return MONTH_LABELS[date.getUTCMonth()];
  }

  private buildDailyBuckets(now: Date, days: number) {
    const currentDay = this.startOfUtcDay(now);
    const start = this.addUtcDays(currentDay, -(days - 1));

    return Array.from({ length: days }, (_, index) => {
      const date = this.addUtcDays(start, index);
      const key = date.toISOString().slice(0, 10);

      return {
        key,
        label: this.formatDayLabel(date),
        start: date,
      };
    });
  }

  private buildMonthlyBuckets(now: Date, months: number) {
    const currentMonth = this.startOfUtcMonth(now);
    const start = this.addUtcMonths(currentMonth, -(months - 1));

    return Array.from({ length: months }, (_, index) => {
      const date = this.addUtcMonths(start, index);
      const key = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;

      return {
        key,
        label: this.formatMonthLabel(date),
        start: date,
      };
    });
  }

  private buildAnalyticsBuckets(period: AnalyticsPeriod, now: Date) {
    if (period === '7D') {
      return this.buildDailyBuckets(now, 7);
    }

    if (period === '30D') {
      return this.buildDailyBuckets(now, 30);
    }

    return this.buildMonthlyBuckets(now, 6);
  }

  private getBucketKey(date: Date, period: AnalyticsPeriod) {
    if (period === '6M') {
      return `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
    }

    return this.startOfUtcDay(date).toISOString().slice(0, 10);
  }

  private buildSeries(
    orders: Order[],
    period: AnalyticsPeriod,
    metric: 'sales' | 'volume',
    now: Date,
  ): AnalyticsPoint[] {
    const buckets = this.buildAnalyticsBuckets(period, now);
    const values = new Map<string, number>(
      buckets.map((bucket) => [bucket.key, 0]),
    );
    const earliestBucket = buckets[0]?.start ?? now;

    for (const order of orders) {
      if (order.createdAt < earliestBucket) {
        continue;
      }

      const bucketKey = this.getBucketKey(order.createdAt, period);

      if (!values.has(bucketKey)) {
        continue;
      }

      if (metric === 'sales') {
        if (
          order.paymentStatus !== 'paid' ||
          order.orderStatus === OrderStatus.CANCELLED ||
          order.orderStatus === OrderStatus.FILE_DECLINED
        ) {
          continue;
        }

        values.set(
          bucketKey,
          (values.get(bucketKey) ?? 0) + Number(order.totalPrice),
        );
        continue;
      }

      values.set(bucketKey, (values.get(bucketKey) ?? 0) + 1);
    }

    return buckets.map((bucket) => ({
      label: bucket.label,
      value: values.get(bucket.key) ?? 0,
    }));
  }

  private buildPaperSizeDemand(
    orders: Order[],
    period: AnalyticsPeriod,
    now: Date,
  ) {
    const buckets = this.buildAnalyticsBuckets(period, now);
    const earliestBucket = buckets[0]?.start ?? now;
    const totals = new Map<string, number>();

    for (const order of orders) {
      if (
        order.createdAt < earliestBucket ||
        order.category !== 'paper' ||
        !order.paperSpec ||
        order.orderStatus === OrderStatus.CANCELLED ||
        order.orderStatus === OrderStatus.FILE_DECLINED
      ) {
        continue;
      }

      const paperSize = order.paperSpec.paperSize.toUpperCase();
      totals.set(paperSize, (totals.get(paperSize) ?? 0) + 1);
    }

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }

  private buildMonthlySeries(
    orders: Order[],
    metric: 'sales' | 'volume',
    now: Date,
  ): MonthlyAnalyticsPoint[] {
    return this.buildSeries(orders, '6M', metric, now).map(
      ({ label, value }) => ({
        month: label,
        value,
      }),
    );
  }

  private async getAnalyticsOrders() {
    return this.ordersRepo.find({
      relations: ['paperSpec'],
    });
  }

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

  @Get('badge-counts')
  async getBadgeCounts() {
    const newOrders = await this.ordersRepo.count({
      where: {
        orderStatus: In([OrderStatus.ORDER_PLACED, OrderStatus.FILE_VERIFIED]),
      },
    });
    const pendingTopUps = await this.creditsService.getPendingCount();
    return { newOrders, pendingTopUps };
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
    const driverProfile = await this.driverProfilesRepo.findOneOrFail({
      where: { id: driverId },
    });

    await this.ordersRepo.update(id, {
      assignedDriverId: driverProfile.userId,
      orderStatus: OrderStatus.DRIVER_ASSIGNED,
    });

    let assignment = await this.deliveryAssignmentsRepo.findOne({
      where: { orderId: id },
    });

    if (assignment) {
      assignment.driverId = driverProfile.id;
      assignment.status = DeliveryStatus.ASSIGNED;
      assignment.assignedAt = new Date();
    } else {
      assignment = this.deliveryAssignmentsRepo.create({
        orderId: id,
        driverId: driverProfile.id,
        status: DeliveryStatus.ASSIGNED,
      });
    }

    await this.deliveryAssignmentsRepo.save(assignment);
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
      profile_category: u.profileCategory ?? null,
      profile_field: u.profileField ?? null,
      course: u.course ?? null,
      organization: u.organization ?? null,
      printing_preferences: u.printingPreferences ?? [],
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    }));
  }

  @Get('users/analytics')
  async getUsersAnalytics(@Query('period') period?: string) {
    const normalizedPeriod = normalizeUserInsightsPeriod(period);
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    const orders = await this.ordersRepo.find({ order: { createdAt: 'DESC' } });

    return buildAdminUsersAnalyticsPayload(
      users,
      orders,
      normalizedPeriod,
      new Date(),
    );
  }

  @Get('users/:id')
  async getUserDetail(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    const orders = await this.ordersRepo.find({
      where: { userId: id },
      order: { createdAt: 'DESC' },
    });

    return buildAdminUserDetailPayload(user, orders);
  }

  // Sales analytics for admin web dashboard
  @Get('analytics')
  async getAnalytics(@Query('period') period?: string) {
    const normalizedPeriod = this.normalizeAnalyticsPeriod(period);
    const now = new Date();
    const orders = await this.getAnalyticsOrders();

    return {
      sales: this.buildSeries(orders, normalizedPeriod, 'sales', now),
      volume: this.buildSeries(orders, normalizedPeriod, 'volume', now),
      paperSizeDemand: this.buildPaperSizeDemand(orders, normalizedPeriod, now),
    };
  }

  // Sales trend data (mobile admin client calls this endpoint)
  @Get('dashboard/sales')
  async getSales() {
    const orders = await this.getAnalyticsOrders();
    return this.buildMonthlySeries(orders, 'sales', new Date());
  }

  // Order volume data (mobile admin client calls this endpoint)
  @Get('dashboard/volume')
  async getVolume() {
    const orders = await this.getAnalyticsOrders();
    return this.buildMonthlySeries(orders, 'volume', new Date());
  }

  // TAM Surveys list
  @Get('tam-surveys')
  async getTamSurveys() {
    const surveys = await this.tamSurveysRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return surveys.map((s) => ({
      id: s.id,
      user_id: s.userId,
      user_name: s.user?.fullName ?? s.user?.email ?? 'Unknown',
      open_forum_feedback: s.openForumFeedback ?? null,
      survey_data: s.surveyData,
      is_approved_for_feed: s.isApprovedForFeed,
      created_at: s.createdAt,
    }));
  }

  // TAM Survey short view
  @Get('tam-surveys/:id')
  async getTamSurveyShow(@Param('id', ParseIntPipe) id: number) {
    const s = await this.tamSurveysRepo.findOneOrFail({
      where: { id },
      relations: ['user'],
    });
    return {
      id: s.id,
      user_id: s.userId,
      user_name: s.user?.fullName ?? s.user?.email ?? 'Unknown',
      open_forum_feedback: s.openForumFeedback ?? null,
      survey_data: s.surveyData,
      is_approved_for_feed: s.isApprovedForFeed,
      created_at: s.createdAt,
    };
  }

  // Toggle TAM Survey approval for feed
  @Patch('tam-surveys/:id/approve')
  async toggleSurveyApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body('isApprovedForFeed') isApprovedForFeed: boolean,
  ) {
    await this.tamSurveysRepo.update(id, { isApprovedForFeed });
    return { success: true, isApprovedForFeed };
  }
}
