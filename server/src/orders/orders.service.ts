import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  BETA_ORDER_LIMIT_MESSAGE,
  BETA_ORDER_LIMIT_REACHED,
} from './dto/beta-order-limit.error';
import { Order, OrderStatus } from './entities/order.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemSpecValue } from './entities/order-item-spec-value.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../riders/entities/delivery-assignment.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import {
  CreateBatchOrderDto,
  TemporaryDeliveryAddressDto,
} from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { DeliverySpeedTier } from './enums/delivery-speed-tier.enum';
import { UpdateManualStatusDto } from './dto/update-manual-status.dto';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsService } from '../delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../delivery-slots/delivery-slots.gateway';
import { DeliverySlotBooking } from '../delivery-slots/entities/delivery-slot-booking.entity';
import { SlotFullException } from '../delivery-slots/exceptions';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
import { CatalogPricingService } from '../products/catalog-pricing.service';

// Slot definitions live in operator-local time (Asia/Manila, UTC+8). The API
// server may run in UTC, so we never use server-local Date#getHours/setHours
// for slot math — we compute against PH wall-clock directly from the UTC clock.
const PH_OFFSET_MINUTES = 8 * 60;
const AUTO_SLOT_SEARCH_DAYS = 14;

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
  bookingId: number;
};

