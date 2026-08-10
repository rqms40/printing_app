import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  BETA_ORDER_LIMIT_MESSAGE,
  BETA_ORDER_LIMIT_REACHED,
} from './dto/beta-order-limit.error';
import {
  Order,
  OrderStatus,
  MarketplacePaymentMethod,
  PaymentAuthorizationStatus,
  PricingStatus,
} from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemSpecValue } from './entities/order-item-spec-value.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import {
  freezeAuthorizationSnapshotOnOrder,
  pesosToMinor,
  type FreezeAuthorizationInput,
} from './order-authorization-snapshot';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../riders/entities/delivery-assignment.entity';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreditMutationResult,
  CreditsService,
} from '../credits/credits.service';
import { PaymentsService } from '../payments/payments.service';
import { isCodPaymentMethod } from '../payments/cod-eligibility';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import {
  CreateBatchOrderDto,
  TemporaryDeliveryAddressDto,
} from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { SubmitRfqDto } from './dto/submit-rfq.dto';
import { AcceptQuoteDto, QuotePaymentMethod } from './dto/accept-quote.dto';
import {
  minorToCredits,
  normalizePositiveSafeMinor,
  subtractSafeMinor,
} from './order-quote-money';
import {
  assertUnambiguousArtworkProducts,
  lockRfqCatalog,
  resolveArtworkInLockOrder,
} from './rfq-locking';
import { DeliverySpeedTier } from './enums/delivery-speed-tier.enum';
import { UpdateManualStatusDto } from './dto/update-manual-status.dto';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsService } from '../delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../delivery-slots/delivery-slots.gateway';
import { DeliverySlotBooking } from '../delivery-slots/entities/delivery-slot-booking.entity';
import {
  CancellationClosedException,
  ServiceAreaMismatchException,
  SlotFullException,
} from '../delivery-slots/exceptions';
import { GeoZonesService } from '../geo-zones/geo-zones.service';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
import { TamSurveyRequirement } from '../tam-surveys/entities/tam-survey-requirement.entity';
import {
  CatalogPricingService,
  PricedQuoteResult,
  QuoteResult,
} from '../products/catalog-pricing.service';
import {
  CatalogCategory,
  CatalogReadService,
} from '../products/catalog-read.service';
import {
  DispatchPlan,
  DispatchPlanStatus,
} from '../riders/entities/dispatch-plan.entity';
import { DispatchStopStatus } from '../riders/entities/dispatch-plan-stop.entity';
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';
import {
  assertTransition,
  assertOrderStatusTransition,
  parseOrderStatus,
} from './order-status-transition';
import { AuditService } from '../audit/audit.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  IssuesService,
  type OrderClaimSummary,
} from '../issues/issues.service';
import { ProductCategory } from '../products/entities/product-category.entity';
import { isActiveOrderableRfqLeaf } from '../products/catalog-v1-10.definition';
import { CatalogValidationService } from '../products/catalog-validation.service';

// Slot definitions live in operator-local time (Asia/Manila, UTC+8). The API
// server may run in UTC, so we never use server-local Date#getHours/setHours
// for slot math — we compute against PH wall-clock directly from the UTC clock.
const PH_OFFSET_MINUTES = 8 * 60;
const AUTO_SLOT_SEARCH_DAYS = 14;
const STANDARD_DELIVERY_FEE = 25;
const SERVICE_FEE = 2;
const RIDER_ASSIGNMENT_WORKFLOW_STATUSES = new Set<OrderStatus>([
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
]);

function phMinutesSinceMidnight(date: Date): number {
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMin + PH_OFFSET_MINUTES) % (24 * 60);
}

function phTodayDateString(now: Date = new Date()): string {
  // Shift to PH then take YYYY-MM-DD. Avoids returning yesterday's UTC date
  // when an order is placed late at night PH (which is "tomorrow" UTC).
  const phMs = now.getTime() + PH_OFFSET_MINUTES * 60_000;
  return new Date(phMs).toISOString().slice(0, 10);
}

