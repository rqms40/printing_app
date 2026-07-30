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
  BadRequestException,
  Logger,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { RidersService } from '../riders/riders.service';
import { UpdateStatusDto } from '../orders/dto/update-status.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { adminAllowedNextOrderStatuses } from '../orders/order-status-transition';
import { User } from '../users/entities/user.entity';
import { CreditsService } from '../credits/credits.service';
import {
  buildAdminUserDetailPayload,
  buildAdminUsersAnalyticsPayload,
  normalizeUserInsightsPeriod,
} from './user-insights';
import { TamSurvey } from '../tam-surveys/entities/tam-survey.entity';
import { TamSurveySettings } from '../tam-surveys/entities/tam-survey-settings.entity';
import { DeliveryAssignment } from '../riders/entities/delivery-assignment.entity';
import { DeliveryDestination } from '../orders/entities/delivery-destination.entity';
import { OrdersGateway } from '../orders/orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import {
  CreateDispatchPlanDto,
  ReoptimizeDispatchPlanDto,
} from '../riders/dto/create-dispatch-plan.dto';

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
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private ordersService: OrdersService,
    private ridersService: RidersService,
    private creditsService: CreditsService,
    private ordersGateway: OrdersGateway,
    private notificationsService: NotificationsService,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(TamSurvey)
    private tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveySettings)
    private tamSurveySettingsRepo: Repository<TamSurveySettings>,
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
        order.orderStatus === OrderStatus.CANCELLED ||
        order.orderStatus === OrderStatus.FILE_DECLINED
      ) {
        continue;
      }

      const paperItems =
        order.items?.filter((item) => item.category === 'paper') ?? [];

      if (paperItems.length > 0) {
        for (const item of paperItems) {
          const paperSize = this.specValue(
            item.specValues,
            'paper_size',
          ).toUpperCase();
          totals.set(
            paperSize,
            (totals.get(paperSize) ?? 0) + (item.quantity ?? 1),
          );
        }
        continue;
      }

      if (order.category === 'paper') {
        const paperSize = this.specValue(
          order.items?.[0]?.specValues,
          'paper_size',
        ).toUpperCase();
        totals.set(
          paperSize,
          (totals.get(paperSize) ?? 0) + (order.quantity ?? 1),
        );
      }
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
      relations: ['items', 'items.specValues'],
    });
  }

  private specValue(
    values:
      | { specKey: string; value: string; displayValue: string }[]
      | undefined,
    key: string,
  ): string {
    const match = values?.find((value) => value.specKey === key);
    return match?.value ?? match?.displayValue ?? '';
  }

  private specSnapshots(
    values:
      | {
          specKey: string;
          specLabel: string;
          value: string;
          displayValue: string;
          optionId: number | null;
          optionLabel: string | null;
        }[]
      | undefined,
  ) {
    return (values ?? []).map((value) => ({
      key: value.specKey,
      label: value.specLabel,
      value: value.value,
      display_value: value.displayValue,
      option_id: value.optionId,
      option_label: value.optionLabel,
    }));
  }

  private paperSpecsFromValues(
    values:
      | { specKey: string; value: string; displayValue: string }[]
      | undefined,
  ) {
    if (!values?.some((value) => value.specKey === 'paper_size')) return null;
    return {
      paper_size: this.specValue(values, 'paper_size'),
      color_mode: this.specValue(values, 'color_mode'),
      media_type: this.specValue(values, 'media_type'),
      print_sides: this.specValue(values, 'print_sides'),
      binding: this.specValue(values, 'binding'),
      print_mode: this.specValue(values, 'print_mode'),
    };
  }

  private threeDSpecsFromValues(
    values:
      | { specKey: string; value: string; displayValue: string }[]
      | undefined,
  ) {
    if (!values?.some((value) => value.specKey === 'file_format')) return null;
    return {
      file_format: this.specValue(values, 'file_format'),
      material: this.specValue(values, 'material'),
      color: this.specValue(values, 'color'),
      infill_percentage: Number(this.specValue(values, 'infill_percentage')),
      layer_height: Number(this.specValue(values, 'layer_height')),
      supports: this.specValue(values, 'supports') === 'true',
      notes: this.specValue(values, 'notes') || null,
    };
  }

  private destinationSnapshot(destination?: DeliveryDestination | null) {
    if (!destination?.fullAddress) return null;

    return {
      id: destination.id,
      address_id: destination.addressId ?? null,
      label: destination.label ?? null,
      sort_order: destination.sortOrder ?? 0,
      address: destination.fullAddress,
      full_address: destination.fullAddress,
      barangay: destination.barangay ?? null,
      city: destination.city ?? null,
      province: destination.province ?? null,
      zip_code: destination.zipCode ?? null,
      landmark: destination.landmark ?? null,
      latitude:
        destination.latitude == null ? null : Number(destination.latitude),
      longitude:
        destination.longitude == null ? null : Number(destination.longitude),
    };
  }

  private destinationSnapshotsForOrder(o: Order) {
    const byId = new Map<
      number,
      NonNullable<ReturnType<typeof this.destinationSnapshot>>
    >();
    const byValue = new Map<
      string,
      NonNullable<ReturnType<typeof this.destinationSnapshot>>
    >();
    const add = (destination?: DeliveryDestination | null) => {
      const snapshot = this.destinationSnapshot(destination);
      if (!snapshot) return;
      if (snapshot.id != null) {
        byId.set(snapshot.id, snapshot);
        return;
      }
      byValue.set(
        `${snapshot.full_address}:${snapshot.latitude}:${snapshot.longitude}`,
        snapshot,
      );
    };

    add(o.destination);
    for (const item of o.items ?? []) {
      add(item.destination);
    }

    return [...byId.values(), ...byValue.values()].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  }

  private assignedRiderContact(o: Order) {
    const enriched = o as Order & {
      assignedRiderContact?: Record<string, unknown> | null;
    };
    if (enriched.assignedRiderContact) return enriched.assignedRiderContact;
    if (!o.assignedRiderId && !o.assignedRider) return null;

    return {
      user_id: o.assignedRider?.id ?? o.assignedRiderId ?? null,
      display_name:
        o.assignedRider?.fullName ?? o.assignedRider?.nickname ?? null,
      full_name: o.assignedRider?.fullName ?? null,
      nickname: o.assignedRider?.nickname ?? null,
      phone_number: o.assignedRider?.phoneNumber ?? null,
    };
  }

  private assignedRiderContactFromAssignment(
    assignment: DeliveryAssignment | undefined,
  ) {
    if (!assignment?.rider) return null;
    const rider = assignment.rider;
    const user = rider.user;
    return {
      user_id: rider.userId,
      rider_profile_id: rider.id,
      display_name: user?.fullName ?? user?.nickname ?? null,
      full_name: user?.fullName ?? null,
      nickname: user?.nickname ?? null,
      phone_number: user?.phoneNumber ?? null,
      vehicle_type: rider.vehicleType ?? null,
      plate_number: rider.plateNumber ?? null,
      delivery_assignment_id: assignment.id,
      delivery_status: assignment.status,
      proof: this.deliveryProofFromAssignment(assignment),
    };
  }

  private deliveryProofFromAssignment(
    assignment: DeliveryAssignment | undefined,
  ) {
    if (!assignment?.proofType) return null;
    return {
      type: assignment.proofType,
      fileId: assignment.proofFileId ?? null,
      objectKey: assignment.proofObjectKey ?? null,
      signatureData: assignment.proofSignatureData ?? null,
      capturedAt: assignment.proofCapturedAt ?? null,
      capturedByRiderId: assignment.proofCapturedByRiderId ?? null,
    };
  }

  private async attachDeliveryAssignmentDetails(
    orders: Order[],
  ): Promise<Order[]> {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    if (orderIds.length === 0) return orders;

    const assignments = await this.deliveryAssignmentsRepo.find({
      where: { orderId: In(orderIds), isCurrent: true },
      relations: ['rider', 'rider.user'],
      order: { createdAt: 'DESC' },
    });
    const assignmentByOrderId = new Map<number, DeliveryAssignment>();
    for (const assignment of assignments) {
      if (!assignmentByOrderId.has(assignment.orderId)) {
        assignmentByOrderId.set(assignment.orderId, assignment);
      }
    }

    return orders.map((order) => {
      const assignment = assignmentByOrderId.get(order.id);
      return Object.assign(order, {
        assignedRiderContact:
          this.assignedRiderContactFromAssignment(assignment) ??
          (
            order as Order & {
              assignedRiderContact?: Record<string, unknown> | null;
            }
          ).assignedRiderContact,
        deliveryProof: this.deliveryProofFromAssignment(assignment),
      });
    });
  }

  private deliveryProof(o: Order) {
    const enriched = o as Order & {
      deliveryProof?: Record<string, unknown> | null;
      assignedRiderContact?: { proof?: Record<string, unknown> | null } | null;
    };
    const proof =
      enriched.deliveryProof ?? enriched.assignedRiderContact?.proof;
    if (!proof) return null;

    return {
      type: proof.type ?? null,
      file_id: proof.fileId ?? proof.file_id ?? null,
      object_key: proof.objectKey ?? proof.object_key ?? null,
      signature_data: proof.signatureData ?? proof.signature_data ?? null,
      captured_at: proof.capturedAt ?? proof.captured_at ?? null,
      captured_by_rider_id:
        proof.capturedByRiderId ?? proof.captured_by_rider_id ?? null,
    };
  }

  private mapOrder(o: Order) {
    const firstPaperItem = (o.items ?? []).find(
      (item) => item.category === 'paper',
    );
    const firstThreeDItem = (o.items ?? []).find(
      (item) => item.category === '3d',
    );
    const paperSpecs = this.paperSpecsFromValues(firstPaperItem?.specValues);
    const threeDSpecs = this.threeDSpecsFromValues(firstThreeDItem?.specValues);

    return {
      id: o.id,
      order_id: o.orderId,
      user_id: o.userId,
      category: o.category,
      file_url: o.fileUrl ?? null,
      file_name: o.fileName ?? null,
      file_metadata_id: o.fileMetadataId ?? null,
      special_instructions: o.items?.[0]?.specialInstructions ?? null,
      quantity: o.quantity,
      total_price: Number(o.totalPrice),
      delivery_fee: Number(o.deliveryFee),
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      order_status: o.orderStatus,
      allowed_next_statuses: adminAllowedNextOrderStatuses(
        o.orderStatus,
        o.deliveryOption,
      ),
      delivery_option: o.deliveryOption,
      delivery_address_id: o.deliveryAddressId ?? null,
      delivery_address: this.destinationSnapshot(o.destination),
      destinations: this.destinationSnapshotsForOrder(o),
      delivery_slot_booking_id: o.batchOrder?.slotBookingId ?? null,
      speed_tier: o.batchOrder?.speedTier ?? null,
      priority_fee:
        o.batchOrder?.priorityFee == null
          ? 0
          : Number(o.batchOrder.priorityFee),
      priority:
        o.batchOrder?.priorityFee == null
          ? false
          : Number(o.batchOrder.priorityFee) > 0,
      delivery_type: o.batchOrder?.deliveryType ?? null,
      extra_destination_fee:
        o.batchOrder?.extraDestinationFee == null
          ? 0
          : Number(o.batchOrder.extraDestinationFee),
      admin_notes: o.adminNotes ?? null,
      decline_reason: o.declineReason ?? null,
      cancellation_reason: o.cancellationReason ?? null,
      estimated_completion_at: o.estimatedCompletionAt ?? null,
      assigned_rider_id: o.assignedRiderId ?? null,
      assigned_rider_contact: this.assignedRiderContact(o),
      delivery_proof: this.deliveryProof(o),
      created_at: o.createdAt,
      updated_at: o.updatedAt,
      paper_specs: paperSpecs,
      three_d_specs: threeDSpecs,
      items: (o.items ?? []).map((item) => ({
        id: item.id,
        order_id: item.orderId,
        destination_id: item.destinationId ?? null,
        delivery_address_id: item.destination?.addressId ?? null,
        delivery_address: this.destinationSnapshot(item.destination),
        category: item.category,
        file_url: item.fileUrl ?? null,
        file_name: item.fileName ?? null,
        file_metadata_id: item.fileMetadataId ?? null,
        special_instructions: item.specialInstructions ?? null,
        quantity: item.quantity,
        total_price: Number(item.totalPrice),
        category_id: item.categoryId,
        category_slug: item.categorySlug,
        category_name: item.categoryName,
        pricing_model: item.pricingModel,
        specs: this.specSnapshots(item.specValues),
        paper_specs: this.paperSpecsFromValues(item.specValues),
        three_d_specs: this.threeDSpecsFromValues(item.specValues),
      })),
      status_history: (o.statusHistory ?? []).map((h) => ({
        id: h.id,
        order_id: h.orderId,
        from_status: h.fromStatus,
        to_status: h.toStatus,
        changed_by_user_id: h.changedByUserId,
        notes: h.notes ?? null,
        created_at: h.createdAt,
      })),
      customer_id: o.user?.id ?? o.userId ?? null,
      customer_name: o.user?.fullName ?? null,
      customer_email: o.user?.email ?? null,
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
      relations: [
        'batchOrder',
        'destination',
        'items',
        'items.destination',
        'items.specValues',
        'user',
        'assignedRider',
      ],
    });
    const enriched = await this.attachDeliveryAssignmentDetails(orders);
    return enriched.map((o) => this.mapOrder(o));
  }

  // Single order detail
  @Get('orders/:id')
  async getOrder(@Param('id', ParseIntPipe) id: number) {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id },
      relations: [
        'batchOrder',
        'destination',
        'items',
        'items.destination',
        'items.specValues',
        'statusHistory',
        'user',
        'assignedRider',
      ],
    });
    const [enriched] = await this.attachDeliveryAssignmentDetails([order]);
    return this.mapOrder(enriched);
  }

  // Update any order's status
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @Request() req: RequestWithUser,
  ) {
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Use the cancellation workflow');
    }
    if (dto.status === OrderStatus.RIDER_ASSIGNED) {
      throw new BadRequestException(
        'Use the rider assignment endpoint to assign riders',
      );
    }

    return this.ordersService.updateStatus(
      id,
      dto.status,
      {},
      {
        actorUserId: req.user.sub,
        reason: dto.notes?.trim() || 'Admin status update',
      },
    );
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

  // Assign rider to order
  @Post('orders/:id/assign')
  async assignRider(
    @Param('id', ParseIntPipe) id: number,
    @Body('riderId', ParseIntPipe) riderId: number,
    @Request() req: RequestWithUser,
  ) {
    const {
      order,
      assignment: savedAssignment,
      riderProfile,
    } = await this.ridersService.assignOrderToRider(id, riderId, req.user.sub);

    try {
      await Promise.resolve(
        this.ordersGateway.notifyRiderAssignment(riderProfile.userId, {
          assignmentId: savedAssignment.id,
          orderId: order.id,
          orderRef: order.orderId,
          status: savedAssignment.status,
          change: 'assigned',
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Rider assignment WS notification failed for order ${order.id}: ${error}`,
      );
    }
    try {
      await this.notificationsService.create({
        userId: riderProfile.userId,
        title: 'New delivery assignment',
        message: `You've been assigned to order ${order.orderId}.`,
        type: 'rider_assigned',
        orderRef: order.orderId,
        metadata: {
          assignmentId: savedAssignment.id,
          orderId: order.id,
          orderRef: order.orderId,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Rider assignment notification failed for order ${order.id}: ${error}`,
      );
    }

    return order;
  }

  // All riders with user info
  @Get('riders')
  async getAllRiders() {
    return this.ridersService.getAllRidersWithUser();
  }

  @Post('riders/:id/dispatch-plan')
  createDispatchPlan(
    @Param('id', ParseIntPipe) riderId: number,
    @Body() dto: CreateDispatchPlanDto,
  ) {
    return this.ridersService.createDispatchPlan(riderId, dto.assignmentIds);
  }

  @Get('riders/:id/dispatch-plan')
  getDispatchPlan(@Param('id', ParseIntPipe) riderId: number) {
    return this.ridersService.getDispatchPlanForRider(riderId);
  }

  @Post('riders/:id/dispatch-plan/re-optimize')
  reoptimizeDispatchPlan(
    @Param('id', ParseIntPipe) riderId: number,
    @Body() dto: ReoptimizeDispatchPlanDto,
  ) {
    return this.ridersService.reoptimizeDispatchPlan(
      riderId,
      dto.assignmentIds,
    );
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
      relations: ['user', 'order'],
      order: { createdAt: 'DESC' },
    });

    return surveys.map((s) => ({
      id: s.id,
      user_id: s.userId,
      user_name: s.user?.fullName ?? s.user?.email ?? 'Unknown',
      order_id: s.orderId ?? null,
      order_ref: s.order?.orderId ?? null,
      requirement_id: s.requirementId ?? null,
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
      relations: ['user', 'order'],
    });
    return {
      id: s.id,
      user_id: s.userId,
      user_name: s.user?.fullName ?? s.user?.email ?? 'Unknown',
      order_id: s.orderId ?? null,
      order_ref: s.order?.orderId ?? null,
      requirement_id: s.requirementId ?? null,
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