type CreateBatchResult = {
  batchId: string;
  orders: Order[];
  assignedSlot?: AssignedSlot;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private static readonly ORDER_RELATIONS = [
    'batchOrder',
    'destination',
    'items',
    'items.destination',
    'items.specValues',
  ];

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemSpecValue)
    private orderItemSpecValueRepo: Repository<OrderItemSpecValue>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentRepo: Repository<DeliveryAssignment>,
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
  ) {}

  async findByUser(userId: number): Promise<Order[]> {
    const orders = await this.ordersRepo.find({
      where: { userId },
      relations: OrdersService.ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return this.attachDeliveryAssignmentIds(orders);
  }

  async findById(id: number): Promise<Order | null> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: OrdersService.ORDER_RELATIONS,
    });
    if (!order) return null;
    const [withTracking] = await this.attachDeliveryAssignmentIds([order]);
    return withTracking;
  }

  private async attachDeliveryAssignmentIds(orders: Order[]): Promise<Order[]> {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    if (orderIds.length === 0) return orders;

    const assignments = await this.deliveryAssignmentRepo.find({
      where: {
        orderId: In(orderIds),
        status: In([
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.ACCEPTED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.ON_THE_WAY,
          DeliveryStatus.ARRIVED,
        ]),
      },
    });

    const assignmentByOrderId = new Map<number, DeliveryAssignment>();
    for (const assignment of assignments) {
      if (!assignmentByOrderId.has(assignment.orderId)) {
        assignmentByOrderId.set(assignment.orderId, assignment);
      }
    }

    return orders.map((order) =>
      Object.assign(order, {
        deliveryAssignmentId: assignmentByOrderId.get(order.id)?.id ?? null,
      }),
    );
  }

  async assertBetaOrderLimit(userId: number): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.isBetaUser || !user.betaEnrolledAt) return;

    const count = await this.ordersRepo.count({
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
    if (data.userId != null) {
      await this.assertBetaOrderLimit(Number(data.userId));
    }
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

    const selectedSpecs = this.selectedSpecsFromLegacy({
      category: String(orderData.category ?? ''),
      specs,
      paperSpecs,
      threeDSpecs,
    });
    const quote = await this.catalogPricingService.quote({
      items: [
        {
          categorySlug: String(orderData.category ?? ''),
          quantity: Number(orderData.quantity ?? 1),
          specs: selectedSpecs,
          addonIds: addonIds ?? [],
        },
      ],
      deliveryOption: orderData.deliveryOption,
    });
    const quoteItem = quote.items[0];
    orderData.totalPrice = quote.subtotal;
    orderData.category = quoteItem.categorySlug;

    // Validate and deduct credits if payment method is credits
    if (
      OrdersService.isCreditPaymentMethod(orderData.paymentMethod) &&
      Number(orderData.totalPrice ?? 0) + Number(orderData.deliveryFee ?? 0) > 0
    ) {
      if (!orderData.userId) {
        throw new Error('User ID is required to process credit payment');
      }

      const userId = orderData.userId;
      const amountCredits =
        Number(orderData.totalPrice ?? 0) + Number(orderData.deliveryFee ?? 0);

      // Attempt subtraction, will throw BadRequestException if insufficient
      await this.creditsService.subtractCredits(
        userId,
        amountCredits,
        'order_placed',
      );
    }

    const count = await this.ordersRepo.count();
    const orderId = `ORD-${(10001 + count).toString().padStart(5, '0')}`;
    const order = this.ordersRepo.create({ ...orderData, orderId });
    const savedOrder = await this.ordersRepo.save(order);
    const savedItem = await this.orderItemsRepo.save(
      this.orderItemsRepo.create({
        orderId: savedOrder.id,
        category: savedOrder.category,
        quantity: savedOrder.quantity,
        totalPrice: savedOrder.totalPrice,
        fileName: savedOrder.fileName,
        fileUrl: savedOrder.fileUrl,
        fileMetadataId: savedOrder.fileMetadataId,
        specialInstructions:
          this.normalizeSpecialInstructions(specialInstructions),
        categoryId: quoteItem.categoryId,
        categorySlug: quoteItem.categorySlug,
        categoryName: quoteItem.categoryName,
        pricingModel: quoteItem.pricingModel,
      }),
    );

    for (const snapshot of quoteItem.specSnapshots) {
      await this.orderItemSpecValueRepo.save(
        this.orderItemSpecValueRepo.create({
          orderItemId: savedItem.id,
          ...snapshot,
        }),
      );
    }

    await this.notifyOrderPlaced(savedOrder);

    return savedOrder;
  }

  quote(dto: QuoteOrderDto) {
    return this.catalogPricingService.quote(dto);
  }

  async createBatch(
    userId: number,
    dto: CreateBatchOrderDto,
  ): Promise<CreateBatchResult> {
    await this.assertBetaOrderLimit(userId);
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

    const quote = await this.catalogPricingService.quote({
      items: normalizedItems.map((item) => ({
        categorySlug: item.category,
        quantity: item.quantity,
        specs: this.selectedSpecsFromLegacy(item),
        addonIds: item.addonIds ?? [],
      })),
      deliveryOption: dto.deliveryOption,
      speedTier: dto.speedTier,
    });
    const subtotal = quote.subtotal;
    const deliveryFee = Number(dto.deliveryFee ?? 0);
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

    for (const dest of resolvedDestinations) {
      const inside = await this.settingsService.isInsideServiceArea(
        dest.latitude,
        dest.longitude,
      );
      if (!inside) {
        deliveryType = 'external';
        break;
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
    const totalPrice =
      subtotal + deliveryFee + priorityFee + extraDestinationFee;

    // --- 3D bounds enforcement ---
    const profile = await this.printerProfileService.getProfile();
    for (const item of normalizedItems) {
      if (item.category !== '3d') continue;
      if (item.fileMetadataId == null) continue;
      const meta = await this.fileMetadataRepo.findOneOrFail({
        where: { id: item.fileMetadataId },
      });
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

      const batchCount = await batchOrdersRepo.count();
      const batchRef = `BATCH-${(10001 + batchCount).toString().padStart(5, '0')}`;
      const batch = batchOrdersRepo.create({
        batchRef,
        userId,
        subtotal,
        deliveryFee,
        totalPrice,
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus ?? 'pending',
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

      const orderCount = await txOrdersRepo.count();
      const orderId = `ORD-${(10001 + orderCount).toString().padStart(5, '0')}`;
      const firstItem = normalizedItems[0];
      // For the aggregate order, wire it to the first item's destination (if any)
      const firstDestId =
        savedDestinations[normalizedItems[0]?.destinationIndex ?? 0]?.id ??
        null;
      const aggregateOrder = txOrdersRepo.create({
        userId,
        orderId,
        category: normalizedItems.length > 1 ? 'batch' : firstItem.category,
        quantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: subtotal,
        deliveryFee,
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus ?? 'pending',
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
      } as Partial<Order>);
      const savedOrder = await txOrdersRepo.save(aggregateOrder);

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

      if (
        OrdersService.isCreditPaymentMethod(dto.paymentMethod) &&
        totalPrice > 0
      ) {
        await this.creditsService.subtractCredits(
          userId,
          totalPrice,
          'order_placed',
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
      };
    });

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
    OrderStatus.ORDER_PLACED,
    OrderStatus.FILE_VERIFIED,
  ];

  private static isCreditPaymentMethod(paymentMethod?: string): boolean {
    const normalized = paymentMethod?.replace(/[_-]/g, '').toLowerCase();
    return normalized === 'credits' || normalized === 'gridcredits';
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
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
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
          body: dto.note ?? '',
          message: dto.note ?? '',
          type: 'order_admin_status',
          orderRef: order.orderId,
          metadata: { orderId: order.id },
        } as any);
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
    await this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneOrFail(BatchOrder, {
        where: { id: batchOrderId, userId },
      });
      if (batch.slotBookingId) {
        await this.slotsService.releaseSlot(manager, batch.slotBookingId);
        batch.slotBookingId = null;
        await manager.save(batch);
      }
      await manager.update(
        Order,
        { batchOrderId: batch.id },
        { orderStatus: OrderStatus.CANCELLED },
      );
    });
  }

  async cancelOrder(id: number, userId: number): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id },
      relations: OrdersService.ORDER_RELATIONS,
    });
    if (order.userId !== userId) {
      throw new Error('Forbidden');
    }
    if (!OrdersService.CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      throw new Error('Order cannot be cancelled at this stage');
    }

    if (
      OrdersService.isCreditPaymentMethod(order.paymentMethod) &&
      Number(order.totalPrice) + Number(order.deliveryFee ?? 0) > 0
    ) {
      const refundAmount =
        Number(order.totalPrice) + Number(order.deliveryFee ?? 0);
      await this.creditsService.refundCredits(
        order.userId,
        refundAmount,
        order.orderId,
      );
      return this.updateStatus(id, 'cancelled', { paymentStatus: 'refunded' });
    }

    return this.updateStatus(id, 'cancelled');
  }

  async updateStatus(
    id: number,
    status: string,
    updates: Partial<Order> = {},
  ): Promise<Order> {
    const orderStatus = status as OrderStatus;
    const existing = await this.ordersRepo.findOneOrFail({ where: { id } });

    await this.ordersRepo.update(id, {
      orderStatus,
      ...updates,
    });
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });

    // Stamp file expiry when order reaches either terminal completion status
    if (
      (orderStatus === OrderStatus.COMPLETED_PICKUP ||
        orderStatus === OrderStatus.DELIVERED) &&
      order.fileMetadataId != null
    ) {
      const owner = await this.usersService.findById(order.userId);
      if (owner?.fileRetentionDays != null) {
        await this.filesService.stampExpiry(
          order.fileMetadataId,
          owner.fileRetentionDays,
        );
      }
    }

    if (
      orderStatus === OrderStatus.DELIVERED ||
      orderStatus === OrderStatus.COMPLETED_PICKUP
    ) {
      try {
        const surveyReq =
          await this.tamSurveysService.createPostDeliveryRequirementIfNeeded(
            order,
          );
        if (surveyReq) {
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
        }
      } catch (err) {
        this.logger.warn(
          `Post-delivery survey requirement failed for order ${order.orderId}: ${err}`,
        );
      }
    }

    // Status → notification copy (shared by FCM push + in-app notification)
    const messages: Record<string, { title: string; body: string }> = {
      file_verified: {
        title: 'File Verified',
        body: `Your order ${order.orderId} file has been verified.`,
      },
      printing_in_progress: {
        title: 'Printing Started',
        body: `Your order ${order.orderId} is being printed.`,
      },
      quality_checked: {
        title: 'Quality Checked',
        body: `Your order ${order.orderId} passed quality check.`,
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
      on_the_way: {
        title: 'On The Way',
        body: `Your order ${order.orderId} is on the way!`,
      },
      arrived_at_destination: {
        title: 'Rider Arrived',
        body: `Your delivery for ${order.orderId} has arrived!`,
      },
      delivered: {
        title: 'Delivered',
        body: `Your order ${order.orderId} has been delivered. Thank you!`,
      },
      cancelled: {
        title: 'Order Cancelled',
        body: `Your order ${order.orderId} has been cancelled.`,
      },
    };
    const statusMsg = messages[status];

    // Send push notification to order owner
    const fcmToken = await this.usersService.getFcmToken(existing.userId);
    if (fcmToken && statusMsg) {
      await this.firebaseService.sendToDevice(
        fcmToken,
        statusMsg.title,
        statusMsg.body,
        {
          orderId: order.orderId,
          status: status,
        },
      );
    }

    // Emit WebSocket order update
    void this.ordersGateway.notifyOrderUpdate(order.orderId, order);

    // Create in-app notification for the customer (also emitted via WS)
    if (statusMsg) {
      try {
        await this.notificationsService.create({
          userId: order.userId,
          title: statusMsg.title,
          message: statusMsg.body,
          type: `order_${status}`,
          orderRef: order.orderId,
          metadata: { orderId: order.id, toStatus: status },
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
        orderStatus === OrderStatus.FILE_DECLINED) &&
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
      orderStatus === OrderStatus.FILE_DECLINED
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

    return order;
  }
}