function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse a future Philippines calendar date at the start of that local day. */
export function parseFutureRequiredDate(
  value: string,
  now: Date = new Date(),
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Required date must use YYYY-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  const requiredAt = new Date(
    Date.UTC(year, month - 1, day) - PH_OFFSET_MINUTES * 60_000,
  );
  const roundTrip = new Date(requiredAt.getTime() + PH_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
  if (roundTrip !== value) {
    throw new BadRequestException('Required date is invalid');
  }
  if (value <= phTodayDateString(now)) {
    throw new BadRequestException('Required date must be in the future');
  }
  return requiredAt;
}

type NormalizedTemporaryDeliveryAddress = {
  label?: string;
  fullAddress: string;
  barangay?: string;
  city: string;
  province?: string;
  zipCode?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
};

type RiderProfileMetadataRow = {
  vehicle_type: unknown;
  plate_number: unknown;
};

type NormalizedDeliveryDestination = {
  addressId: number | null;
  label: string | null;
  fullAddress: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
};

type SlotCandidate = {
  slotTemplateId: number;
  date: string;
  startTime: string;
  endTime: string;
};

type AssignedSlot = SlotCandidate & {
  bookingId?: number;
};

type AssignedRiderContact = {
  userId: number;
  riderProfileId: number;
  displayName: string | null;
  fullName: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
  deliveryAssignmentId: number | null;
  deliveryStatus: DeliveryStatus;
  proof: {
    type: string | null;
    fileId: number | null;
    objectKey: string | null;
    signatureData: string | null;
    capturedAt: Date | null;
    capturedByRiderId: number | null;
  } | null;
};

export type PendingRfqSpecValue = Pick<
  OrderItemSpecValue,
  | 'id'
  | 'orderItemId'
  | 'specDefinitionId'
  | 'specKey'
  | 'specLabel'
  | 'inputType'
  | 'value'
  | 'displayValue'
  | 'optionId'
  | 'optionLabel'
>;

export type PendingRfqOrderItem = Omit<
  OrderItem,
  'totalPrice' | 'specValues'
> & {
  totalPrice: null;
  specValues: PendingRfqSpecValue[];
};

export type PendingRfqOrder = Omit<
  Order,
  'totalPrice' | 'deliveryFee' | 'deliveryFeeMinor' | 'items'
> & {
  totalPrice: null;
  deliveryFee: null;
  deliveryFeeMinor: null;
  items: PendingRfqOrderItem[];
};

export type CreateBatchResult<TOrder = Order> = {
  batchId: string;
  orders: TOrder[];
  assignedSlot?: AssignedSlot;
};

type ChargeComponent = number | string | null | undefined;

export type ChargeComponents = {
  subtotal?: ChargeComponent;
  totalPrice?: ChargeComponent;
  deliveryFee?: ChargeComponent;
  priorityFee?: ChargeComponent;
  extraDestinationFee?: ChargeComponent;
};

export type OrderStatusChangeContext = {
  actorUserId: number;
  reason: string;
  /** Role at time of change (client, ops_admin, system, …). */
  actorRole?: string | null;
};

export type OrderCompletionTransactionResult = {
  previous: Order;
  surveyRequirement: TamSurveyRequirement | null;
  /** Status string used for client notification copy (may differ from intermediate steps). */
  publishedStatus?: OrderStatus | string;
};

function numericChargeComponent(
  name: keyof ChargeComponents,
  value: ChargeComponent,
): number {
  if (value == null) return 0;
  if (typeof value === 'string' && value.trim() === '') {
    throw new BadRequestException(`Invalid ${name} charge component`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new BadRequestException(`Invalid ${name} charge component`);
  }
  return amount;
}

export function calculateChargeTotal(components: ChargeComponents): number {
  const subtotalKey = components.subtotal == null ? 'totalPrice' : 'subtotal';
  return (
    numericChargeComponent(subtotalKey, components[subtotalKey]) +
    numericChargeComponent('deliveryFee', components.deliveryFee) +
    numericChargeComponent('priorityFee', components.priorityFee) +
    numericChargeComponent(
      'extraDestinationFee',
      components.extraDestinationFee,
    )
  );
}

/**
 * Marketplace money/authorization defaults for new orders.
 * Snapshot stays null until freezeAuthorizationSnapshot (payment module).
 */
export function applyMarketplacePaymentDefaults(
  order: Partial<Order>,
): Partial<Order> {
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const totalPrice = Number(order.totalPrice ?? 0);
  const finalMajor = calculateChargeTotal({
    totalPrice,
    deliveryFee,
  });

  return {
    ...order,
    deliveryFeeMinor:
      order.deliveryFeeMinor != null && order.deliveryFeeMinor !== ''
        ? order.deliveryFeeMinor
        : pesosToMinor(deliveryFee),
    finalTotalMinor:
      order.finalTotalMinor != null && order.finalTotalMinor !== ''
        ? order.finalTotalMinor
        : pesosToMinor(finalMajor),
    paymentAuthorizationStatus:
      order.paymentAuthorizationStatus ?? PaymentAuthorizationStatus.NONE,
    codEligible: order.codEligible ?? false,
    authorizationSnapshot: order.authorizationSnapshot ?? null,
  };
}

export type PaymentWaitExpiryOutcome =
  | 'expired'
  | 'not_waiting'
  | 'operations_resolution_required';

export interface PaymentWaitExpiryResult {
  outcome: PaymentWaitExpiryOutcome;
  order: Order;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private static readonly ORDER_RELATIONS = [
    'batchOrder',
    'destination',
    'items',
    'items.destination',
    'items.specValues',
    // Logistics + marketplace status transitions for client/admin timelines.
    'statusHistory',
  ];

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemSpecValue)
    private orderItemSpecValueRepo: Repository<OrderItemSpecValue>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentRepo: Repository<DeliveryAssignment>,
    @InjectRepository(SupplierAssignment)
    private supplierAssignmentRepo: Repository<SupplierAssignment>,
    @InjectRepository(Address)
    private addressRepo: Repository<Address>,
    @InjectRepository(DeliveryDestination)
    private deliveryDestinationRepo: Repository<DeliveryDestination>,
    @InjectRepository(BatchOrder)
    private batchOrdersRepo: Repository<BatchOrder>,
    private ordersGateway: OrdersGateway,
    private firebaseService: FirebaseService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private filesService: FilesService,
    private tamSurveysService: TamSurveysService,
    private dataSource: DataSource,
    private slotsService: DeliverySlotsService,
    private settingsService: DeliverySettingsService,
    private slotsGateway: DeliverySlotsGateway,
    private printerProfileService: PrinterProfileService,
    private catalogPricingService: CatalogPricingService,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepo: Repository<FileMetadata>,
    @InjectRepository(DispatchPlan)
    private readonly dispatchPlanRepo: Repository<DispatchPlan>,
    private readonly auditService: AuditService,
    @Optional() private readonly geoZonesService?: GeoZonesService,
    @Optional() private readonly payoutsService?: PayoutsService,
    @Optional() private readonly issuesService?: IssuesService,
    @Optional() private readonly catalogReadService?: CatalogReadService,
  ) {}

  async findByUser(userId: number): Promise<Order[]> {
    const orders = await this.ordersRepo.find({
      where: { userId },
      relations: OrdersService.ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    const withCatalog = await this.attachCatalogSnapshots(orders);
    return (await this.attachDeliveryAssignmentIds(withCatalog)).map((order) =>
      this.maskPendingRfqMoney(order),
    );
  }

  async findById(id: number): Promise<Order | null> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: OrdersService.ORDER_RELATIONS,
    });
    if (!order) return null;
    const [withCatalog] = await this.attachCatalogSnapshots([order]);
    const [withTracking] = await this.attachDeliveryAssignmentIds([
      withCatalog,
    ]);
    return this.maskPendingRfqMoney(withTracking);
  }

  async attachCatalogSnapshots(orders: Order[]): Promise<Order[]> {
    let categoryById = new Map<number, CatalogCategory>();
    let categoryBySlug = new Map<string, CatalogCategory>();
    if (this.catalogReadService) {
      try {
        const catalog = await this.catalogReadService.getPublicCatalog(true);
        categoryById = new Map(
          catalog.categories.map((category) => [category.id, category]),
        );
        categoryBySlug = new Map(
          catalog.categories.map((category) => [category.slug, category]),
        );
      } catch (error) {
        this.logger.warn(`Order catalog projection failed: ${String(error)}`);
      }
    }

    return orders.map((order) => {
      const items = (order.items ?? []).map((item) => {
        const product =
          (item.categoryId == null
            ? undefined
            : categoryById.get(item.categoryId)) ??
          categoryBySlug.get(item.categorySlug ?? item.category);
        const specs = (item.specValues ?? []).map((spec) => ({
          key: spec.specKey,
          label: spec.specLabel,
          inputType: spec.inputType,
          value: spec.value,
          displayValue: spec.displayValue,
          optionId: spec.optionId,
          optionLabel: spec.optionLabel,
        }));
        return {
          ...item,
          categorySlug: item.categorySlug ?? item.category,
          categoryName: item.categoryName ?? product?.name ?? null,
          groupSlug: product?.groupSlug ?? null,
          groupName: product?.groupName ?? null,
          groupDescription: product?.groupDescription ?? null,
          examples: product?.examples ?? [],
          pricingModel: item.pricingModel ?? product?.pricingModel ?? null,
          catalogProduct: product
            ? {
                slug: product.slug,
                name: product.name,
                groupSlug: product.groupSlug,
                groupName: product.groupName,
                groupDescription: product.groupDescription,
                examples: product.examples ?? [],
              }
            : null,
          specs,
        };
      });
      return { ...order, items } as Order;
    });
  }

  private maskPendingRfqMoney(order: Order): Order {
    if (order.pricingStatus !== PricingStatus.PENDING_QUOTE) return order;
    const batchOrder = order.batchOrder
      ? {
          ...order.batchOrder,
          subtotal: null,
          deliveryFee: null,
          totalPrice: null,
          priorityFee: null,
          extraDestinationFee: null,
        }
      : order.batchOrder;
    const items = (order.items ?? []).map((item) => ({
      ...item,
      totalPrice: null,
      specValues: (item.specValues ?? []).map((spec) => ({
        id: spec.id,
        orderItemId: spec.orderItemId,
        specDefinitionId: spec.specDefinitionId,
        specKey: spec.specKey,
        specLabel: spec.specLabel,
        inputType: spec.inputType,
        value: spec.value,
        displayValue: spec.displayValue,
        optionId: spec.optionId,
        optionLabel: spec.optionLabel,
      })),
    }));
    return {
      ...order,
      totalPrice: null,
      deliveryFee: null,
      deliveryFeeMinor: null,
      finalTotalMinor: null,
      quotedTotalMinor: null,
      batchOrder,
      items,
    } as unknown as Order;
  }

  private async attachDeliveryAssignmentIds(orders: Order[]): Promise<Order[]> {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    if (orderIds.length === 0) return orders;

    const batchOrderIds = [
      ...new Set(
        orders
          .map((order) => order.batchOrderId)
          .filter((id): id is number => id != null),
      ),
    ];
    const slotBookings =
      batchOrderIds.length === 0
        ? []
        : await this.dataSource.getRepository(DeliverySlotBooking).find({
            where: { batchOrderId: In(batchOrderIds) },
            relations: ['slotTemplate'],
          });
    const assignedSlotByBatchOrderId = new Map<number, AssignedSlot>();
    for (const booking of slotBookings) {
      assignedSlotByBatchOrderId.set(booking.batchOrderId, {
        slotTemplateId: booking.slotTemplateId,
        date: booking.date,
        startTime: booking.slotTemplate.startTime,
        endTime: booking.slotTemplate.endTime,
      });
    }

    const assignments = await this.deliveryAssignmentRepo.find({
      where: {
        orderId: In(orderIds),
        isCurrent: true,
        status: In([
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.ACCEPTED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.ON_THE_WAY,
          DeliveryStatus.ARRIVED,
          DeliveryStatus.DELIVERED,
        ]),
      },
      relations: ['rider', 'rider.user'],
    });

    const assignmentByOrderId = new Map<number, DeliveryAssignment>();
    for (const assignment of assignments ?? []) {
      if (!assignmentByOrderId.has(assignment.orderId)) {
        assignmentByOrderId.set(assignment.orderId, assignment);
      }
    }

    // Latest non-cancelled supplier assignment per order (pending/accepted).
    const supplierAssignments = await this.supplierAssignmentRepo.find({
      where: {
        orderId: In(orderIds),
        decision: In([
          SupplierAssignmentDecision.PENDING,
          SupplierAssignmentDecision.ACCEPTED,
        ]),
      },
      relations: { supplier: true },
      order: { id: 'DESC' },
    });
    const supplierByOrderId = new Map<number, SupplierAssignment>();
    for (const sa of supplierAssignments ?? []) {
      if (!supplierByOrderId.has(sa.orderId)) {
        supplierByOrderId.set(sa.orderId, sa);
      }
    }

    const riderIds = [
      ...new Set(
        (assignments ?? [])
          .map((assignment) => assignment.riderId)
          .filter((id): id is number => id != null),
      ),
    ];
    const plans =
      riderIds.length === 0
        ? []
        : await this.dispatchPlanRepo.find({
            where: {
              riderId: In(riderIds),
              status: DispatchPlanStatus.ACTIVE,
            },
            relations: ['stops'],
          });
    const planByRiderId = new Map(plans.map((plan) => [plan.riderId, plan]));

    const claimsByOrderId: Map<number, OrderClaimSummary[]> =
      this.issuesService != null
        ? await this.issuesService.listSummariesByOrderIds(orderIds)
        : new Map<number, OrderClaimSummary[]>();

    return Promise.all(
      orders.map(async (order) => {
        const {
          quotedByUserId: _quotedByUserId,
          quotedByUser: _quotedByUser,
          ...customerSafeOrder
        } = order;
        const assignment = assignmentByOrderId.get(order.id);
        const supplierAssignment = supplierByOrderId.get(order.id);
        const plan = assignment?.riderId
          ? planByRiderId.get(assignment.riderId)
          : undefined;
        const remainingStops = (plan?.stops ?? [])
          .filter((stop) => stop.status === DispatchStopStatus.PENDING)
          .sort((left, right) => left.sequence - right.sequence);
        const plannedStop = assignment
          ? plan?.stops?.find(
              (candidate) => candidate.assignmentId === assignment.id,
            )
          : undefined;
        const routeIndex = assignment
          ? remainingStops.findIndex(
              (candidate) => candidate.assignmentId === assignment.id,
            )
          : -1;
        const queuePosition = routeIndex >= 0 ? routeIndex + 1 : null;
        const currentStop = routeIndex === 0 ? remainingStops[0] : null;
        const canTrackDelivery =
          queuePosition === 1 &&
          assignment != null &&
          [DeliveryStatus.ON_THE_WAY, DeliveryStatus.ARRIVED].includes(
            assignment.status,
          );

        // Customer-facing delivery handoff OTP only (pickup OTP is supplier/ops).
        const deliveryOtp =
          assignment &&
          !assignment.deliveryOtpVerifiedAt &&
          [
            DeliveryStatus.PICKED_UP,
            DeliveryStatus.ON_THE_WAY,
            DeliveryStatus.ARRIVED,
          ].includes(assignment.status)
            ? (assignment.deliveryOtpCode ?? null)
            : null;

        const supplierContact =
          await this.assignedSupplierContactFromAssignment(supplierAssignment);
        const acceptedQuoteAssignmentId =
          supplierAssignment?.decision === SupplierAssignmentDecision.ACCEPTED
            ? supplierAssignment.id
            : null;
        return {
          ...customerSafeOrder,
          deliveryAssignmentId: canTrackDelivery ? assignment?.id : null,
          deliveryQueuePosition: queuePosition,
          deliveryQueueSize:
            routeIndex >= 0 ? remainingStops.length || null : null,
          deliveryPlanState: plannedStop ? 'planned' : 'unplanned',
          deliveryPlanVersion: plannedStop ? (plan?.version ?? null) : null,
          deliveryRouteGeometry: canTrackDelivery
            ? (currentStop?.legGeometry ?? null)
            : null,
          deliveryLegDurationSeconds: canTrackDelivery
            ? (currentStop?.legDurationSeconds ?? null)
            : null,
          deliveryLegDistanceMeters: canTrackDelivery
            ? (currentStop?.legDistanceMeters ?? null)
            : null,
          deliveryRoutingDataStale: canTrackDelivery
            ? (plan?.routingDataStale ?? false)
            : null,
          canTrackDelivery,
          deliveryOtp,
          assignedRiderContact: this.assignedRiderContactFromAssignment(
            assignment,
            canTrackDelivery,
          ),
          assignedSupplierContact: supplierContact,
          quoteAssignmentId: acceptedQuoteAssignmentId,
          quote_assignment_id: acceptedQuoteAssignmentId,
          assignedSlot:
            order.batchOrderId == null
              ? undefined
              : assignedSlotByBatchOrderId.get(order.batchOrderId),
          claims: claimsByOrderId.get(order.id) ?? [],
        } as unknown as Order;
      }),
    );
  }

  private assignedSupplierContactFromAssignment(
    assignment: SupplierAssignment | undefined,
  ): Promise<{
    businessName: string;
    logoUrl: string | null;
    address: string | null;
    broadAddress: string | null;
    selfQcEvidenceUrls: string[];
    selfQcEvidenceFileIds: number[];
  } | null> {
    return this.buildAssignedSupplierContact(assignment);
  }

  private async buildAssignedSupplierContact(
    assignment: SupplierAssignment | undefined,
  ): Promise<{
    businessName: string;
    logoUrl: string | null;
    address: string | null;
    broadAddress: string | null;
    selfQcEvidenceUrls: string[];
    selfQcEvidenceFileIds: number[];
  } | null> {
    if (!assignment) return null;
    const supplier = assignment.supplier;
    const address = supplier?.address?.trim() || null;
    const broadAddress = this.formatBroadSupplierAddress(
      address,
      supplier?.serviceZones ?? [],
    );
    const logoUrl = await this.signFileId(supplier?.logoFileId ?? null);
    let evidenceIds = this.normalizeFileIdList(
      assignment.selfQcEvidenceFileIds,
    );
    // Historical self-QC may only exist in audit metadata (pre-persist).
    if (evidenceIds.length === 0) {
      evidenceIds = await this.loadSelfQcEvidenceFromAudit(assignment.id);
    }
    const selfQcEvidenceUrls: string[] = [];
    for (const fileId of evidenceIds) {
      const url = await this.signFileId(fileId);
      if (url) selfQcEvidenceUrls.push(url);
    }

    return {
      businessName:
        supplier?.businessName?.trim() || `Supplier #${assignment.supplierId}`,
      logoUrl,
      address,
      broadAddress,
      selfQcEvidenceUrls,
      selfQcEvidenceFileIds: evidenceIds,
    };
  }

  private normalizeFileIdList(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    const out: number[] = [];
    for (const item of raw) {
      const n =
        typeof item === 'number'
          ? item
          : typeof item === 'string'
            ? Number(item)
            : Number.NaN;
      if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
        out.push(n);
      }
    }
    return [...new Set(out)];
  }

  /** Recover evidence file ids from supplier_self_qc audit when column is empty. */
  private async loadSelfQcEvidenceFromAudit(
    assignmentId: number,
  ): Promise<number[]> {
    try {
      const rows = await this.dataSource.query<Array<{ evidence: unknown }>>(
        `
        SELECT metadata->'evidenceFileIds' AS evidence
        FROM audit_events
        WHERE action = 'supplier_self_qc'
          AND entity_type = 'supplier_assignment'
          AND entity_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [String(assignmentId)],
      );
      const evidence = rows[0]?.evidence;
      return this.normalizeFileIdList(evidence);
    } catch {
      return [];
    }
  }

  /** Public-facing short location, e.g. "San Pedro, Davao City". */
  private formatBroadSupplierAddress(
    address: string | null,
    serviceZones: string[],
  ): string | null {
    // Prefer a short form of the real shop address when present.
    if (address?.trim()) {
      const parts = address
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .filter(
          (p) =>
            !/^(philippines|ph|filipinas)$/i.test(p) && !/^\d{4,5}$/.test(p),
        );
      if (parts.length === 1) return parts[0];
      if (parts.length >= 2) {
        // "117 San Pedro Street, Davao City, ..." → "San Pedro Street, Davao City"
        // or shorter: last 1–2 words of the street segment + city.
        const city = parts[1];
        let area = parts[0].replace(/^\d+\s+/, '');
        const words = area.split(/\s+/).filter(Boolean);
        if (words.length > 3) {
          area = words.slice(0, 2).join(' ');
        } else if (
          words.length === 3 &&
          /street|st\.?|ave|road|rd\.?/i.test(words[2])
        ) {
          area = words.slice(0, 2).join(' ');
        }
        return `${area}, ${city}`;
      }
    }
    const zones = (serviceZones ?? [])
      .map((z) => String(z).trim())
      .filter(Boolean);
    if (zones.length > 0) {
      return zones.slice(0, 2).join(', ');
    }
    return null;
  }

  private async signFileId(fileId: number | null): Promise<string | null> {
    if (fileId == null || !Number.isInteger(fileId) || fileId <= 0) {
      return null;
    }
    try {
      const file = await this.filesService.findById(fileId);
      if (!file?.objectKey) return file?.url ?? null;
      return await this.filesService.getPresignedUrlForKey(
        file.objectKey,
        3600,
      );
    } catch {
      return null;
    }
  }

  private assignedRiderContactFromAssignment(
    assignment: DeliveryAssignment | undefined,
    includeTrackingId: boolean,
  ): AssignedRiderContact | null {
    const rider = assignment?.rider;
    if (!assignment || !rider) return null;

    const user = rider.user;
    const fullName = user?.fullName ?? null;
    const nickname = user?.nickname ?? null;
    return {
      userId: rider.userId,
      riderProfileId: rider.id,
      displayName: fullName ?? nickname ?? 'Rider',
      fullName,
      nickname,
      phoneNumber: user?.phoneNumber ?? null,
      vehicleType: rider.vehicleType ?? null,
      plateNumber: rider.plateNumber ?? null,
      deliveryAssignmentId: includeTrackingId ? assignment.id : null,
      deliveryStatus: assignment.status,
      proof: assignment.proofType
        ? {
            type: assignment.proofType,
            fileId: assignment.proofFileId ?? null,
            objectKey: assignment.proofObjectKey ?? null,
            signatureData: assignment.proofSignatureData ?? null,
            capturedAt: assignment.proofCapturedAt ?? null,
            capturedByRiderId: assignment.proofCapturedByRiderId ?? null,
          }
        : null,
    };
  }

  async assertBetaOrderLimit(
    userId: number,
    ordersRepo: Repository<Order> = this.ordersRepo,
    isBetaModeEnabled = true,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (
      user?.role !== UserRole.CLIENT ||
      !user.isBetaUser ||
      !user.betaEnrolledAt
    ) {
      return;
    }

    if (!isBetaModeEnabled) return;

    const count = await ordersRepo.count({
      where: {
        userId,
        createdAt: MoreThanOrEqual(user.betaEnrolledAt),
      },
    });
    if (count >= 1) {
      throw new ForbiddenException({
        code: BETA_ORDER_LIMIT_REACHED,
        message: BETA_ORDER_LIMIT_MESSAGE,
      });
    }
  }

  async create(
    data: Partial<Order> & {
      paperSpecs?: {
        paperSize?: unknown;
        colorMode?: unknown;
        mediaType?: unknown;
        printSides?: unknown;
        binding?: unknown;
        printMode?: unknown;
      };
      threeDSpecs?: {
        fileFormat?: unknown;
        material?: unknown;
        color?: unknown;
        infillPercentage?: unknown;
        infill_percentage?: unknown;
        layerHeight?: unknown;
        layer_height?: unknown;
        supports?: unknown;
        notes?: unknown;
      };
      specs?: Record<string, unknown>;
      addonIds?: number[];
      specialInstructions?: unknown;
    },
  ): Promise<Order> {
    const {
      paperSpecs,
      threeDSpecs,
      specs,
      addonIds,
      specialInstructions,
      ...orderData
    } = data;
    if (orderData.deliveryAddressId != null && orderData.userId != null) {
      orderData.deliveryAddressId = await this.validateDeliveryAddress(
        Number(orderData.deliveryAddressId),
        Number(orderData.userId),
      );
    }
    if (orderData.fileMetadataId != null) {
      if (orderData.userId == null) {
        throw new BadRequestException('Invalid uploaded file reference');
      }
      const file = await this.findOwnedFileMetadata(
        Number(orderData.fileMetadataId),
        Number(orderData.userId),
      );
      orderData.fileMetadataId = file.id;
      orderData.fileUrl = file.url;
      orderData.fileName = orderData.fileName ?? file.originalName;
    }

    const selectedSpecs = this.selectedSpecsFromLegacy({
      category: String(orderData.category ?? ''),
      specs,
      paperSpecs,
      threeDSpecs,
    });
    const quote = this.requireLegacyPricedQuote(
      await this.catalogPricingService.quote({
        items: [
          {
            categorySlug: String(orderData.category ?? ''),
            quantity: Number(orderData.quantity ?? 1),
            specs: selectedSpecs,
            addonIds: addonIds ?? [],
          },
        ],
        deliveryOption: orderData.deliveryOption,
      }),
    );
    const quoteItem = quote.items[0];
    orderData.totalPrice = quote.subtotal;
    orderData.category = quoteItem.categorySlug;

    const creditPayment = OrdersService.isCreditPaymentMethod(
      orderData.paymentMethod,
    );
    const amountCredits = creditPayment
      ? calculateChargeTotal({
          totalPrice: orderData.totalPrice,
          deliveryFee: orderData.deliveryFee,
        })
      : 0;
    orderData.paymentStatus = creditPayment ? 'paid' : 'pending';
    Object.assign(
      orderData,
      applyMarketplacePaymentDefaults(orderData as Partial<Order>),
    );

    // Server-side COD eligibility (cap, pilot flag, concurrency, risk).
    // Rejects ₱1,501+ even if client sends paymentMethod=cod.
    if (
      orderData.userId != null &&
      isCodPaymentMethod(String(orderData.paymentMethod ?? ''))
    ) {
      const codResult = await this.paymentsService.assertCodEligibleForCheckout(
        {
          userId: Number(orderData.userId),
          paymentMethod: String(orderData.paymentMethod ?? ''),
          finalTotalMinor: orderData.finalTotalMinor,
        },
      );
      orderData.codEligible = codResult?.eligible === true;
    }

    const creation = await this.dataSource.transaction(async (manager) => {
      const transactionOrdersRepo = manager.getRepository(Order);
      const transactionItemsRepo = manager.getRepository(OrderItem);
      const transactionSpecValuesRepo =
        manager.getRepository(OrderItemSpecValue);
      if (orderData.userId != null) {
        const isBetaModeEnabled = await this.lockBetaModeEnabled(manager);
        await this.assertBetaOrderLimit(
          Number(orderData.userId),
          transactionOrdersRepo,
          isBetaModeEnabled,
        );
        await this.assertBetaPaymentMethod(
          Number(orderData.userId),
          String(orderData.paymentMethod ?? ''),
          isBetaModeEnabled,
        );
      }
      const { orderRefs } = await this.nextBatchReferences(manager, 1);
      const orderRef = orderRefs[0];
      const order = transactionOrdersRepo.create({
        ...orderData,
        orderId: orderRef,
      });
      const persistedOrder = await transactionOrdersRepo.save(order);

      if (
        isCodPaymentMethod(String(persistedOrder.paymentMethod ?? '')) &&
        persistedOrder.codEligible
      ) {
        await this.paymentsService.ensurePendingCodCollection(
          {
            orderId: persistedOrder.id,
            amountMinor: String(persistedOrder.finalTotalMinor ?? '0'),
            eligible: true,
            eligibilityReason: null,
          },
          manager,
        );
      }
      const savedItem = await transactionItemsRepo.save(
        transactionItemsRepo.create({
          orderId: persistedOrder.id,
          category: persistedOrder.category,
          quantity: persistedOrder.quantity,
          totalPrice: persistedOrder.totalPrice,
          fileName: persistedOrder.fileName,
          fileUrl: persistedOrder.fileUrl,
          fileMetadataId: persistedOrder.fileMetadataId,
          specialInstructions:
            this.normalizeSpecialInstructions(specialInstructions),
          categoryId: quoteItem.categoryId,
          categorySlug: quoteItem.categorySlug,
          categoryName: quoteItem.categoryName,
          pricingModel: quoteItem.pricingModel,
        }),
      );

      for (const snapshot of quoteItem.specSnapshots) {
        await transactionSpecValuesRepo.save(
          transactionSpecValuesRepo.create({
            orderItemId: savedItem.id,
            ...snapshot,
          }),
        );
      }

      let creditMutation: CreditMutationResult | null = null;
      if (creditPayment && amountCredits > 0) {
        if (!orderData.userId) {
          throw new Error('User ID is required to process credit payment');
        }
        creditMutation = await this.creditsService.subtractCredits(
          orderData.userId,
          amountCredits,
          `ORDER-DEBIT:${orderRef}`,
          manager,
        );
      }
      return { savedOrder: persistedOrder, creditMutation };
    });

    this.creditsService.publishCreditMutation?.(creation.creditMutation);
    await this.notifyOrderPlaced(creation.savedOrder);

    return creation.savedOrder;
  }

  quote(dto: QuoteOrderDto) {
    return this.catalogPricingService.quote(dto);
  }

  private requireLegacyPricedQuote(quote: QuoteResult): PricedQuoteResult {
    if ('pricingStatus' in quote) {
      throw new BadRequestException({
        code: 'RFQ_ENDPOINT_REQUIRED',
        message:
          'Quote-required products must be submitted through the RFQ endpoint',
      });
    }
    return quote;
  }

  async submitRfq(
    userId: number,
    dto: SubmitRfqDto,
  ): Promise<CreateBatchResult<PendingRfqOrder>> {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid RFQ owner');
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('RFQ batch requires at least one item');
    }
    if (dto.deliveryOption !== 'pickup' && dto.deliveryOption !== 'delivery') {
      throw new BadRequestException('Invalid delivery option');
    }

    const normalizedItems = dto.items.map((item) => {
      const quantity = Number(item.quantity);
      const fileMetadataId = Number(item.fileMetadataId);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          'RFQ quantity must be a positive integer',
        );
      }
      if (!Number.isInteger(fileMetadataId) || fileMetadataId <= 0) {
        throw new BadRequestException('Invalid catalog artwork reference');
      }
      if (
        !item.specs ||
        typeof item.specs !== 'object' ||
        Array.isArray(item.specs)
      ) {
        throw new BadRequestException('RFQ specifications are required');
      }
      if (
        typeof item.categorySlug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.categorySlug)
      ) {
        throw new BadRequestException('Invalid RFQ product');
      }
      return {
        ...item,
        quantity,
        fileMetadataId,
        requiredAt: parseFutureRequiredDate(item.requiredDate),
        specialInstructions: this.normalizeSpecialInstructions(
          item.specialInstructions,
        ),
      };
    });
    assertUnambiguousArtworkProducts(normalizedItems);

    // This uses the pending branch only: it validates active catalog leaves and
    // server-owned specifications without calculating a monetary catalog sum.
    const quote = await this.catalogPricingService.quote({
      items: normalizedItems.map((item) => ({
        categorySlug: item.categorySlug,
        quantity: item.quantity,
        specs: item.specs,
      })),
      deliveryOption: dto.deliveryOption,
    });
    if (
      !('pricingStatus' in quote) ||
      quote.pricingStatus !== 'pending_quote'
    ) {
      throw new BadRequestException({
        code: 'RFQ_PRODUCT_REQUIRED',
        message: 'Only active quote-required products can be submitted',
      });
    }

    const deliveryAddressId =
      dto.deliveryAddressId == null ? undefined : Number(dto.deliveryAddressId);
    const validatedDeliveryAddress =
      deliveryAddressId == null
        ? null
        : await this.findOwnedDeliveryAddress(deliveryAddressId, userId);
    const temporaryAddress = this.normalizeTemporaryAddress(
      dto.temporaryAddress,
    );
    const inputDestinations = dto.destinations ?? [];
    if (
      dto.deliveryOption !== 'delivery' &&
      (temporaryAddress != null || inputDestinations.length > 0)
    ) {
      throw new BadRequestException(
        'Delivery destinations are only allowed for delivery',
      );
    }
    if (
      dto.deliveryOption === 'delivery' &&
      validatedDeliveryAddress == null &&
      temporaryAddress == null &&
      inputDestinations.length === 0
    ) {
      throw new BadRequestException('Delivery address is required');
    }
    if (validatedDeliveryAddress != null && temporaryAddress != null) {
      throw new BadRequestException(
        'Choose either a saved address or a temporary address',
      );
    }
    if (temporaryAddress != null && inputDestinations.length > 0) {
      throw new BadRequestException(
        'Choose either a temporary address or delivery destinations',
      );
    }

    const resolvedDestinations: NormalizedDeliveryDestination[] = [];
    for (const destination of inputDestinations) {
      if (destination.addressId != null && destination.address != null) {
        throw new BadRequestException(
          'Choose either a saved address or a temporary address for each destination',
        );
      }
      if (destination.address != null) {
        const normalized = this.normalizeTemporaryAddress(destination.address);
        if (!normalized) {
          throw new BadRequestException('Invalid temporary address');
        }
        resolvedDestinations.push(
          this.destinationFromTemporaryAddress(normalized, destination.label),
        );
        continue;
      }
      if (destination.addressId == null) {
        throw new BadRequestException('Invalid delivery address');
      }
      const address = await this.findOwnedDeliveryAddress(
        Number(destination.addressId),
        userId,
      );
      resolvedDestinations.push(
        this.destinationFromSavedAddress(address, destination.label),
      );
    }
    if (temporaryAddress != null && resolvedDestinations.length === 0) {
      resolvedDestinations.push(
        this.destinationFromTemporaryAddress(temporaryAddress),
      );
    }
    if (validatedDeliveryAddress != null && resolvedDestinations.length === 0) {
      resolvedDestinations.push(
        this.destinationFromSavedAddress(validatedDeliveryAddress),
      );
    }
    for (const item of normalizedItems) {
      const destinationIndex = item.destinationIndex ?? 0;
      if (
        !Number.isInteger(destinationIndex) ||
        destinationIndex < 0 ||
        (resolvedDestinations.length === 0
          ? destinationIndex !== 0
          : destinationIndex >= resolvedDestinations.length)
      ) {
        throw new BadRequestException('Invalid destination index');
      }
    }

    let deliveryType: 'local' | 'external' = 'local';
    let zoneDeliveryFeePesos: number | null = null;
    for (const destination of resolvedDestinations) {
      const inside = await this.settingsService.isInsideServiceArea(
        destination.latitude,
        destination.longitude,
      );
      if (!inside) {
        if (this.geoZonesService) {
          try {
            const [hasZones, commerce] = await Promise.all([
              this.geoZonesService.hasActiveZones(),
              this.geoZonesService.getCommerceSettings(),
            ]);
            if (hasZones && commerce.rejectOutsideZones) {
              throw new ServiceAreaMismatchException();
            }
          } catch (error) {
            if (error instanceof ServiceAreaMismatchException) throw error;
          }
        }
        deliveryType = 'external';
        break;
      }
      if (this.geoZonesService && zoneDeliveryFeePesos == null) {
        try {
          const match = await this.geoZonesService.matchPoint(
            destination.latitude,
            destination.longitude,
          );
          if (match.inside && match.zone) {
            zoneDeliveryFeePesos = Number(match.deliveryFeeMinor) / 100;
          }
        } catch {
          // Geo-zone fees are optional; the standard delivery fee remains.
        }
      }
    }
    let authoritativeDeliveryFee =
      dto.deliveryOption === 'delivery'
        ? STANDARD_DELIVERY_FEE + SERVICE_FEE
        : 0;
    if (
      deliveryType === 'local' &&
      dto.deliveryOption === 'delivery' &&
      zoneDeliveryFeePesos != null
    ) {
      authoritativeDeliveryFee = zoneDeliveryFeePesos + SERVICE_FEE;
    }

    return this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(BatchOrder);
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const specRepo = manager.getRepository(OrderItemSpecValue);
      const destinationRepo = manager.getRepository(DeliveryDestination);
      const validationService = new CatalogValidationService();

      // Resolve every mutable/owner-bound input before the first insert. Files
      // are locked and storage-verified through the same transaction manager.
      const validatedLines = [] as Array<{
        item: (typeof normalizedItems)[number];
        quoteItem: (typeof quote.items)[number];
        product: ProductCategory;
        specSnapshots: (typeof quote.items)[number]['specSnapshots'];
      }>;
      const productsBySlug = await lockRfqCatalog(
        manager,
        normalizedItems.map(({ categorySlug }) => categorySlug),
      );
      for (const [index, item] of normalizedItems.entries()) {
        const quoteItem = quote.items[index];
        const product = productsBySlug.get(item.categorySlug);
        if (
          !product ||
          product.id !== quoteItem.categoryId ||
          quoteItem.categorySlug !== item.categorySlug ||
          !isActiveOrderableRfqLeaf(product)
        ) {
          throw new BadRequestException({
            code: 'CATEGORY_INACTIVE',
            message: `Category '${item.categorySlug}' is not available`,
          });
        }
        const specSnapshots = validationService
          .validateSpecs(
            product as Parameters<CatalogValidationService['validateSpecs']>[0],
            item.specs,
          )
          .map((entry) => ({
            specDefinitionId: entry.spec.id,
            specKey: entry.spec.key,
            specLabel: entry.spec.label,
            inputType: entry.spec.inputType,
            value:
              entry.value == null
                ? ''
                : typeof entry.value === 'object'
                  ? JSON.stringify(entry.value)
                  : String(entry.value as string | number | boolean),
            displayValue: entry.displayValue,
            optionId: entry.option?.id ?? null,
            optionLabel: entry.option?.label ?? null,
          }));
        validatedLines.push({
          item,
          quoteItem,
          product,
          specSnapshots,
        });
      }

      const filesById = await resolveArtworkInLockOrder(
        validatedLines.map(({ item }) => item),
        ({ fileMetadataId, categorySlug }) =>
          this.filesService.resolveCatalogArtwork(
            fileMetadataId,
            productsBySlug.get(categorySlug)!,
            userId,
            manager,
          ),
      );
      const resolvedLines = validatedLines.map((line) => ({
        ...line,
        file: filesById.get(line.item.fileMetadataId)!,
      }));

      const { batchRef, orderRefs } = await this.nextBatchReferences(
        manager,
        resolvedLines.length,
      );
      const batch = await batchRepo.save(
        batchRepo.create({
          batchRef,
          userId,
          subtotal: 0,
          // The shared authoritative delivery fee lives only on the batch.
          // Per-line compatibility order columns stay zero to avoid counting it
          // once per independently matched supplier order. Task 8 adds it once
          // when the final customer quote is assembled.
          deliveryFee: authoritativeDeliveryFee,
          totalPrice: 0,
          paymentMethod: 'unselected',
          paymentStatus: 'pending',
          deliveryOption: dto.deliveryOption,
          deliveryAddressId: validatedDeliveryAddress?.id,
          deliveryType,
          slotBookingId: null,
          priorityFee: 0,
          speedTier: DeliverySpeedTier.STANDARD,
          extraDestinationFee: 0,
          externalDeliveryStatus:
            deliveryType === 'external' ? 'pending_admin' : null,
        }),
      );

      const savedDestinations: DeliveryDestination[] = [];
      for (const [index, destination] of resolvedDestinations.entries()) {
        savedDestinations.push(
          await destinationRepo.save(
            destinationRepo.create({
              batchOrderId: batch.id,
              ...destination,
              sortOrder: index,
            }),
          ),
        );
      }

      const orders: PendingRfqOrder[] = [];
      for (const [index, line] of resolvedLines.entries()) {
        const destinationId =
          savedDestinations[line.item.destinationIndex ?? 0]?.id ?? null;
        const savedOrder = await orderRepo.save(
          orderRepo.create({
            userId,
            orderId: orderRefs[index],
            batchOrderId: batch.id,
            destinationId,
            category: line.quoteItem.categorySlug,
            quantity: line.item.quantity,
            totalPrice: 0,
            deliveryFee: 0,
            finalTotalMinor: null,
            deliveryFeeMinor: null,
            quotedTotalMinor: null,
            quotedAt: null,
            quoteAcceptedAt: null,
            quotedByUserId: null,
            promisedCompletionAt: null,
            pricingStatus: PricingStatus.PENDING_QUOTE,
            paymentMethod: 'unselected',
            paymentStatus: 'pending',
            paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
            codEligible: false,
            authorizationSnapshot: null,
            orderStatus: OrderStatus.SUBMITTED,
            deliveryOption: dto.deliveryOption,
            deliveryAddressId: validatedDeliveryAddress?.id,
            fileMetadataId: line.file.id,
            fileUrl: line.file.url,
            fileName: line.file.originalName,
            estimatedCompletionAt: null,
          }),
        );
        const savedItem = await itemRepo.save(
          itemRepo.create({
            orderId: savedOrder.id,
            category: line.quoteItem.categorySlug,
            categoryId: line.quoteItem.categoryId,
            categorySlug: line.quoteItem.categorySlug,
            categoryName: line.quoteItem.categoryName,
            pricingModel: line.quoteItem.pricingModel,
            quantity: line.item.quantity,
            totalPrice: 0,
            fileMetadataId: line.file.id,
            fileUrl: line.file.url,
            fileName: line.file.originalName,
            specialInstructions: line.item.specialInstructions,
            requiredAt: line.item.requiredAt,
            destinationId,
          }),
        );
        const specValues: PendingRfqSpecValue[] = [];
        for (const snapshot of line.specSnapshots) {
          const savedSpec = await specRepo.save(
            specRepo.create({
              orderItemId: savedItem.id,
              ...snapshot,
            }),
          );
          specValues.push({
            id: savedSpec.id,
            orderItemId: savedSpec.orderItemId,
            specDefinitionId: savedSpec.specDefinitionId,
            specKey: savedSpec.specKey,
            specLabel: savedSpec.specLabel,
            inputType: savedSpec.inputType,
            value: savedSpec.value,
            displayValue: savedSpec.displayValue,
            optionId: savedSpec.optionId,
            optionLabel: savedSpec.optionLabel,
          });
        }
        orders.push({
          ...savedOrder,
          totalPrice: null,
          deliveryFee: null,
          deliveryFeeMinor: null,
          items: [
            {
              ...savedItem,
              totalPrice: null,
              specValues,
            },
          ],
        } as PendingRfqOrder);
      }

      return { batchId: batch.batchRef, orders };
    });
  }

  async createBatch(
    userId: number,
    dto: CreateBatchOrderDto,
  ): Promise<CreateBatchResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Batch order requires at least one item');
    }

    const normalizedItems = dto.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity ?? 1),
      totalPrice: Number(item.totalPrice ?? 0),
      fileMetadataId:
        item.fileMetadataId == null ? undefined : Number(item.fileMetadataId),
      specialInstructions: this.normalizeSpecialInstructions(
        item.specialInstructions,
      ),
      threeDSpecs: item.threeDSpecs
        ? {
            ...item.threeDSpecs,
            infillPercentage: Number(item.threeDSpecs.infillPercentage ?? 20),
            layerHeight: Number(item.threeDSpecs.layerHeight ?? 0.2),
          }
        : undefined,
    }));
    const fileMetadataById = new Map<number, FileMetadata>();
    for (const item of normalizedItems) {
      if (item.fileMetadataId == null) continue;
      const file = await this.findOwnedFileMetadata(
        item.fileMetadataId,
        userId,
      );
      item.fileMetadataId = file.id;
      item.fileUrl = file.url;
      item.fileName = item.fileName ?? file.originalName;
      fileMetadataById.set(file.id, file);
    }

    const quote = this.requireLegacyPricedQuote(
      await this.catalogPricingService.quote({
        items: normalizedItems.map((item) => ({
          categorySlug: item.category,
          quantity: item.quantity,
          specs: this.selectedSpecsFromLegacy(item),
          addonIds: item.addonIds ?? [],
        })),
        deliveryOption: dto.deliveryOption,
        speedTier: dto.speedTier,
      }),
    );
    const subtotal = quote.subtotal;
    // Client totals are display hints only. Checkout charges are authoritative
    // on the server so a direct request cannot underpay a credit order.
    // May be overridden by geo-zone base fee after zone match below.
    let deliveryFee =
      (dto.deliveryOption === 'delivery' ? STANDARD_DELIVERY_FEE : 0) +
      SERVICE_FEE;
    const deliveryAddressId =
      dto.deliveryAddressId == null ? undefined : Number(dto.deliveryAddressId);
    const validatedDeliveryAddress =
      deliveryAddressId == null
        ? null
        : await this.findOwnedDeliveryAddress(deliveryAddressId, userId);
    const validatedDeliveryAddressId = validatedDeliveryAddress?.id;
    const temporaryAddress = this.normalizeTemporaryAddress(
      dto.temporaryAddress,
    );

    // --- Destination resolution ---
    const inputDestinations = dto.destinations ?? [];
    if (
      dto.deliveryOption !== 'delivery' &&
      (temporaryAddress != null || inputDestinations.length > 0)
    ) {
      throw new BadRequestException(
        'Delivery destinations are only allowed for delivery',
      );
    }
    if (
      dto.deliveryOption === 'delivery' &&
      validatedDeliveryAddressId == null &&
      temporaryAddress == null &&
      inputDestinations.length === 0
    ) {
      throw new BadRequestException('Delivery address is required');
    }
    if (validatedDeliveryAddressId != null && temporaryAddress != null) {
      throw new BadRequestException(
        'Choose either a saved address or a temporary address',
      );
    }
    if (temporaryAddress != null && inputDestinations.length > 0) {
      throw new BadRequestException(
        'Choose either a temporary address or delivery destinations',
      );
    }

    const resolvedDestinations: NormalizedDeliveryDestination[] = [];
    for (const dest of inputDestinations) {
      if (dest.addressId != null && dest.address != null) {
        throw new BadRequestException(
          'Choose either a saved address or a temporary address for each destination',
        );
      }

      if (dest.address) {
        const normalized = this.normalizeTemporaryAddress(dest.address);
        if (!normalized) {
          throw new BadRequestException('Invalid temporary address');
        }
        resolvedDestinations.push(
          this.destinationFromTemporaryAddress(normalized, dest.label),
        );
        continue;
      }

      if (dest.addressId == null) {
        throw new BadRequestException('Invalid delivery address');
      }

      const addr = await this.addressRepo.findOne({
        where: { id: dest.addressId, userId },
      });
      if (!addr) {
        throw new BadRequestException('Invalid delivery address');
      }
      resolvedDestinations.push(
        this.destinationFromSavedAddress(addr, dest.label),
      );
    }

    if (temporaryAddress != null && resolvedDestinations.length === 0) {
      resolvedDestinations.push(
        this.destinationFromTemporaryAddress(temporaryAddress),
      );
    }
    if (validatedDeliveryAddress != null && resolvedDestinations.length === 0) {
      resolvedDestinations.push(
        this.destinationFromSavedAddress(validatedDeliveryAddress),
      );
    }

    if (resolvedDestinations.length > 0) {
      for (const item of normalizedItems) {
        const destinationIndex = item.destinationIndex ?? 0;
        if (
          !Number.isInteger(destinationIndex) ||
          destinationIndex < 0 ||
          destinationIndex >= resolvedDestinations.length
        ) {
          throw new BadRequestException('Invalid destination index');
        }
      }
    }

    let deliveryType: 'local' | 'external' = 'local';
    let zoneDeliveryFeePesos: number | null = null;

    for (const dest of resolvedDestinations) {
      const inside = await this.settingsService.isInsideServiceArea(
        dest.latitude,
        dest.longitude,
      );
      if (!inside) {
        // Pilot policy: when geo zones are active and reject_outside_zones,
        // refuse checkout instead of classifying as external.
        if (this.geoZonesService) {
          try {
            const [hasZones, commerce] = await Promise.all([
              this.geoZonesService.hasActiveZones(),
              this.geoZonesService.getCommerceSettings(),
            ]);
            if (hasZones && commerce.rejectOutsideZones) {
              throw new ServiceAreaMismatchException();
            }
          } catch (err) {
            if (err instanceof ServiceAreaMismatchException) throw err;
          }
        }
        deliveryType = 'external';
        break;
      }

      if (this.geoZonesService && zoneDeliveryFeePesos == null) {
        try {
          const match = await this.geoZonesService.matchPoint(
            dest.latitude,
            dest.longitude,
          );
          if (match.inside && match.zone) {
            zoneDeliveryFeePesos = Number(match.deliveryFeeMinor) / 100;
          }
        } catch {
          /* optional zone fee */
        }
      }
    }

    // --- Fee computation ---
    const settings = await this.settingsService.getSettings();
    const speedTier = dto.speedTier ?? DeliverySpeedTier.STANDARD;
    const isPriority = speedTier === DeliverySpeedTier.PRIORITY;
    const priorityFee = isPriority ? Number(settings.priorityFeeAmount) : 0;
    const extraDestCount = Math.max(0, resolvedDestinations.length - 1);
    const extraDestinationFee =
      extraDestCount * Number(settings.extraDestinationSurcharge);
    // Prefer zone base fee for local delivery when a zone match exists.
    if (
      deliveryType === 'local' &&
      dto.deliveryOption === 'delivery' &&
      zoneDeliveryFeePesos != null
    ) {
      deliveryFee = zoneDeliveryFeePesos + SERVICE_FEE;
    }
    const totalPrice = calculateChargeTotal({
      subtotal,
      deliveryFee,
      priorityFee,
      extraDestinationFee,
    });

    // --- 3D bounds enforcement ---
    const profile = await this.printerProfileService.getProfile();
    for (const item of normalizedItems) {
      if (item.category !== '3d') continue;
      if (item.fileMetadataId == null) continue;
      const meta = fileMetadataById.get(item.fileMetadataId);
      if (!meta) continue;
      if (meta.model3dWidthMm == null) continue;
      const w = Number(meta.model3dWidthMm);
      const d = Number(meta.model3dDepthMm);
      const h = Number(meta.model3dHeightMm);
      if (
        w > profile.buildVolumeWidthMm ||
        d > profile.buildVolumeDepthMm ||
        h > profile.buildVolumeHeightMm
      ) {
        throw new BadRequestException({
          message: `Model exceeds printer build volume (${w}×${d}×${h}mm vs ${profile.buildVolumeWidthMm}×${profile.buildVolumeDepthMm}×${profile.buildVolumeHeightMm}mm)`,
          code: 'model_exceeds_build_volume',
        });
      }
    }

    // Slot HH:MM in DB is stored as Asia/Manila wall-clock (the operator's
    // local time). Auto assignment compares same-day slot end-times against
    // the current PH minute-of-day, then continues through future PH dates.
    const hasExplicitSlot = dto.slotTemplateId != null && dto.slotDate != null;
    const shouldAutoAssignSlot =
      dto.deliveryOption === 'delivery' &&
      deliveryType === 'local' &&
      speedTier === DeliverySpeedTier.STANDARD &&
      dto.slotTemplateId == null &&
      dto.slotDate == null;
    const autoSlotCandidates = shouldAutoAssignSlot
      ? await this.findAutoSlotCandidates()
      : [];
    if (shouldAutoAssignSlot && autoSlotCandidates.length === 0) {
      throw new BadRequestException({
        code: 'no_slot_available_today',
        message:
          'No delivery slot is available right now. Please choose Pickup or Schedule a future slot.',
      });
    }

    const orders = await this.dataSource.transaction(async (manager) => {
      const batchOrdersRepo = manager.getRepository(BatchOrder);
      const txOrdersRepo = manager.getRepository(Order);
      const txOrderItemsRepo = manager.getRepository(OrderItem);
      const txSpecValueRepo = manager.getRepository(OrderItemSpecValue);
      const txDestinationRepo = manager.getRepository(DeliveryDestination);

      const isBetaModeEnabled = await this.lockBetaModeEnabled(manager);
      await this.assertBetaOrderLimit(userId, txOrdersRepo, isBetaModeEnabled);
      await this.assertBetaPaymentMethod(
        userId,
        dto.paymentMethod,
        isBetaModeEnabled,
      );

      // Pre-compute marketplace money defaults for COD gate (same as aggregate order).
      const paymentDefaultsPreview = applyMarketplacePaymentDefaults({
        totalPrice: subtotal,
        deliveryFee,
        paymentMethod: dto.paymentMethod,
      } as Partial<Order>);
      let codEligibleForBatch = false;
      if (isCodPaymentMethod(dto.paymentMethod)) {
        const codResult =
          await this.paymentsService.assertCodEligibleForCheckout({
            userId,
            paymentMethod: dto.paymentMethod,
            finalTotalMinor: paymentDefaultsPreview.finalTotalMinor,
          });
        codEligibleForBatch = codResult?.eligible === true;
      }

      const { batchRef, orderRefs } = await this.nextBatchReferences(
        manager,
        1,
      );
      const orderRef = orderRefs[0];
      const creditPayment = OrdersService.isCreditPaymentMethod(
        dto.paymentMethod,
      );
      const paymentStatus = creditPayment ? 'paid' : 'pending';
      const batch = batchOrdersRepo.create({
        batchRef,
        userId,
        subtotal,
        deliveryFee,
        totalPrice,
        paymentMethod: dto.paymentMethod,
        paymentStatus,
        deliveryOption: dto.deliveryOption,
        deliveryAddressId: validatedDeliveryAddressId,
      });
      const savedBatch = await batchOrdersRepo.save(batch);

      // --- Persist new fields on batch ---
      savedBatch.deliveryType = deliveryType;
      savedBatch.priorityFee = priorityFee;
      savedBatch.speedTier = speedTier;
      savedBatch.extraDestinationFee = extraDestinationFee;
      savedBatch.externalDeliveryStatus =
        deliveryType === 'external' ? 'pending_admin' : null;
      savedBatch.slotBookingId = null;

      // --- Insert DeliveryDestination rows ---
      const savedDestinations: DeliveryDestination[] = [];
      for (let i = 0; i < resolvedDestinations.length; i++) {
        const dest = resolvedDestinations[i];
        const destEntity = txDestinationRepo.create({
          batchOrderId: savedBatch.id,
          addressId: dest.addressId,
          label: dest.label,
          fullAddress: dest.fullAddress,
          barangay: dest.barangay,
          city: dest.city,
          province: dest.province,
          zipCode: dest.zipCode,
          landmark: dest.landmark,
          latitude: dest.latitude,
          longitude: dest.longitude,
          sortOrder: i,
        });
        const savedDest = await txDestinationRepo.save(destEntity);
        savedDestinations.push(savedDest);
      }

      // --- Book slot if local ---
      let assignedSlot: AssignedSlot | undefined;
      if (deliveryType === 'local' && hasExplicitSlot) {
        const booking = await this.slotsService.bookSlot(manager, {
          slotTemplateId: dto.slotTemplateId!,
          date: dto.slotDate!,
          batchOrderId: savedBatch.id,
          priority: isPriority,
        });
        savedBatch.slotBookingId = booking.id;
        assignedSlot = {
          bookingId: booking.id,
          slotTemplateId: dto.slotTemplateId!,
          date: dto.slotDate!,
          startTime: '',
          endTime: '',
        };
      } else if (deliveryType === 'local' && shouldAutoAssignSlot) {
        for (const candidate of autoSlotCandidates) {
          try {
            const booking = await this.slotsService.bookSlot(manager, {
              slotTemplateId: candidate.slotTemplateId,
              date: candidate.date,
              batchOrderId: savedBatch.id,
              priority: false,
            });
            savedBatch.slotBookingId = booking.id;
            assignedSlot = {
              bookingId: booking.id,
              ...candidate,
            };
            break;
          } catch (err) {
            if (this.isSlotFullError(err)) continue;
            throw err;
          }
        }

        if (!assignedSlot) {
          throw new BadRequestException({
            code: 'no_slot_available_today',
            message:
              'No delivery slot is available right now. Please choose Pickup or Schedule a future slot.',
          });
        }
      }
      await batchOrdersRepo.save(savedBatch);

      const firstItem = normalizedItems[0];
      // For the aggregate order, wire it to the first item's destination (if any)
      const firstDestId =
        savedDestinations[normalizedItems[0]?.destinationIndex ?? 0]?.id ??
        null;
      const aggregateOrder = txOrdersRepo.create(
        applyMarketplacePaymentDefaults({
          userId,
          orderId: orderRef,
          category: normalizedItems.length > 1 ? 'batch' : firstItem.category,
          quantity: normalizedItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
          totalPrice: subtotal,
          deliveryFee,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          deliveryOption: dto.deliveryOption,
          deliveryAddressId: validatedDeliveryAddressId,
          fileName:
            normalizedItems.length > 1
              ? `${normalizedItems.length} print jobs`
              : firstItem.fileName,
          fileUrl: normalizedItems.length === 1 ? firstItem.fileUrl : undefined,
          fileMetadataId:
            normalizedItems.length === 1
              ? (firstItem.fileMetadataId ?? null)
              : null,
          batchOrderId: savedBatch.id,
          destinationId: firstDestId,
          codEligible: codEligibleForBatch,
        }),
      );
      const savedOrder = await txOrdersRepo.save(aggregateOrder);

      if (codEligibleForBatch && isCodPaymentMethod(dto.paymentMethod)) {
        await this.paymentsService.ensurePendingCodCollection(
          {
            orderId: savedOrder.id,
            amountMinor: String(savedOrder.finalTotalMinor ?? '0'),
            eligible: true,
            eligibilityReason: null,
          },
          manager,
        );
      }

      for (const [index, item] of normalizedItems.entries()) {
        const quoteItem = quote.items[index];
        const itemDestinationId =
          savedDestinations[item.destinationIndex ?? 0]?.id ?? null;
        const savedItem = await txOrderItemsRepo.save(
          txOrderItemsRepo.create({
            orderId: savedOrder.id,
            category: item.category,
            categoryId: quoteItem.categoryId,
            categorySlug: quoteItem.categorySlug,
            categoryName: quoteItem.categoryName,
            pricingModel: quoteItem.pricingModel,
            quantity: item.quantity,
            totalPrice: quoteItem.printSubtotal,
            fileName: item.fileName,
            fileUrl: item.fileUrl,
            fileMetadataId: item.fileMetadataId,
            specialInstructions: item.specialInstructions,
            destinationId: itemDestinationId,
          }),
        );
        for (const snapshot of quoteItem.specSnapshots) {
          await txSpecValueRepo.save(
            txSpecValueRepo.create({
              orderItemId: savedItem.id,
              ...snapshot,
            }),
          );
        }
      }

      let creditMutation: CreditMutationResult | null = null;
      if (
        OrdersService.isCreditPaymentMethod(dto.paymentMethod) &&
        totalPrice > 0
      ) {
        creditMutation = await this.creditsService.subtractCredits(
          userId,
          totalPrice,
          `ORDER-DEBIT:${orderRef}`,
          manager,
        );
      }

      const orderWithItems = await txOrdersRepo.findOneOrFail({
        where: { id: savedOrder.id },
        relations: OrdersService.ORDER_RELATIONS,
      });

      return {
        batchRef: savedBatch.batchRef,
        orders: [orderWithItems],
        assignedSlot,
        creditMutation,
      };
    });

    this.creditsService.publishCreditMutation?.(orders.creditMutation);

    // --- After transaction: emit WS event if local ---
    if (deliveryType === 'local' && orders.assignedSlot) {
      const counts = await this.slotsService.getAvailability(
        orders.assignedSlot.date,
      );
      const updated = counts.find(
        (c) => c.templateId === orders.assignedSlot?.slotTemplateId,
      );
      if (updated) {
        if (!orders.assignedSlot.startTime) {
          orders.assignedSlot.startTime = updated.startTime;
          orders.assignedSlot.endTime = updated.endTime;
        }
        this.slotsGateway.notifySlotUpdated({
          templateId: updated.templateId,
          date: orders.assignedSlot.date,
          bookedCount: updated.bookedCount,
        });
      }
    }

    for (const order of orders.orders) {
      await this.notifyOrderPlaced(order);
    }

    return {
      batchId: orders.batchRef,
      orders: orders.orders,
      ...(orders.assignedSlot ? { assignedSlot: orders.assignedSlot } : {}),
    };
  }

  private async notifyOrderPlaced(savedOrder: Order): Promise<void> {
    // Notify via WebSocket — admin queue sees new orders in real-time
    void this.ordersGateway.notifyOrderUpdate(savedOrder.orderId, savedOrder);

    // Notify customer of new order (in-app + real-time WS)
    try {
      await this.notificationsService.create({
        userId: savedOrder.userId,
        title: 'Order Placed',
        message: `Your order ${savedOrder.orderId} has been placed successfully.`,
        type: 'order_placed',
        orderRef: savedOrder.orderId,
        metadata: {
          orderId: savedOrder.id,
          amount: Number(savedOrder.totalPrice ?? 0),
          category: savedOrder.category ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Customer notification failed for order ${savedOrder.orderId}: ${err}`,
      );
    }

    // Send FCM push notification to customer
    try {
      const fcmToken = await this.usersService.getFcmToken(savedOrder.userId);
      if (fcmToken) {
        await this.firebaseService.sendToDevice(
          fcmToken,
          'Order Placed',
          `Your order ${savedOrder.orderId} has been placed successfully.`,
          {
            orderId: savedOrder.orderId,
            status: 'order_placed',
            type: 'delivery_status',
            progressCurrent: '1',
            progressTotal: '5',
          },
          { dataOnly: true },
        );
      }
    } catch (err) {
      this.logger.warn(
        `Customer FCM push failed for order ${savedOrder.orderId}: ${err}`,
      );
    }

    // Notify admins of new order
    try {
      await this.notificationsService.createForAllAdmins({
        title: 'New Order Placed',
        message: `Order ${savedOrder.orderId} has been placed.`,
        type: 'order_placed',
        orderRef: savedOrder.orderId,
        metadata: {
          orderId: savedOrder.id,
          amount: Number(savedOrder.totalPrice ?? 0),
          category: savedOrder.category ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Admin notification failed for order ${savedOrder.orderId}: ${err}`,
      );
    }
  }

  private static readonly CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.SUBMITTED,
    OrderStatus.APPROVED_FOR_MATCHING,
  ];

  private static isCreditPaymentMethod(paymentMethod?: string): boolean {
    const normalized = paymentMethod?.replace(/[_-]/g, '').toLowerCase();
    return (
      normalized === 'credits' ||
      normalized === 'gridcredits' ||
      normalized === 'pilotcredit' ||
      normalized === 'pilotcredits'
    );
  }

  /**
   * Freeze immutable commercial snapshot at payment authorization.
   * Intended for the payments module when entering `payment_authorized`.
   * Idempotent: a second call leaves the existing snapshot unchanged.
   */
  freezeAuthorizationSnapshot(
    order: Order,
    input: FreezeAuthorizationInput = {},
  ): Order {
    return freezeAuthorizationSnapshotOnOrder(order, input);
  }

  /**
   * Load order, freeze authorization snapshot, persist.
   * Does not perform status transition (payment module owns that).
   */
  async persistAuthorizationSnapshot(
    orderId: number,
    input: FreezeAuthorizationInput = {},
  ): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    const frozen = this.freezeAuthorizationSnapshot(order, input);
    return this.ordersRepo.save(frozen);
  }

  /** Default ops payment-authorization window after supplier accept (PRD §6.3). */
  static readonly PAYMENT_AUTH_TIMEOUT_MS = 24 * 60 * 60 * 1000;

  static creditReserveIdempotencyKey(orderId: number): string {
    return `payment-auth:reserve:order:${orderId}`;
  }

  static creditSpendIdempotencyKey(orderId: number): string {
    return `payment-auth:spend:order:${orderId}`;
  }

  /**
   * Customer acceptance freezes the chosen rail, but performs no payment
   * authorization, ledger mutation, or COD collection creation.
   */
  async acceptQuote(
    orderId: number,
    userId: number,
    dto: AcceptQuoteDto,
  ): Promise<Order> {
    const precheck = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!precheck) throw new NotFoundException(`Order ${orderId} not found`);

    return this.dataSource.transaction(async (manager) => {
      // Commerce lock order: owner -> batch -> order -> assignments by id.
      const owner = await manager.getRepository(User).findOne({
        where: { id: precheck.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!owner) throw new NotFoundException('Order owner not found');

      if (precheck.batchOrderId != null) {
        const batch = await manager.getRepository(BatchOrder).findOne({
          where: { id: precheck.batchOrderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!batch) throw new NotFoundException('Batch order not found');
      }

      const ordersRepo = manager.getRepository(Order);
      const locked = await ordersRepo.findOneOrFail({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.userId !== userId) {
        throw new ForbiddenException({
          code: 'not_order_owner',
          message: 'You can only accept a quote for your own order',
        });
      }
      if (
        locked.userId !== precheck.userId ||
        locked.batchOrderId !== precheck.batchOrderId
      ) {
        throw new BadRequestException({
          code: 'order_changed_during_quote_acceptance',
          message: 'Order commerce ownership changed during quote acceptance',
        });
      }

      const assignments = await manager.getRepository(SupplierAssignment).find({
        where: { orderId: locked.id },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const current = [...assignments]
        .reverse()
        .find(({ decision }) =>
          [
            SupplierAssignmentDecision.PENDING,
            SupplierAssignmentDecision.ACCEPTED,
          ].includes(decision),
        );
      if (current?.id !== dto.supplierAssignmentId) {
        throw new BadRequestException({
          code: 'stale_quote',
          message: 'The selected supplier quote is stale or superseded',
        });
      }
      if (current.decision !== SupplierAssignmentDecision.ACCEPTED) {
        throw new BadRequestException({
          code: 'quote_not_supplier_accepted',
          message: 'The current supplier assignment has not been accepted',
        });
      }

      const paymentMethod =
        dto.paymentMethod === QuotePaymentMethod.PILOT_CREDIT
          ? MarketplacePaymentMethod.PILOT_CREDIT
          : MarketplacePaymentMethod.COD;

      if (locked.pricingStatus === PricingStatus.ACCEPTED) {
        if (
          locked.quoteAcceptedAt != null &&
          locked.paymentMethod === String(paymentMethod)
        ) {
          return locked;
        }
        throw new BadRequestException({
          code: 'quote_acceptance_conflict',
          message: 'This quote was already accepted with different terms',
        });
      }

      if (
        locked.orderStatus !== OrderStatus.SUPPLIER_ACCEPTED ||
        locked.pricingStatus !== PricingStatus.QUOTED
      ) {
        throw new BadRequestException({
          code: 'quote_not_ready',
          message: 'The order does not have a current supplier quote',
        });
      }

      let goodsMinor: string;
      let quotedTotalMinor: string;
      try {
        goodsMinor = normalizePositiveSafeMinor(
          current.finalPriceMinor,
          'finalPriceMinor',
        );
        quotedTotalMinor = normalizePositiveSafeMinor(
          locked.quotedTotalMinor,
          'quotedTotalMinor',
        );
        subtractSafeMinor(quotedTotalMinor, goodsMinor, 'quoted delivery fee');
      } catch {
        throw new BadRequestException({
          code: 'quote_terms_missing',
          message: 'The supplier quote price is missing or invalid',
        });
      }
      if (
        current.promisedDate == null ||
        locked.promisedCompletionAt == null ||
        locked.quotedAt == null ||
        locked.quotedByUserId == null
      ) {
        throw new BadRequestException({
          code: 'quote_terms_missing',
          message: 'The supplier quote turnaround is missing',
        });
      }

      if (paymentMethod === MarketplacePaymentMethod.COD) {
        const codResult =
          await this.paymentsService.assertCodEligibleForCheckout(
            {
              userId: locked.userId,
              paymentMethod,
              finalTotalMinor: quotedTotalMinor,
              excludeOrderId: locked.id,
            },
            manager,
          );
        locked.codEligible = codResult?.eligible === true;
      } else {
        locked.codEligible = false;
      }

      assertTransition(
        locked.orderStatus,
        OrderStatus.AWAITING_PAYMENT,
        'client',
      );
      const acceptedAt = new Date();
      const fromStatus = locked.orderStatus;
      locked.pricingStatus = PricingStatus.ACCEPTED;
      locked.quoteAcceptedAt = acceptedAt;
      locked.paymentMethod = paymentMethod;
      locked.orderStatus = OrderStatus.AWAITING_PAYMENT;
      const saved = await ordersRepo.save(locked);

      const reason = `Customer accepted supplier quote ${current.id} using ${paymentMethod}`;
      await manager.getRepository(OrderStatusHistory).insert({
        orderId: locked.id,
        fromStatus,
        toStatus: OrderStatus.AWAITING_PAYMENT,
        changedByUserId: userId,
        notes: reason,
      });
      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus: OrderStatus.AWAITING_PAYMENT,
          actorUserId: userId,
          actorRole: 'client',
          reason,
          metadata: {
            source: 'orders.acceptQuote',
            supplierAssignmentId: current.id,
            paymentMethod,
          },
        },
        manager,
      );
      await this.auditService.append(
        {
          actorId: userId,
          actorRole: 'client',
          action: 'customer_quote_accepted',
          entityType: 'order',
          entityId: String(locked.id),
          orderId: locked.id,
          fromState: PricingStatus.QUOTED,
          toState: PricingStatus.ACCEPTED,
          reason,
          metadata: {
            supplierAssignmentId: current.id,
            paymentMethod,
            quotedTotalMinor,
          },
        },
        manager,
      );
      return saved;
    });
  }

  /**
   * Authorize payment for production (Task 3.3).
   *
   * Ops/super only — clients cannot authorize. Allowed from
   * `supplier_accepted` or `awaiting_payment`.
   * - pilot_credit / gridCredits: reserve → spend (idempotent) unless already paid
   *   (ledger always charges the order owner, not the ops actor)
   * - COD: re-check eligibility; authorize for collection (not cash in hand)
   * Freezes commercial snapshot and transitions to `payment_authorized`.
   */
  async authorizePayment(
    orderId: number,
    context: OrderStatusChangeContext,
  ): Promise<Order> {
    if (!Number.isInteger(context?.actorUserId) || context.actorUserId <= 0) {
      throw new BadRequestException('Status change actor is required');
    }
    const reason = context.reason?.trim() || 'Ops payment authorization';

    const precheck = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!precheck) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const actorRole = (context.actorRole ?? '').toLowerCase();
    const isOps =
      actorRole === 'ops_admin' ||
      actorRole === 'super_admin' ||
      actorRole === 'system';
    if (!isOps) {
      throw new ForbiddenException({
        code: 'ops_only_payment_authorization',
        message:
          'Only ops or super admin can authorize payment to start production',
      });
    }

    // Idempotent: already authorized.
    if (
      precheck.orderStatus === OrderStatus.PAYMENT_AUTHORIZED &&
      precheck.paymentAuthorizationStatus ===
        PaymentAuthorizationStatus.AUTHORIZED
    ) {
      return (await this.findById(orderId)) ?? precheck;
    }

    const precheckIsRfq = this.isRfqQuoteOrder(precheck);
    if (
      precheckIsRfq &&
      (precheck.orderStatus !== OrderStatus.AWAITING_PAYMENT ||
        precheck.pricingStatus !== PricingStatus.ACCEPTED)
    ) {
      throw new BadRequestException({
        code: 'rfq_quote_not_accepted',
        message:
          'RFQ payment requires customer acceptance of the current quote',
      });
    }

    if (
      !precheckIsRfq &&
      precheck.orderStatus !== OrderStatus.SUPPLIER_ACCEPTED &&
      precheck.orderStatus !== OrderStatus.AWAITING_PAYMENT
    ) {
      throw new BadRequestException({
        code: 'invalid_status_for_authorization',
        message: `Cannot authorize payment from status ${precheck.orderStatus}`,
      });
    }

    let creditMutation: CreditMutationResult | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const owner = await manager.getRepository(User).findOne({
        where: { id: precheck.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!owner) throw new NotFoundException('Order owner not found');
      if (precheck.batchOrderId != null) {
        const batch = await manager.getRepository(BatchOrder).findOne({
          where: { id: precheck.batchOrderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!batch) throw new NotFoundException('Batch order not found');
      }
      const locked = await ordersRepo.findOneOrFail({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        locked.userId !== precheck.userId ||
        locked.batchOrderId !== precheck.batchOrderId
      ) {
        throw new BadRequestException({
          code: 'order_changed_during_authorization',
          message: 'Order commerce ownership changed during authorization',
        });
      }

      if (
        locked.orderStatus === OrderStatus.PAYMENT_AUTHORIZED &&
        locked.paymentAuthorizationStatus ===
          PaymentAuthorizationStatus.AUTHORIZED
      ) {
        return { previous: null as Order | null, order: locked };
      }

      if (
        this.isRfqQuoteOrder(locked) &&
        (locked.orderStatus !== OrderStatus.AWAITING_PAYMENT ||
          locked.pricingStatus !== PricingStatus.ACCEPTED)
      ) {
        throw new BadRequestException({
          code: 'rfq_quote_not_accepted',
          message:
            'RFQ payment requires customer acceptance of the current quote',
        });
      }

      if (
        !this.isRfqQuoteOrder(locked) &&
        locked.orderStatus !== OrderStatus.SUPPLIER_ACCEPTED &&
        locked.orderStatus !== OrderStatus.AWAITING_PAYMENT
      ) {
        throw new BadRequestException({
          code: 'invalid_status_for_authorization',
          message: `Cannot authorize payment from status ${locked.orderStatus}`,
        });
      }

      assertOrderStatusTransition(
        locked.orderStatus,
        OrderStatus.PAYMENT_AUTHORIZED,
      );

      const paymentMethod = String(locked.paymentMethod ?? '');
      const isCredit = OrdersService.isCreditPaymentMethod(paymentMethod);
      const isCod = isCodPaymentMethod(paymentMethod);

      if (!isCredit && !isCod) {
        throw new BadRequestException({
          code: 'unsupported_payment_method',
          message: `Payment authorization does not support method '${paymentMethod}'`,
        });
      }

      let rfqSnapshot: FreezeAuthorizationInput | null = null;
      let authorizationTotalMinor = locked.finalTotalMinor;
      if (this.isRfqQuoteOrder(locked)) {
        const assignments = await manager
          .getRepository(SupplierAssignment)
          .find({
            where: { orderId: locked.id },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
          });
        const current = [...assignments]
          .reverse()
          .find(({ decision }) =>
            [
              SupplierAssignmentDecision.PENDING,
              SupplierAssignmentDecision.ACCEPTED,
            ].includes(decision),
          );
        if (
          current?.decision !== SupplierAssignmentDecision.ACCEPTED ||
          current.promisedDate == null
        ) {
          throw new BadRequestException({
            code: 'current_quote_missing',
            message: 'The accepted RFQ no longer has current supplier terms',
          });
        }
        let goodsMinor: string;
        let quoteMinor: string;
        let deliveryFeeMinor: string;
        try {
          goodsMinor = normalizePositiveSafeMinor(
            current.finalPriceMinor,
            'finalPriceMinor',
          );
          quoteMinor = normalizePositiveSafeMinor(
            locked.quotedTotalMinor,
            'quotedTotalMinor',
          );
          deliveryFeeMinor = subtractSafeMinor(
            quoteMinor,
            goodsMinor,
            'quoted delivery fee',
          );
        } catch {
          throw new BadRequestException({
            code: 'current_quote_missing',
            message: 'The accepted RFQ money is missing or inconsistent',
          });
        }
        authorizationTotalMinor = quoteMinor;
        rfqSnapshot = {
          priceMinor: goodsMinor,
          deliveryFeeMinor,
          promisedDate: locked.promisedCompletionAt ?? current.promisedDate,
          paymentMethod,
        };
      }

      if (isCredit) {
        creditMutation = await this.settlePilotCreditsForAuthorization(
          locked,
          context.actorUserId,
          manager,
          authorizationTotalMinor,
        );
        locked.paymentStatus = 'paid';
      } else {
        // COD: authorize for collection — cash remains pending until rider collect.
        const codResult =
          await this.paymentsService.assertCodEligibleForCheckout(
            {
              userId: locked.userId,
              paymentMethod,
              finalTotalMinor: authorizationTotalMinor,
              excludeOrderId: locked.id,
            },
            manager,
          );
        locked.codEligible = codResult?.eligible === true;
        await this.paymentsService.ensurePendingCodCollection(
          {
            orderId: locked.id,
            amountMinor: String(authorizationTotalMinor ?? '0'),
            eligible: locked.codEligible,
            eligibilityReason: codResult?.message ?? null,
          },
          manager,
        );
        // paymentStatus stays pending until cash_collected.
      }

      this.freezeAuthorizationSnapshot(
        locked,
        rfqSnapshot ?? { paymentMethod },
      );

      const fromStatus = locked.orderStatus;
      locked.orderStatus = OrderStatus.PAYMENT_AUTHORIZED;

      const saved = await ordersRepo.save(locked);

      await manager.getRepository(OrderStatusHistory).insert({
        orderId: locked.id,
        fromStatus,
        toStatus: OrderStatus.PAYMENT_AUTHORIZED,
        changedByUserId: context.actorUserId,
        notes: reason,
      });
      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus: OrderStatus.PAYMENT_AUTHORIZED,
          actorUserId: context.actorUserId,
          actorRole: context.actorRole ?? null,
          reason,
        },
        manager,
      );

      return {
        previous: { ...locked, orderStatus: fromStatus } as Order,
        order: saved,
      };
    });

    this.creditsService.publishCreditMutation?.(creditMutation);

    if (!result.previous) {
      return (await this.findById(orderId)) ?? result.order;
    }

    try {
      return await this.publishStatusUpdate(
        result.previous,
        orderId,
        OrderStatus.PAYMENT_AUTHORIZED,
        null,
      );
    } catch {
      this.logger.warn(
        `Post-commit auth publication failed for order ${orderId}; returning committed state`,
      );
      return (await this.findById(orderId)) ?? result.order;
    }
  }

  /**
   * Pilot Credits path: reserve then spend with stable per-order idempotency keys.
   * Skips ledger when payment was already marked paid (legacy create-time debit).
   */
  private async settlePilotCreditsForAuthorization(
    order: Order,
    actorUserId: number,
    manager: EntityManager,
    finalTotalMinor?: string | null,
  ): Promise<CreditMutationResult | null> {
    const amountCredits =
      finalTotalMinor != null
        ? minorToCredits(finalTotalMinor)
        : calculateChargeTotal({
            totalPrice: order.totalPrice,
            deliveryFee: order.deliveryFee,
          });

    if (amountCredits <= 0) {
      return null;
    }

    // Legacy create() already debited gridCredits — do not double-spend.
    if (String(order.paymentStatus ?? '').toLowerCase() === 'paid') {
      return null;
    }

    const reserveKey = OrdersService.creditReserveIdempotencyKey(order.id);
    const spendKey = OrdersService.creditSpendIdempotencyKey(order.id);
    const referenceId = order.orderId ?? `ORDER:${order.id}`;

    await this.creditsService.reserveCredits(
      order.userId,
      amountCredits,
      reserveKey,
      {
        referenceId,
        reason: `Payment auth reserve for ${referenceId}`,
        actorUserId,
        manager,
      },
    );

    return this.creditsService.spendCredits(
      order.userId,
      amountCredits,
      spendKey,
      {
        reserveIdempotencyKey: reserveKey,
        referenceId,
        reason: `Payment auth spend for ${referenceId}`,
        actorUserId,
        manager,
      },
    );
  }

  private isRfqQuoteOrder(order: Partial<Order>): boolean {
    return (
      order.quotedTotalMinor != null ||
      order.quotedAt != null ||
      order.pricingStatus === PricingStatus.PENDING_QUOTE ||
      order.pricingStatus === PricingStatus.QUOTED
    );
  }

  /**
   * Expire orders still waiting for ops payment authorization after supplier
   * accept (24h). Releases supplier assignment (stub when matching service
   * absent) and returns the order to `approved_for_matching` for re-match.
   *
   * Invoked by PaymentTimeoutSchedulerService; also unit-testable with `now`.
   */
  async expireStalePaymentAuthorizations(now: Date = new Date()): Promise<{
    expiredOrderIds: number[];
    operationsResolutionOrderIds: number[];
    scanned: number;
  }> {
    const waitingStatuses = [
      OrderStatus.SUPPLIER_ACCEPTED,
      OrderStatus.AWAITING_PAYMENT,
    ];
    const candidates = await this.ordersRepo.find({
      where: waitingStatuses.map((orderStatus) => ({ orderStatus })),
      order: { id: 'ASC' },
    });

    const expiredOrderIds: number[] = [];
    const operationsResolutionOrderIds: number[] = [];
    const cutoff = now.getTime() - OrdersService.PAYMENT_AUTH_TIMEOUT_MS;

    for (const candidate of candidates) {
      const waitStartedAt = await this.resolvePaymentWaitStartedAt(candidate);
      if (waitStartedAt.getTime() > cutoff) {
        continue;
      }

      try {
        const result = await this.expirePaymentWait(candidate.id, now);
        if (result.outcome === 'expired') {
          expiredOrderIds.push(candidate.id);
        } else if (result.outcome === 'operations_resolution_required') {
          operationsResolutionOrderIds.push(candidate.id);
        }
      } catch (err) {
        this.logger.warn(
          `Payment timeout expiry failed for order ${candidate.id}: ${err}`,
        );
      }
    }

    return {
      expiredOrderIds,
      operationsResolutionOrderIds,
      scanned: candidates.length,
    };
  }

  /**
   * When payment wait started: prefer status-history entry into current status;
   * fall back to updatedAt / createdAt.
   */
  private async resolvePaymentWaitStartedAt(order: Order): Promise<Date> {
    try {
      const history = await this.dataSource
        .getRepository(OrderStatusHistory)
        .find({
          where: {
            orderId: order.id,
            toStatus: order.orderStatus,
          },
          order: { id: 'DESC' },
          take: 1,
        });
      if (history[0]?.createdAt) {
        return new Date(history[0].createdAt);
      }
    } catch {
      // History unavailable — fall through.
    }
    return new Date(order.updatedAt ?? order.createdAt ?? Date.now());
  }

  /**
   * Single-order payment timeout: mark expired, stub-release assignment,
   * return to approved_for_matching.
   */
  async expirePaymentWait(
    orderId: number,
    now: Date = new Date(),
  ): Promise<PaymentWaitExpiryResult> {
    const systemActorId = 0;
    const reason = `Payment authorization timed out after 24h (${now.toISOString()})`;

    const result = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const locked = await ordersRepo.findOneOrFail({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        locked.pricingStatus === PricingStatus.ACCEPTED &&
        locked.quoteAcceptedAt != null
      ) {
        return {
          outcome: 'operations_resolution_required' as const,
          previous: null as Order | null,
          order: locked,
        };
      }

      if (
        locked.orderStatus !== OrderStatus.SUPPLIER_ACCEPTED &&
        locked.orderStatus !== OrderStatus.AWAITING_PAYMENT
      ) {
        return {
          outcome: 'not_waiting' as const,
          previous: null as Order | null,
          order: locked,
        };
      }

      assertOrderStatusTransition(
        locked.orderStatus,
        OrderStatus.APPROVED_FOR_MATCHING,
      );

      // Best-effort: release any open pilot credit reserve for this order.
      await this.releaseOpenAuthReserveIfAny(locked, manager);

      // Stub reassignment: mark accepted/pending supplier assignments cancelled.
      await this.stubReleaseSupplierAssignments(
        manager,
        locked.id,
        'payment_timeout',
      );

      const fromStatus = locked.orderStatus;
      locked.orderStatus = OrderStatus.APPROVED_FOR_MATCHING;
      locked.paymentAuthorizationStatus = PaymentAuthorizationStatus.EXPIRED;

      const saved = await ordersRepo.save(locked);

      await manager.getRepository(OrderStatusHistory).insert({
        orderId: locked.id,
        fromStatus,
        toStatus: OrderStatus.APPROVED_FOR_MATCHING,
        changedByUserId: systemActorId,
        notes: reason,
      });
      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
          actorUserId: systemActorId,
          actorRole: 'system',
          reason,
        },
        manager,
      );

      return {
        outcome: 'expired' as const,
        previous: { ...locked, orderStatus: fromStatus } as Order,
        order: saved,
      };
    });

    if (!result.previous) {
      return { outcome: result.outcome, order: result.order };
    }
    try {
      const order = await this.publishStatusUpdate(
        result.previous,
        orderId,
        OrderStatus.APPROVED_FOR_MATCHING,
        null,
      );
      return { outcome: result.outcome, order };
    } catch {
      return {
        outcome: result.outcome,
        order: (await this.findById(orderId)) ?? result.order,
      };
    }
  }

  private async releaseOpenAuthReserveIfAny(
    order: Order,
    manager: EntityManager,
  ): Promise<void> {
    if (!OrdersService.isCreditPaymentMethod(order.paymentMethod)) {
      return;
    }
    const amountCredits = calculateChargeTotal({
      totalPrice: order.totalPrice,
      deliveryFee: order.deliveryFee,
    });
    if (amountCredits <= 0) return;

    const reserveKey = OrdersService.creditReserveIdempotencyKey(order.id);
    const releaseKey = `payment-auth:release:order:${order.id}:timeout`;
    try {
      await this.creditsService.releaseCredits(
        order.userId,
        amountCredits,
        releaseKey,
        {
          reserveIdempotencyKey: reserveKey,
          referenceId: order.orderId ?? `ORDER:${order.id}`,
          reason: 'Payment auth timeout release',
          actorUserId: 0,
          manager,
        },
      );
    } catch {
      // No open reserve (already spent/released/never reserved) — ignore.
    }
  }

  /**
   * Stub: cancel open supplier_assignments for the order so capacity can re-match.
   * Matching service will own richer reassignment in Phase 4/5.
   */
  private async stubReleaseSupplierAssignments(
    manager: EntityManager,
    orderId: number,
    reason: string,
  ): Promise<void> {
    try {
      await manager.query(
        `UPDATE supplier_assignments
         SET decision = 'cancelled',
             decision_reason = $2,
             decided_at = NOW(),
             updated_at = NOW()
         WHERE order_id = $1
           AND decision IN ('pending', 'accepted')`,
        [orderId, reason],
      );
    } catch (err) {
      // Table may not exist in unit tests / early envs.
      this.logger.debug?.(
        `stubReleaseSupplierAssignments skipped for order ${orderId}: ${err}`,
      );
    }
  }

  private async assertBetaPaymentMethod(
    userId: number,
    paymentMethod: string,
    isBetaModeEnabled = true,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user?.role !== UserRole.CLIENT || !user.isBetaUser) return;
    if (
      isBetaModeEnabled &&
      !OrdersService.isCreditPaymentMethod(paymentMethod)
    ) {
      throw new ForbiddenException({
        code: 'beta_credits_only',
        message: 'Beta checkout requires GRIDGO Credits.',
      });
    }
  }

  private async lockBetaModeEnabled(manager: EntityManager): Promise<boolean> {
    const settings = await manager.getRepository(BetaModeSettings).findOne({
      where: {},
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    return settings?.isEnabled ?? false;
  }

  private async nextBatchReferences(
    manager: EntityManager,
    orderCount: number,
  ): Promise<{
    batchRef: string;
    orderRefs: string[];
  }> {
    if (!Number.isInteger(orderCount) || orderCount <= 0) {
      throw new BadRequestException('Reference allocation requires an order');
    }
    await manager.query('SELECT pg_advisory_xact_lock(1196573522)');
    const rows = await manager.query<
      Array<{ max_batch_ref: string | number; max_order_ref: string | number }>
    >(`
      WITH batch_max AS (
        SELECT COALESCE(
          MAX(substring(batch_ref FROM '^BATCH-([0-9]+)$')::bigint),
          10000
        ) AS value
        FROM batch_orders
      ), order_max AS (
        SELECT COALESCE(
          MAX(substring(order_id FROM '^ORD-([0-9]+)$')::bigint),
          10000
        ) AS value
        FROM orders
      )
      SELECT
        batch_max.value AS max_batch_ref,
        order_max.value AS max_order_ref
      FROM batch_max, order_max
    `);
    const maxBatchRef = Number(rows[0]?.max_batch_ref ?? 10000);
    const maxOrderRef = Number(rows[0]?.max_order_ref ?? 10000);

    return {
      batchRef: `BATCH-${(maxBatchRef + 1).toString().padStart(5, '0')}`,
      orderRefs: Array.from(
        { length: orderCount },
        (_, index) =>
          `ORD-${(maxOrderRef + index + 1).toString().padStart(5, '0')}`,
      ),
    };
  }

  private async findAutoSlotCandidates(
    now: Date = new Date(),
  ): Promise<SlotCandidate[]> {
    const today = phTodayDateString(now);
    const phNowMinutes = phMinutesSinceMidnight(now);
    const candidates: SlotCandidate[] = [];

    for (let offset = 0; offset < AUTO_SLOT_SEARCH_DAYS; offset += 1) {
      const date = addDaysToDateString(today, offset);
      const slots = await this.slotsService.getAvailability(date);
      for (const slot of slots) {
        if (slot.isFull) continue;
        if (
          offset === 0 &&
          !this.sameDaySlotEndIsFuture(slot.endTime, phNowMinutes)
        ) {
          continue;
        }
        candidates.push({
          slotTemplateId: slot.templateId,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }

    return candidates;
  }

  private sameDaySlotEndIsFuture(
    endTime: string,
    phNowMinutes: number,
  ): boolean {
    const [hours, minutes] = endTime.split(':').map(Number);
    return hours * 60 + minutes > phNowMinutes;
  }

  private isSlotFullError(err: unknown): boolean {
    if (err instanceof SlotFullException) return true;
    return (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      typeof (err as { response?: { code?: unknown } }).response === 'object' &&
      (err as { response?: { code?: unknown } }).response?.code === 'slot_full'
    );
  }

  private normalizeTemporaryAddress(
    address?: TemporaryDeliveryAddressDto | null,
  ): NormalizedTemporaryDeliveryAddress | null {
    if (!address) return null;
    const fullAddress = this.normalizeOptionalText(address.fullAddress);
    const city = this.normalizeOptionalText(address.city);
    const latitude = Number(address.latitude);
    const longitude = Number(address.longitude);
    if (
      !fullAddress ||
      !city ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      throw new BadRequestException('Invalid temporary address');
    }

    return {
      label: this.normalizeOptionalText(address.label) ?? undefined,
      fullAddress,
      barangay: this.normalizeOptionalText(address.barangay) ?? undefined,
      city,
      province: this.normalizeOptionalText(address.province) ?? undefined,
      zipCode: this.normalizeOptionalText(address.zipCode) ?? undefined,
      landmark: this.normalizeOptionalText(address.landmark) ?? undefined,
      latitude,
      longitude,
    };
  }

  private destinationFromTemporaryAddress(
    address: NormalizedTemporaryDeliveryAddress,
    labelOverride?: string,
  ): NormalizedDeliveryDestination {
    return {
      addressId: null,
      label: this.normalizeOptionalText(labelOverride) ?? address.label ?? null,
      fullAddress: address.fullAddress,
      barangay: address.barangay ?? null,
      city: address.city,
      province: address.province ?? null,
      zipCode: address.zipCode ?? null,
      landmark: address.landmark ?? null,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  }

  private destinationFromSavedAddress(
    address: Address,
    labelOverride?: string,
  ): NormalizedDeliveryDestination {
    const latitude = Number(address.latitude);
    const longitude = Number(address.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      throw new BadRequestException(
        'Saved delivery address is missing a valid map pin',
      );
    }
    return {
      addressId: address.id,
      label:
        this.normalizeOptionalText(labelOverride) ??
        this.normalizeOptionalText(address.label) ??
        null,
      fullAddress: address.fullAddress,
      barangay: address.barangay ?? null,
      city: address.city,
      province: address.province ?? null,
      zipCode: address.zipCode ?? null,
      landmark: address.landmark ?? null,
      latitude,
      longitude,
    };
  }

  private async validateDeliveryAddress(
    deliveryAddressId: number,
    userId: number,
  ): Promise<number> {
    const address = await this.findOwnedDeliveryAddress(
      deliveryAddressId,
      userId,
    );
    return address.id;
  }

  private async findOwnedDeliveryAddress(
    deliveryAddressId: number,
    userId: number,
  ): Promise<Address> {
    if (!Number.isInteger(deliveryAddressId) || deliveryAddressId <= 0) {
      throw new BadRequestException('Invalid delivery address');
    }

    const address = await this.addressRepo.findOne({
      where: { id: deliveryAddressId, userId },
    });

    if (!address) {
      throw new BadRequestException('Invalid delivery address');
    }

    return address;
  }

  private async findOwnedFileMetadata(
    fileMetadataId: number,
    userId: number,
  ): Promise<FileMetadata> {
    if (!Number.isInteger(fileMetadataId) || fileMetadataId <= 0) {
      throw new BadRequestException('Invalid uploaded file reference');
    }

    const file = await this.fileMetadataRepo.findOne({
      where: { id: fileMetadataId },
    });

    if (!file || file.uploadedBy !== userId) {
      throw new BadRequestException('Invalid uploaded file reference');
    }

    return file;
  }

  private selectedSpecsFromLegacy(item: {
    category?: string;
    specs?: Record<string, unknown>;
    paperSpecs?: {
      paperSize?: unknown;
      colorMode?: unknown;
      mediaType?: unknown;
      printSides?: unknown;
      binding?: unknown;
      printMode?: unknown;
    };
    threeDSpecs?: {
      fileFormat?: unknown;
      material?: unknown;
      color?: unknown;
      infillPercentage?: unknown;
      infill_percentage?: unknown;
      layerHeight?: unknown;
      layer_height?: unknown;
      supports?: unknown;
      notes?: unknown;
    };
    pageCount?: unknown;
  }): Record<string, unknown> {
    const selected: Record<string, unknown> = { ...(item.specs ?? {}) };

    if (item.paperSpecs) {
      selected.paper_size ??= this.normalizeSpecValue(
        item.paperSpecs.paperSize,
        {
          twentyByThirty: 'twenty_by_thirty',
        },
      );
      selected.color_mode ??= this.normalizeSpecValue(
        item.paperSpecs.colorMode,
        {
          blackAndWhite: 'black_and_white',
          fullColor: 'full_color',
        },
      );
      selected.media_type ??= this.normalizeSpecValue(
        item.paperSpecs.mediaType,
      );
      selected.print_sides ??= this.normalizeSpecValue(
        item.paperSpecs.printSides,
        {
          frontOnly: 'front_only',
          backToBack: 'back_to_back',
        },
      );
      selected.binding ??= this.normalizeSpecValue(item.paperSpecs.binding);
      selected.print_mode ??= this.normalizeSpecValue(
        item.paperSpecs.printMode,
      );
    }

    if (item.threeDSpecs) {
      selected.file_format ??= this.normalizeSpecValue(
        item.threeDSpecs.fileFormat,
        {
          threeMf: '3mf',
          three_mf: '3mf',
        },
      );
      selected.material ??= this.normalizeSpecValue(item.threeDSpecs.material);
      selected.color ??= item.threeDSpecs.color ?? 'white';
      selected.infill_percentage ??=
        item.threeDSpecs.infillPercentage ?? item.threeDSpecs.infill_percentage;
      selected.layer_height ??=
        item.threeDSpecs.layerHeight ?? item.threeDSpecs.layer_height;
      selected.supports ??= item.threeDSpecs.supports ?? false;
      selected.notes ??= item.threeDSpecs.notes ?? '';
    }

    if (item.pageCount != null) {
      selected.page_count ??= item.pageCount;
    }

    return selected;
  }

  private normalizeSpecialInstructions(value: unknown): string | null {
    if (value == null) return null;
    const text = (
      typeof value === 'string' ? value : JSON.stringify(value)
    ).trim();
    return text.length === 0 ? null : text;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (value == null) return null;
    const text = (
      typeof value === 'string' ? value : JSON.stringify(value)
    ).trim();
    return text.length === 0 ? null : text;
  }

  private normalizeSpecValue(
    value: unknown,
    aliases: Record<string, string> = {},
  ): unknown {
    if (value == null) return value;
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (aliases[raw]) return aliases[raw];
    return raw;
  }

  async listExternalDeliveries(status?: string) {
    return this.batchOrdersRepo.find({
      where: {
        deliveryType: 'external',
        ...(status
          ? {
              externalDeliveryStatus: status as
                | 'pending_admin'
                | 'booked'
                | 'delivered',
            }
          : {}),
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async updateManualStatus(
    orderId: number,
    dto: UpdateManualStatusDto,
  ): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id: orderId },
    });
    const wasFirstSet = order.adminStatusSetAt === null && dto.note !== null;
    order.adminStatusNote = dto.note;
    order.estimatedCompletionAt = dto.estimatedCompletionAt
      ? new Date(dto.estimatedCompletionAt)
      : null;
    if (dto.note !== null && order.adminStatusSetAt === null) {
      order.adminStatusSetAt = new Date();
    }
    const saved = await this.ordersRepo.save(order);

    if (wasFirstSet) {
      try {
        await this.notificationsService.create({
          userId: order.userId,
          title: `Order #ORD-${order.id} update`,
          message: dto.note ?? '',
          type: 'order_admin_status',
          orderRef: order.orderId,
          metadata: { orderId: order.id },
        });
      } catch (err) {
        this.logger.warn(
          `Manual status notification failed for order ${orderId}: ${err}`,
        );
      }
    }

    return saved;
  }

  async updateExternalDeliveryStatus(
    id: number,
    status: 'pending_admin' | 'booked' | 'delivered',
  ): Promise<void> {
    await this.batchOrdersRepo.update(id, { externalDeliveryStatus: status });
  }

  async cancelBatch(batchOrderId: number, userId: number): Promise<void> {
    const cancellation = await this.cancelBatchInTransaction(
      batchOrderId,
      userId,
    );
    this.creditsService.publishCreditMutation?.(cancellation.creditMutation);
    this.slotsService.publishReleasedSlot?.(cancellation.releasedSlotDate);
    for (const previous of cancellation.previousOrders) {
      await this.publishStatusUpdate(previous, previous.id, 'cancelled');
    }
  }

  async cancelOrder(id: number, userId: number): Promise<Order> {
    const candidate = await this.ordersRepo.findOneOrFail({
      where: { id },
    });
    if (candidate.userId !== userId) {
      throw new Error('Forbidden');
    }
    if (candidate.batchOrderId != null) {
      const cancellation = await this.cancelBatchInTransaction(
        candidate.batchOrderId,
        userId,
      );
      this.creditsService.publishCreditMutation?.(cancellation.creditMutation);
      this.slotsService.publishReleasedSlot?.(cancellation.releasedSlotDate);
      for (const previous of cancellation.previousOrders) {
        await this.publishStatusUpdate(previous, previous.id, 'cancelled');
      }
      const order = await this.findById(id);
      if (!order) throw new NotFoundException('Order not found');
      return order;
    }

    const cancellation = await this.dataSource.transaction(async (manager) => {
      const transactionOrdersRepo = manager.getRepository(Order);
      const order = await transactionOrdersRepo.findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (order.userId !== userId) throw new Error('Forbidden');
      const alreadyCancelled = order.orderStatus === OrderStatus.CANCELLED;
      if (
        !alreadyCancelled &&
        !OrdersService.CANCELLABLE_STATUSES.includes(order.orderStatus)
      ) {
        throw new Error('Order cannot be cancelled at this stage');
      }

      const creditPayment = OrdersService.isCreditPaymentMethod(
        order.paymentMethod,
      );
      let creditMutation: CreditMutationResult | null = null;
      if (creditPayment) {
        const refundAmount = calculateChargeTotal({
          totalPrice: order.totalPrice,
          deliveryFee: order.deliveryFee,
        });
        if (refundAmount > 0) {
          creditMutation = await this.creditsService.refundCredits(
            order.userId,
            refundAmount,
            `ORDER-REFUND:${order.orderId}`,
            manager,
            [order.orderId],
          );
        }
      }
      const updateResult = await transactionOrdersRepo.update(
        { id, orderStatus: order.orderStatus },
        {
          orderStatus: OrderStatus.CANCELLED,
          ...(creditPayment ? { paymentStatus: 'refunded' } : {}),
        },
      );
      if (updateResult?.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during cancellation');
      }
      if (!alreadyCancelled) {
        await manager.getRepository(OrderStatusHistory).insert({
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.CANCELLED,
          changedByUserId: userId,
          notes: 'Customer cancelled order',
        });
        await this.auditService.recordOrderStatusTransition(
          {
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.CANCELLED,
            actorUserId: userId,
            actorRole: 'client',
            reason: 'Customer cancelled order',
          },
          manager,
        );
      }
      return {
        previous: alreadyCancelled ? null : order,
        creditMutation,
      };
    });

    this.creditsService.publishCreditMutation?.(cancellation.creditMutation);
    if (cancellation.previous) {
      return this.publishStatusUpdate(cancellation.previous, id, 'cancelled');
    }
    const order = await this.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async cancelBatchInTransaction(
    batchOrderId: number,
    userId: number,
  ): Promise<{
    previousOrders: Order[];
    creditMutation: CreditMutationResult | null;
    releasedSlotDate: string | null;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const transactionBatchRepo = manager.getRepository(BatchOrder);
      const transactionOrdersRepo = manager.getRepository(Order);
      const batch = await transactionBatchRepo.findOne({
        where: { id: batchOrderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch || batch.userId !== userId) {
        throw new NotFoundException('Batch order not found');
      }
      const orders = await transactionOrdersRepo.find({
        where: { batchOrderId },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        orders.length === 0 ||
        orders.some((order) => order.userId !== userId)
      ) {
        throw new NotFoundException('Batch order not found');
      }

      const pending = orders.filter(
        (order) => order.orderStatus !== OrderStatus.CANCELLED,
      );
      for (const order of pending) {
        if (!OrdersService.CANCELLABLE_STATUSES.includes(order.orderStatus)) {
          throw new BadRequestException(
            `Order ${order.orderId} in status "${order.orderStatus}" cannot be cancelled`,
          );
        }
      }

      let releasedSlotDate: string | null = null;
      if (batch.slotBookingId) {
        try {
          releasedSlotDate = await this.slotsService.releaseSlot(
            manager,
            batch.slotBookingId,
          );
          batch.slotBookingId = null;
        } catch (error) {
          if (error instanceof CancellationClosedException) throw error;
          this.logger.warn(
            `Failed to release slot for batch ${batchOrderId}: ${error}`,
          );
        }
      }

      const creditPayment = OrdersService.isCreditPaymentMethod(
        batch.paymentMethod,
      );
      let creditMutation: CreditMutationResult | null = null;
      if (creditPayment) {
        const refundAmount = calculateChargeTotal(batch);
        if (refundAmount > 0) {
          creditMutation = await this.creditsService.refundCredits(
            batch.userId,
            refundAmount,
            `BATCH-REFUND:${batch.batchRef}`,
            manager,
            orders.map((order) => order.orderId),
          );
        }
        batch.paymentStatus = 'refunded';
      }
      await transactionBatchRepo.save(batch);
      const updateResult = await transactionOrdersRepo.update(
        {
          id: In(orders.map((order) => order.id)),
          batchOrderId,
          userId,
          orderStatus: In([
            ...OrdersService.CANCELLABLE_STATUSES,
            OrderStatus.CANCELLED,
          ]),
        },
        {
          orderStatus: OrderStatus.CANCELLED,
          ...(creditPayment ? { paymentStatus: 'refunded' } : {}),
        },
      );
      if (
        updateResult?.affected != null &&
        updateResult.affected !== orders.length
      ) {
        throw new BadRequestException('Batch changed during cancellation');
      }
      if (pending.length > 0) {
        await manager.getRepository(OrderStatusHistory).insert(
          pending.map((order) => ({
            orderId: order.id,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.CANCELLED,
            changedByUserId: userId,
            notes: 'Customer cancelled batch',
          })),
        );
        for (const order of pending) {
          await this.auditService.recordOrderStatusTransition(
            {
              orderId: order.id,
              fromStatus: order.orderStatus,
              toStatus: OrderStatus.CANCELLED,
              actorUserId: userId,
              actorRole: 'client',
              reason: 'Customer cancelled batch',
            },
            manager,
          );
        }
      }
      return {
        previousOrders: pending,
        creditMutation,
        releasedSlotDate,
      };
    });
  }

  async confirmReceipt(id: number, userId: number): Promise<Order> {
    await this.dataSource.transaction(async (manager) => {
      const transactionOrdersRepo = manager.getRepository(Order);
      const order = await transactionOrdersRepo.findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (order.userId !== userId) {
        throw new ForbiddenException(
          'You can only confirm receipt for your own orders',
        );
      }

      if (
        order.orderStatus !== OrderStatus.ISSUE_WINDOW_OPEN &&
        order.orderStatus !== OrderStatus.DELIVERED &&
        order.orderStatus !== OrderStatus.COLLECTED_BY_CUSTOMER
      ) {
        throw new BadRequestException(
          'Order cannot be confirmed at this stage',
        );
      }

      await transactionOrdersRepo.update(
        { id: order.id, orderStatus: order.orderStatus },
        { orderStatus: OrderStatus.COMPLETED },
      );

      await manager.getRepository(OrderStatusHistory).insert({
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: OrderStatus.COMPLETED,
        changedByUserId: userId,
        notes: 'Customer confirmed receipt',
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.COMPLETED,
          actorUserId: userId,
          actorRole: 'client',
          reason: 'Customer confirmed receipt',
        },
        manager,
      );

      if (this.payoutsService) {
        await this.payoutsService.closeIssueWindowHold(order.id, manager);
      }
    });

    const completed = await this.findById(id);
    if (!completed) throw new NotFoundException('Order not found');
    return this.publishStatusUpdate(
      completed,
      id,
      'Customer confirmed receipt',
    );
  }

  async updateStatus(
    id: number,
    status: string,
    updates: Partial<Order> = {},
    context?: OrderStatusChangeContext,
  ): Promise<Order> {
    const orderStatus = parseOrderStatus(status);
    const candidate = await this.ordersRepo.findOneOrFail({ where: { id } });
    const completion = await this.dataSource.transaction(async (manager) => {
      if (candidate.batchOrderId != null) {
        await manager.getRepository(BatchOrder).findOneOrFail({
          where: { id: candidate.batchOrderId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      const transactionOrdersRepo = manager.getRepository(Order);
      const locked = await transactionOrdersRepo.findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.batchOrderId !== candidate.batchOrderId) {
        throw new BadRequestException('Order batch changed during update');
      }
      if (locked.orderStatus === orderStatus) {
        return {
          previous: null,
          surveyRequirement: null,
          publishedStatus: orderStatus,
        };
      }
      if (orderStatus === OrderStatus.CANCELLED) {
        throw new BadRequestException('Use the cancellation workflow');
      }
      // Money transitions must freeze snapshot / settle credits via authorizePayment.
      // Status-only jumps to payment_authorized skip the authorization gate.
      if (orderStatus === OrderStatus.PAYMENT_AUTHORIZED) {
        throw new BadRequestException({
          code: 'use_authorize_payment',
          message:
            'Use POST /orders/:id/authorize-payment to enter payment_authorized',
        });
      }
      if (
        RIDER_ASSIGNMENT_WORKFLOW_STATUSES.has(orderStatus) ||
        (locked.orderStatus === OrderStatus.RIDER_ASSIGNED &&
          orderStatus === OrderStatus.READY_FOR_DISPATCH)
      ) {
        throw new BadRequestException('Use the rider assignment workflow');
      }
      if (
        orderStatus === OrderStatus.COLLECTED_BY_CUSTOMER &&
        locked.deliveryOption !== 'pickup'
      ) {
        throw new BadRequestException(
          'Completed pickup requires a pickup order',
        );
      }
      assertOrderStatusTransition(locked.orderStatus, orderStatus);
      // Production requires payment authorization (PRD §5.3 / Task 3.3).
      // Graph already requires payment_authorized status; also enforce the
      // independent paymentAuthorizationStatus flag (COD auth ≠ cash collected).
      if (orderStatus === OrderStatus.PRODUCTION) {
        if (
          locked.paymentAuthorizationStatus !==
            PaymentAuthorizationStatus.AUTHORIZED ||
          locked.orderStatus !== OrderStatus.PAYMENT_AUTHORIZED
        ) {
          throw new BadRequestException({
            code: 'payment_not_authorized',
            message:
              'Cannot enter production without payment authorization (payment_authorized)',
          });
        }
      }
      if (
        !Number.isInteger(context?.actorUserId) ||
        context!.actorUserId <= 0
      ) {
        throw new BadRequestException('Status change actor is required');
      }
      const reason = context?.reason?.trim();
      if (!reason) {
        throw new BadRequestException('Status change reason is required');
      }
      const updateResult = await transactionOrdersRepo.update(
        { id, orderStatus: locked.orderStatus },
        {
          ...updates,
          orderStatus,
        },
      );
      if (updateResult?.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during status update');
      }
      await manager.getRepository(OrderStatusHistory).insert({
        orderId: id,
        fromStatus: locked.orderStatus,
        toStatus: orderStatus,
        changedByUserId: context!.actorUserId,
        notes: reason,
      });
      await this.auditService.recordOrderStatusTransition(
        {
          orderId: id,
          fromStatus: locked.orderStatus,
          toStatus: orderStatus,
          actorUserId: context!.actorUserId,
          actorRole: context?.actorRole ?? null,
          reason,
        },
        manager,
      );

      // Pickup collection opens the same 24h material concern window as delivery.
      let publishedStatus = orderStatus;
      if (orderStatus === OrderStatus.COLLECTED_BY_CUSTOMER) {
        await this.openMaterialIssueWindow(
          manager,
          id,
          OrderStatus.COLLECTED_BY_CUSTOMER,
          context!.actorUserId,
          '24h material issue window opened after customer collection',
        );
        publishedStatus = OrderStatus.ISSUE_WINDOW_OPEN;
      }

      const surveyRequirement =
        orderStatus === OrderStatus.COLLECTED_BY_CUSTOMER
          ? await this.prepareCompletionRecords(manager, locked)
          : null;
      return {
        previous: locked,
        surveyRequirement,
        publishedStatus,
      };
    });
    if (!completion.previous) {
      const current = await this.findById(id);
      if (!current) throw new NotFoundException('Order not found');
      return current;
    }
    try {
      return await this.publishStatusUpdate(
        completion.previous,
        id,
        completion.publishedStatus ?? status,
        completion.surveyRequirement,
      );
    } catch {
      this.logger.warn(
        `Post-commit status publication failed for order ${id}; returning committed state`,
      );
      try {
        const current = await this.findById(id);
        if (current) return current;
      } catch {
        // The status transaction is already committed. Fall through to the
        // transaction-derived snapshot when the publication reload is down.
      }
      return {
        ...completion.previous,
        ...updates,
        orderStatus,
      } as Order;
    }
  }

  async completeDelivery(
    manager: EntityManager,
    orderId: number,
    actorUserId: number,
  ): Promise<OrderCompletionTransactionResult> {
    const ordersRepo = manager.getRepository(Order);
    const order = await ordersRepo.findOneOrFail({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (order.deliveryOption !== 'delivery') {
      throw new BadRequestException('Delivery completion requires delivery');
    }
    assertOrderStatusTransition(order.orderStatus, OrderStatus.DELIVERED);
    const fromStatus = order.orderStatus;
    const updateResult = await ordersRepo.update(
      { id: order.id, orderStatus: order.orderStatus },
      { orderStatus: OrderStatus.DELIVERED },
    );
    if (updateResult?.affected != null && updateResult.affected !== 1) {
      throw new BadRequestException('Order changed during rider update');
    }
    await manager.getRepository(OrderStatusHistory).insert({
      orderId: order.id,
      fromStatus,
      toStatus: OrderStatus.DELIVERED,
      changedByUserId: actorUserId,
      notes: 'Rider completed delivery',
    });
    await this.auditService.recordOrderStatusTransition(
      {
        orderId: order.id,
        fromStatus,
        toStatus: OrderStatus.DELIVERED,
        actorUserId,
        actorRole: 'rider',
        reason: 'Rider completed delivery',
      },
      manager,
    );

    // Immediately open 24h material issue window + held payout (Phase 9.2).
    await this.openMaterialIssueWindow(
      manager,
      order.id,
      OrderStatus.DELIVERED,
      actorUserId,
      '24h material issue window opened after delivery proof',
    );

    const surveyRequirement = await this.prepareCompletionRecords(
      manager,
      order,
    );
    // previous snapshot used by publisher — reflect pre-delivery status.
    // Notify with concern-window copy (final status is issue_window_open).
    return {
      previous: order,
      surveyRequirement,
      publishedStatus: OrderStatus.ISSUE_WINDOW_OPEN,
    };
  }

  /**
   * Open 24h material concern window after delivery or customer collection.
   * Sets issueWindowEndsAt, holds supplier payout, and moves to issue_window_open.
   */
  private async openMaterialIssueWindow(
    manager: EntityManager,
    orderId: number,
    fromStatus: OrderStatus,
    actorUserId: number | null,
    historyNotes: string,
  ): Promise<Date | null> {
    assertOrderStatusTransition(fromStatus, OrderStatus.ISSUE_WINDOW_OPEN);
    const ordersRepo = manager.getRepository(Order);

    let issueWindowEndsAt: Date | null = null;
    if (this.payoutsService) {
      try {
        const opened = await this.payoutsService.openIssueWindowOnDelivered(
          orderId,
          actorUserId,
          manager,
        );
        issueWindowEndsAt = opened.issueWindowEndsAt;
      } catch (err) {
        this.logger.warn(
          `Issue-window payout open failed for order ${orderId}: ${err}`,
        );
        issueWindowEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await ordersRepo.update({ id: orderId }, { issueWindowEndsAt });
      }
    } else {
      issueWindowEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await ordersRepo.update({ id: orderId }, { issueWindowEndsAt });
    }

    await ordersRepo.update(
      { id: orderId, orderStatus: fromStatus },
      {
        orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        ...(issueWindowEndsAt ? { issueWindowEndsAt } : {}),
      },
    );
    // Prefer a real user actor when present (e.g. rider who completed
    // delivery). Never write actor id 0 — audit_events.actor_id FKs to users.
    const historyActorId =
      actorUserId != null && actorUserId > 0 ? actorUserId : null;
    await manager.getRepository(OrderStatusHistory).insert({
      orderId,
      fromStatus,
      toStatus: OrderStatus.ISSUE_WINDOW_OPEN,
      // history column is NOT NULL without an FK; use 0 only as a last-resort
      // system sentinel when no actor is available.
      changedByUserId: historyActorId ?? 0,
      notes: historyNotes,
    });
    await this.auditService.recordOrderStatusTransition(
      {
        orderId,
        fromStatus,
        toStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        actorUserId: historyActorId,
        actorRole: 'system',
        reason: 'issue_window_open',
        metadata: {
          issueWindowEndsAt: issueWindowEndsAt?.toISOString() ?? null,
          systemAction: true,
        },
      },
      manager,
    );
    return issueWindowEndsAt;
  }

  private async prepareCompletionRecords(
    manager: EntityManager,
    order: Order,
  ): Promise<TamSurveyRequirement | null> {
    if (order.fileMetadataId != null) {
      const owner = await manager.getRepository(User).findOne({
        where: { id: order.userId },
        select: ['id', 'fileRetentionDays'],
      });
      if (owner?.fileRetentionDays != null) {
        await this.filesService.stampExpiry(
          order.fileMetadataId,
          owner.fileRetentionDays,
          manager,
        );
      }
    }
    return this.tamSurveysService.createPostDeliveryRequirementIfNeeded(
      order,
      manager,
    );
  }

  async publishStatusUpdate(
    existing: Order,
    id: number,
    status: string,
    surveyRequirement?: TamSurveyRequirement | null,
  ): Promise<Order> {
    const orderStatus = status as OrderStatus;
    const order = await this.ordersRepo.findOneOrFail({
      where: { id },
      relations: OrdersService.ORDER_RELATIONS,
    });
    const [orderWithAssignment] = await this.attachDeliveryAssignmentIds([
      order,
    ]);

    if (surveyRequirement) {
      try {
        const surveyReq = surveyRequirement;
        // Real-time WebSocket push — client refreshes accountState instantly
        try {
          this.ordersGateway.notifySurveyRequired(order.userId, {
            requirementId: surveyReq.id,
            orderId: order.id,
            orderRef: order.orderId,
          });
        } catch (wsErr) {
          this.logger.warn(
            `survey-required WS emit failed for user ${order.userId}: ${wsErr}`,
          );
        }

        // In-app notification (best-effort)
        try {
          await this.notificationsService.create({
            userId: order.userId,
            title: 'Order delivered — share your feedback',
            message:
              'Your order has been delivered. Please complete a quick survey to continue.',
            type: 'survey_required',
            orderRef: order.orderId,
            metadata: {
              orderId: order.id,
              requirementId: surveyReq.id,
            },
          });
        } catch (notifErr) {
          this.logger.warn(
            `survey_required in-app notification failed for order ${order.orderId}: ${notifErr}`,
          );
        }

        // FCM push (best-effort — no token = skip)
        try {
          const fcmToken = await this.usersService.getFcmToken(order.userId);
          if (fcmToken) {
            await this.firebaseService.sendToDevice(
              fcmToken,
              'Order delivered — share your feedback',
              'Your order has been delivered. Please complete a quick survey to continue.',
              {
                type: 'survey_required',
                orderId: String(order.id),
                requirementId: String(surveyReq.id),
              },
            );
          }
        } catch (fcmErr) {
          this.logger.warn(
            `survey_required FCM push failed for order ${order.orderId}: ${fcmErr}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Post-delivery survey publication failed for order ${order.orderId}: ${err}`,
        );
      }
    }

    // Status → notification copy (shared by FCM push + in-app notification)
    const messages: Record<string, { title: string; body: string }> = {
      submitted: {
        title: 'Order Submitted',
        body: `Your order ${order.orderId} was submitted.`,
      },
      needs_qa: {
        title: 'In Quality Review',
        body: `Your order ${order.orderId} is being reviewed by our quality team.`,
      },
      client_correction: {
        title: 'Correction Needed',
        body: `Your order ${order.orderId} needs a file correction. Please upload a revised file.`,
      },
      proof_approval: {
        title: 'Proof Ready',
        body: `A proof for order ${order.orderId} is ready for your approval.`,
      },
      approved_for_matching: {
        title: 'Approved for Matching',
        body: `Your order ${order.orderId} is approved and waiting for a supplier.`,
      },
      supplier_assigned: {
        title: 'Supplier Assigned',
        body: `A supplier has been assigned to order ${order.orderId}.`,
      },
      supplier_accepted: {
        title: 'Supplier Accepted',
        body: `A supplier accepted order ${order.orderId}.`,
      },
      awaiting_payment: {
        title: 'Awaiting Payment',
        body: `Payment authorization is needed for order ${order.orderId}.`,
      },
      payment_authorized: {
        title: 'Payment Authorized',
        body: `Payment for order ${order.orderId} is authorized. Production can begin.`,
      },
      production: {
        title: 'Printing Started',
        body: `Your order ${order.orderId} is being printed.`,
      },
      supplier_self_qc: {
        title: 'Quality Check',
        body: `Your order ${order.orderId} is in supplier quality check.`,
      },
      file_rejected: {
        title: 'File Rejected',
        body: `Your order ${order.orderId} file was rejected. Please review the details and upload a replacement.`,
      },
      ready_for_dispatch: {
        title: 'Ready for Dispatch',
        body: `Your order ${order.orderId} is ready.`,
      },
      rider_assigned: {
        title: 'Rider Assigned',
        body: `A rider has been assigned to your order ${order.orderId}.`,
      },
      picked_up: {
        title: 'Picked Up',
        body: `Your order ${order.orderId} has been picked up.`,
      },
      out_for_delivery: {
        title: 'Out for Delivery',
        body: `Your order ${order.orderId} is out for delivery!`,
      },
      delivered: {
        title: 'Order Delivered',
        body: `Your order ${order.orderId} was delivered. You have 24 hours to report a concern if there are any print or delivery issues.`,
      },
      collected_by_customer: {
        title: 'Order Collected',
        body: `Your order ${order.orderId} was collected. You have 24 hours to report a concern if there are any print or delivery issues.`,
      },
      issue_window_open: {
        title: 'Report a Concern Available',
        body: `Please check order ${order.orderId}. You can report a concern within 24 hours if there are any print, damage, or delivery issues. Open the order and tap Report a Concern.`,
      },
      completed: {
        title: 'Order Completed',
        body: `Your order ${order.orderId} is complete.`,
      },
      cancelled: {
        title: 'Order Cancelled',
        body: `Your order ${order.orderId} has been cancelled.`,
      },
    };
    const statusMsg = messages[status];

    // Fetch dynamic rider info to pass into notification metadata
    const dynamicMetadata: Record<string, unknown> = {
      orderId: order.id,
      toStatus: status,
    };
    if (order.assignedRiderId) {
      try {
        const riderUser = await this.usersService.findById(
          order.assignedRiderId,
        );
        if (riderUser) {
          dynamicMetadata.driverName =
            riderUser.fullName || riderUser.nickname || 'GRIDGO Rider';
        }
        const profiles = await this.dataSource.query<RiderProfileMetadataRow[]>(
          `SELECT vehicle_type, plate_number FROM rider_profiles WHERE user_id = $1 LIMIT 1`,
          [order.assignedRiderId],
        );
        if (profiles.length > 0) {
          dynamicMetadata.vehicleType = profiles[0].vehicle_type;
          dynamicMetadata.plateNumber = profiles[0].plate_number;
        }
      } catch (e) {
        this.logger.warn(
          `Failed to fetch rider metadata for notification: ${e}`,
        );
      }
    }

    // Send push notification to order owner
    try {
      const fcmToken = await this.usersService.getFcmToken(existing.userId);
      if (fcmToken && statusMsg) {
        const progressByStatus: Partial<Record<OrderStatus, string>> = {
          [OrderStatus.SUBMITTED]: '1',
          [OrderStatus.NEEDS_QA]: '1',
          [OrderStatus.APPROVED_FOR_MATCHING]: '2',
          [OrderStatus.PAYMENT_AUTHORIZED]: '2',
          [OrderStatus.PRODUCTION]: '2',
          [OrderStatus.SUPPLIER_SELF_QC]: '3',
          [OrderStatus.READY_FOR_DISPATCH]: '3',
          [OrderStatus.RIDER_ASSIGNED]: '3',
          [OrderStatus.PICKED_UP]: '4',
          [OrderStatus.OUT_FOR_DELIVERY]: '4',
          [OrderStatus.DELIVERED]: '5',
          [OrderStatus.COLLECTED_BY_CUSTOMER]: '5',
        };
        const progressCurrent = progressByStatus[orderStatus];
        const pushData = Object.fromEntries(
          Object.entries({
            orderId: order.orderId,
            status,
            ...dynamicMetadata,
          })
            .filter(([, value]) => value != null)
            .map(([key, value]) => [key, String(value)]),
        );
        await this.firebaseService.sendToDevice(
          fcmToken,
          statusMsg.title,
          statusMsg.body,
          {
            ...pushData,
            type: 'delivery_status',
            ...(progressCurrent === undefined
              ? {}
              : { progressCurrent, progressTotal: '5' }),
          },
          { dataOnly: true },
        );
      }
    } catch (err) {
      this.logger.warn(`Customer FCM push failed for status ${status}: ${err}`);
    }

    // Emit WebSocket order update
    try {
      await Promise.resolve(
        this.ordersGateway.notifyOrderUpdate(
          orderWithAssignment.orderId,
          orderWithAssignment,
        ),
      );
    } catch (err) {
      this.logger.warn(`Customer order WS update failed: ${err}`);
    }

    // Create in-app notification for the customer (also emitted via WS)
    if (statusMsg) {
      try {
        await this.notificationsService.create({
          userId: order.userId,
          title: statusMsg.title,
          message: statusMsg.body,
          type: `order_${status}`,
          orderRef: order.orderId,
          metadata: dynamicMetadata,
        });
      } catch (err) {
        this.logger.warn(
          `Customer notification failed for status ${status}: ${err}`,
        );
      }
    }

    // Slot count changed for the affected date — broadcast so admin Today's
    // Slots refreshes in real time. Only relevant when the order has a
    // slotted batch and the new status is terminal (cancelled / declined).
    if (
      (orderStatus === OrderStatus.CANCELLED ||
        orderStatus === OrderStatus.FILE_REJECTED) &&
      order.batchOrderId != null
    ) {
      try {
        const batch = await this.batchOrdersRepo.findOne({
          where: { id: order.batchOrderId },
        });
        if (batch?.slotBookingId != null) {
          const booking = await this.dataSource
            .getRepository(DeliverySlotBooking)
            .findOne({ where: { id: batch.slotBookingId } });
          if (booking?.date) this.slotsGateway.notifyDateChanged(booking.date);
        }
      } catch (err) {
        this.logger.warn(`Slot WS broadcast on cancel failed: ${err}`);
      }
    }

    // Notify admins of cancellation / decline
    if (
      orderStatus === OrderStatus.CANCELLED ||
      orderStatus === OrderStatus.FILE_REJECTED
    ) {
      const type =
        orderStatus === OrderStatus.CANCELLED
          ? 'order_cancelled'
          : 'order_declined';
      try {
        await this.notificationsService.createForAllAdmins({
          title:
            orderStatus === OrderStatus.CANCELLED
              ? 'Order Cancelled'
              : 'Order Declined',
          message: `Order ${order.orderId} was ${orderStatus === OrderStatus.CANCELLED ? 'cancelled' : 'declined'}.`,
          type,
          orderRef: order.orderId,
          metadata: { orderId: order.id, toStatus: status },
        });
      } catch (err) {
        this.logger.warn(
          `Admin notification failed for status ${status}: ${err}`,
        );
      }
    }

    return orderWithAssignment;
  }
}
