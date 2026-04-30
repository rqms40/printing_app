import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from '../files/files.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../drivers/entities/delivery-assignment.entity';
import { Address } from '../addresses/entities/address.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import { DeliverySlotsService } from '../delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../delivery-slots/delivery-slots.gateway';
import { CancellationClosedException } from '../delivery-slots/exceptions';
import { BatchOrder } from './entities/batch-order.entity';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { FileMetadata } from '../files/entities/file-metadata.entity';

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: jest.Mocked<Partial<Repository<Order>>>;
  let orderItemsRepo: jest.Mocked<Partial<Repository<OrderItem>>>;
  let batchRepo: jest.Mocked<Partial<Repository<any>>>;
  let paperSpecsRepo: jest.Mocked<Partial<Repository<PaperSpec>>>;
  let threeDSpecsRepo: jest.Mocked<Partial<Repository<ThreeDSpec>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let addressRepo: jest.Mocked<Partial<Repository<Address>>>;
  let dataSource: Partial<DataSource>;
  let gateway: Partial<OrdersGateway>;
  let firebaseService: Partial<FirebaseService>;
  let usersService: Partial<UsersService>;
  let creditsService: Partial<CreditsService>;
  let notificationsService: Partial<NotificationsService>;

  const mockOrder = {
    id: 1,
    orderId: 'ORD-10001',
    userId: 1,
    orderStatus: 'pending',
    createdAt: new Date(),
  } as Order;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    orderItemsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    batchRepo = {
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };
    paperSpecsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    threeDSpecsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    assignmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    addressRepo = {
      findOne: jest.fn(),
    };
    addressRepo.findOne.mockResolvedValue({ id: 9, userId: 1 } as Address);
    gateway = {
      notifyOrderUpdate: jest.fn(),
    };
    firebaseService = {
      sendToDevice: jest.fn().mockResolvedValue('msg-id'),
      sendToMultiple: jest.fn().mockResolvedValue(undefined),
      isAvailable: true,
    };
    usersService = {
      getFcmToken: jest.fn().mockResolvedValue(null),
    };
    creditsService = {
      subtractCredits: jest.fn().mockResolvedValue(undefined),
      refundCredits: jest.fn().mockResolvedValue(undefined),
    };
    notificationsService = {
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };
    orderItemsRepo.create.mockImplementation((data) => data as OrderItem);
    orderItemsRepo.save.mockImplementation(
      async (item) =>
        ({
          id: 1,
          ...item,
        }) as OrderItem,
    );
    dataSource = {
      transaction: jest.fn(async (runInTransaction) =>
        runInTransaction({
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return repo;
            if (entity?.name === 'OrderItem') return orderItemsRepo;
            if (entity?.name === 'PaperSpec') return paperSpecsRepo;
            if (entity?.name === 'ThreeDSpec') return threeDSpecsRepo;
            if (entity?.name === 'BatchOrder') return batchRepo;
            if (entity?.name === 'DeliveryDestination')
              return { create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 1, ...d })) };
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: repo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        { provide: getRepositoryToken(BatchOrder), useValue: batchRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: paperSpecsRepo },
        { provide: getRepositoryToken(ThreeDSpec), useValue: threeDSpecsRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 1, ...d })) },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOneOrFail: jest.fn().mockResolvedValue({ model3dWidthMm: null }) },
        },
        { provide: OrdersGateway, useValue: gateway },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: UsersService, useValue: usersService },
        { provide: CreditsService, useValue: creditsService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn().mockResolvedValue({ id: 1 }),
            getAvailability: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('should generate orderId, save order', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      const data = { userId: 1, orderStatus: 'pending' } as Partial<Order>;
      const result = await service.create(data);

      expect(repo.count).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ORD-10001' }),
      );
      expect(repo.save).toHaveBeenCalledWith(mockOrder);
      expect(result).toEqual(mockOrder);
    });

    it('should generate correct orderId based on count', async () => {
      repo.count.mockResolvedValue(42);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({ userId: 1 } as Partial<Order>);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ORD-10043' }),
      );
    });

    it('fires createForAllAdmins with order_placed type after saving', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({ userId: 1 } as Partial<Order>);

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_placed',
          orderRef: mockOrder.orderId,
        }),
      );
    });

    it('deducts GRID Credits using print subtotal plus delivery fee', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({
        userId: 1,
        paymentMethod: 'gridCredits',
        totalPrice: 250,
        deliveryFee: 30,
      } as Partial<Order>);

      expect(creditsService.subtractCredits).toHaveBeenCalledWith(
        1,
        280,
        'order_placed',
      );
    });
  });

  describe('createBatch', () => {
    const batchDto = {
      deliveryFee: 45,
      paymentMethod: 'gridCredits',
      paymentStatus: 'paid',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      items: [
        {
          category: 'paper',
          quantity: 2,
          totalPrice: 120,
          fileName: 'deck.pdf',
          fileUrl: 'https://files/deck.pdf',
          fileMetadataId: 11,
          paperSpecs: {
            paperSize: 'A4',
            colorMode: 'color',
            mediaType: 'bond',
            printSides: 'single',
          },
        },
        {
          category: '3d',
          quantity: 1,
          totalPrice: 300,
          fileName: 'part.stl',
          fileUrl: 'https://files/part.stl',
          fileMetadataId: 12,
          threeDSpecs: {
            fileFormat: 'stl',
            material: 'pla',
            color: 'black',
            infillPercentage: 20,
            layerHeight: 0.2,
            supports: false,
          },
        },
      ],
    };

    beforeEach(() => {
      repo.count.mockResolvedValue(0);
      batchRepo.count.mockResolvedValue(0);
      batchRepo.create.mockImplementation((data) => ({
        id: 77,
        batchRef: 'BATCH-10001',
        ...data,
      }));
      batchRepo.save.mockImplementation(async (batch) => batch);

      let savedOrderId = 0;
      repo.create.mockImplementation((data) => data as Order);
      repo.save.mockImplementation(async (order) => ({
        id: ++savedOrderId,
        ...order,
      }));
      repo.findOneOrFail.mockImplementation(
        async ({ where }: any) =>
          ({
            id: where.id,
            orderId: 'ORD-10001',
            category: 'batch',
            items: [{ id: 1 }, { id: 2 }],
          }) as Order,
      );
      let savedItemId = 0;
      orderItemsRepo.create.mockImplementation((data) => data as OrderItem);
      orderItemsRepo.save.mockImplementation(
        async (item) =>
          ({
            id: ++savedItemId,
            ...item,
          }) as OrderItem,
      );
      paperSpecsRepo.create.mockImplementation((data) => data as PaperSpec);
      paperSpecsRepo.save.mockResolvedValue({} as PaperSpec);
      threeDSpecsRepo.create.mockImplementation((data) => data as ThreeDSpec);
      threeDSpecsRepo.save.mockResolvedValue({} as ThreeDSpec);
    });

    it('rejects an empty item list', async () => {
      await expect(
        (service as any).createBatch(1, { ...batchDto, items: [] }),
      ).rejects.toThrow('Batch order requires at least one item');
    });

    it('rejects delivery addresses that do not belong to the user', async () => {
      addressRepo.findOne.mockResolvedValueOnce(null);

      await expect((service as any).createBatch(1, batchDto)).rejects.toThrow(
        'Invalid delivery address',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('saves one BatchOrder, one aggregate Order, and two OrderItem records', async () => {
      const result = await (service as any).createBatch(1, batchDto);

      // Two saves: initial creation, then updating deliveryType/fees fields
      expect(batchRepo.save).toHaveBeenCalledTimes(2);
      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          subtotal: 420,
          deliveryFee: 45,
          totalPrice: 465,
          paymentMethod: 'gridCredits',
          paymentStatus: 'paid',
          deliveryOption: 'delivery',
          deliveryAddressId: 9,
        }),
      );
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          batchOrderId: 77,
          category: 'batch',
          userId: 1,
          totalPrice: 420,
          deliveryFee: 45,
        }),
      );
      expect(orderItemsRepo.save).toHaveBeenCalledTimes(2);
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          category: 'paper',
        }),
      );
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          category: '3d',
        }),
      );
      expect(result).toEqual({
        batchId: 'BATCH-10001',
        orders: [expect.objectContaining({ id: 1, category: 'batch' })],
      });
    });

    it('allocates shared deliveryFee to the aggregate order only', async () => {
      await (service as any).createBatch(1, batchDto);

      expect(repo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ deliveryFee: 45 }),
      );
    });

    it('deducts GRID Credits once for subtotal plus deliveryFee', async () => {
      await (service as any).createBatch(1, batchDto);

      expect(creditsService.subtractCredits).toHaveBeenCalledTimes(1);
      expect(creditsService.subtractCredits).toHaveBeenCalledWith(
        1,
        465,
        'order_placed',
      );
    });

    it('normalizes numeric strings before creating batch order rows', async () => {
      await (service as any).createBatch(1, {
        ...batchDto,
        deliveryFee: '45',
        deliveryAddressId: '9',
        items: [
          {
            ...batchDto.items[1],
            quantity: '2',
            totalPrice: '300.50',
            fileMetadataId: '12',
            threeDSpecs: {
              ...batchDto.items[1].threeDSpecs,
              infillPercentage: '20',
              layerHeight: '0.20',
            },
          },
        ],
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          totalPrice: 300.5,
          deliveryFee: 45,
          deliveryAddressId: 9,
        }),
      );
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          totalPrice: 300.5,
          fileMetadataId: 12,
        }),
      );
      expect(threeDSpecsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          infillPercentage: 20,
          layerHeight: 0.2,
        }),
      );
    });
  });

  describe('findByUser', () => {
    it('should return orders for given userId sorted by createdAt DESC', async () => {
      const orders = [mockOrder];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findByUser(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: [
          'batchOrder',
          'items',
          'items.paperSpec',
          'items.threeDSpec',
        ],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(orders);
    });

    it('attaches active deliveryAssignmentId for live tracking subscription', async () => {
      const orders = [{ ...mockOrder, id: 12 }] as Order[];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([
        {
          id: 99,
          orderId: 12,
          status: DeliveryStatus.ON_THE_WAY,
        } as DeliveryAssignment,
      ]);

      const result = await service.findByUser(1);

      expect(assignmentRepo.find).toHaveBeenCalledWith({
        where: {
          orderId: expect.any(Object),
          status: expect.any(Object),
        },
      });
      expect(
        (result[0] as Order & { deliveryAssignmentId?: number })
          .deliveryAssignmentId,
      ).toBe(99);
    });
  });

  describe('findById', () => {
    it('should return order', async () => {
      repo.findOne.mockResolvedValue(mockOrder);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: [
          'batchOrder',
          'items',
          'items.paperSpec',
          'items.threeDSpec',
        ],
      });
      expect(result).toEqual(mockOrder);
    });
  });

  describe('updateStatus', () => {
    it('should update status and emit WebSocket event', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(mockOrder);

      const result = await service.updateStatus(1, 'printing');

      expect(repo.update).toHaveBeenCalledWith(1, { orderStatus: 'printing' });
      expect(gateway.notifyOrderUpdate).toHaveBeenCalledWith(
        mockOrder.orderId,
        mockOrder,
      );
      expect(result).toEqual(mockOrder);
    });
  });

  describe('updateStatus notifications', () => {
    it('notifies admins when status becomes cancelled', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(mockOrder);

      await service.updateStatus(1, 'cancelled');

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_cancelled',
          orderRef: mockOrder.orderId,
        }),
      );
    });

    it('notifies admins when status becomes file_declined', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(mockOrder);

      await service.updateStatus(1, 'file_declined');

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_declined',
          orderRef: mockOrder.orderId,
        }),
      );
    });

    it('does NOT call createForAllAdmins for other statuses', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(mockOrder);

      await service.updateStatus(1, 'printing_in_progress');

      expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('refunds GRID Credits before cancelling an eligible credit-paid order', async () => {
      const creditOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        deliveryFee: 30,
        paymentMethod: 'gridCredits',
        orderStatus: OrderStatus.ORDER_PLACED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(creditOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        creditOrder.userId,
        Number(creditOrder.totalPrice) + Number(creditOrder.deliveryFee),
        creditOrder.orderId,
      );
      expect(repo.update).toHaveBeenCalledWith(1, {
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: 'refunded',
      });
    });

    it('refunds GRID Credits when the stored payment method is snake_case', async () => {
      const creditOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        paymentMethod: 'grid_credits',
        orderStatus: OrderStatus.FILE_VERIFIED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(creditOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        creditOrder.userId,
        Number(creditOrder.totalPrice),
        creditOrder.orderId,
      );
    });

    it('does not refund credits for non-credit payment methods', async () => {
      const gcashOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        paymentMethod: 'gcash',
        orderStatus: OrderStatus.ORDER_PLACED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(gcashOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).not.toHaveBeenCalled();
    });
  });
});

describe('OrdersService.updateStatus — expiresAt stamping', () => {
  let service: OrdersService;
  const ordersRepo = {
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockFilesService = { stampExpiry: jest.fn() };
  const mockUsersService = { findById: jest.fn(), getFcmToken: jest.fn() };
  const mockGateway = { notifyOrderUpdate: jest.fn() };
  const mockFirebase = { sendToDevice: jest.fn() };
  const mockCredits = {
    subtractCredits: jest.fn(),
    refundCredits: jest.fn(),
  };
  const mockNotifications = {
    create: jest.fn(),
    createForAllAdmins: jest.fn(),
  };

  const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 1,
      orderId: 'ORD-10001',
      userId: 99,
      fileMetadataId: 5,
      orderStatus: OrderStatus.COMPLETED_PICKUP,
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: { findOne: jest.fn() },
        },
        { provide: OrdersGateway, useValue: mockGateway },
        { provide: FirebaseService, useValue: mockFirebase },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CreditsService, useValue: mockCredits },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: FilesService, useValue: mockFilesService },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOneOrFail: jest.fn() },
        },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn().mockResolvedValue({ id: 1 }),
            getAvailability: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('stamps expiresAt when completed_pickup and retention is set', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(order) // existing (before update)
      .mockResolvedValueOnce(order); // after update
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).toHaveBeenCalledWith(5, 7);
  });

  it('does not stamp when user fileRetentionDays is null', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp when order has no fileMetadataId', async () => {
    const order = makeOrder({ fileMetadataId: null });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp for non-completion statuses', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.FILE_VERIFIED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'file_verified');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('stamps expiresAt when delivered and retention is set', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'delivered');

    expect(mockFilesService.stampExpiry).toHaveBeenCalledWith(5, 7);
  });
});

describe('createBatch with slot + destinations', () => {
  let service: OrdersService;

  // Repos
  let batchRepo: jest.Mocked<Partial<Repository<any>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let orderItemsRepo: jest.Mocked<Partial<Repository<OrderItem>>>;
  let paperSpecsRepo: jest.Mocked<Partial<Repository<PaperSpec>>>;
  let threeDSpecsRepo: jest.Mocked<Partial<Repository<ThreeDSpec>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let addressRepo: jest.Mocked<Partial<Repository<Address>>>;
  let destinationRepo: jest.Mocked<Partial<Repository<DeliveryDestination>>>;

  // Services / gateway
  let slotsService: jest.Mocked<Partial<DeliverySlotsService>>;
  let settingsService: jest.Mocked<Partial<DeliverySettingsService>>;
  let slotsGateway: jest.Mocked<Partial<DeliverySlotsGateway>>;
  let dataSource: Partial<DataSource>;

  // Saved batch reference captured during each test
  let capturedBatch: any;

  const makeItem = (overrides: Record<string, any> = {}) => ({
    category: 'paper',
    quantity: 1,
    totalPrice: 100,
    fileName: 'file.pdf',
    fileUrl: 'https://cdn/file.pdf',
    ...overrides,
  });

  const makeAddress = (id: number, lat: number, lng: number): Address =>
    ({ id, userId: 1, latitude: lat, longitude: lng } as unknown as Address);

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedBatch = null;

    batchRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) => ({
        id: 77,
        batchRef: 'BATCH-10001',
        ...data,
      })),
      save: jest.fn().mockImplementation(async (b) => {
        capturedBatch = { ...b };
        return capturedBatch;
      }),
    };

    ordersRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) => data as Order),
      save: jest.fn().mockImplementation(async (o) => ({ id: 1, ...o })),
      findOneOrFail: jest.fn().mockImplementation(async () => ({
        id: 1,
        orderId: 'ORD-10001',
        category: 'batch',
        items: [],
      })),
    };

    orderItemsRepo = {
      create: jest.fn().mockImplementation((data) => data as OrderItem),
      save: jest.fn().mockImplementation(async (item) => ({ id: 1, ...item })),
    };

    paperSpecsRepo = {
      create: jest.fn().mockImplementation((data) => data as PaperSpec),
      save: jest.fn().mockResolvedValue({} as PaperSpec),
    };

    threeDSpecsRepo = {
      create: jest.fn().mockImplementation((data) => data as ThreeDSpec),
      save: jest.fn().mockResolvedValue({} as ThreeDSpec),
    };

    assignmentRepo = { find: jest.fn().mockResolvedValue([]) };

    addressRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) =>
        makeAddress(where.id, 7.07, 125.61),
      ),
    };

    destinationRepo = {
      create: jest.fn().mockImplementation((data) => data as DeliveryDestination),
      save: jest.fn().mockImplementation(async (d) => ({ id: 200, ...d })),
    };

    slotsService = {
      bookSlot: jest.fn().mockResolvedValue({ id: 99 }),
      getAvailability: jest.fn().mockResolvedValue([]),
    };

    settingsService = {
      isInsideServiceArea: jest.fn().mockResolvedValue(true),
      getSettings: jest.fn().mockResolvedValue({
        priorityFeeAmount: 50,
        extraDestinationSurcharge: 30,
      }),
    };

    slotsGateway = {
      notifySlotUpdated: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb) =>
        cb({
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return ordersRepo;
            if (entity?.name === 'OrderItem') return orderItemsRepo;
            if (entity?.name === 'PaperSpec') return paperSpecsRepo;
            if (entity?.name === 'ThreeDSpec') return threeDSpecsRepo;
            if (entity?.name === 'BatchOrder') return batchRepo;
            if (entity?.name === 'DeliveryDestination') return destinationRepo;
            throw new Error(`Unexpected repo: ${entity?.name}`);
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        { provide: getRepositoryToken(BatchOrder), useValue: batchRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: paperSpecsRepo },
        { provide: getRepositoryToken(ThreeDSpec), useValue: threeDSpecsRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: destinationRepo,
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: { getFcmToken: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: CreditsService,
          useValue: {
            subtractCredits: jest.fn().mockResolvedValue(undefined),
            refundCredits: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { createForAllAdmins: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: DeliverySlotsService, useValue: slotsService },
        { provide: DeliverySettingsService, useValue: settingsService },
        { provide: DeliverySlotsGateway, useValue: slotsGateway },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOneOrFail: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('marks deliveryType=external when any destination is out of radius', async () => {
    // Address 10 inside, address 11 outside
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address; // deliveryAddress validation
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea
      .mockResolvedValueOnce(true)   // destination[0] inside
      .mockResolvedValueOnce(false); // destination[1] outside

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [
        { addressId: 10, label: 'Home' },
        { addressId: 11, label: 'Office' },
      ],
      items: [makeItem({ destinationIndex: 0 }), makeItem({ destinationIndex: 1 })],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.deliveryType).toBe('external');
    expect(capturedBatch.slotBookingId).toBeNull();
    expect(capturedBatch.externalDeliveryStatus).toBe('pending_admin');
    // bookSlot should NOT have been called
    expect(slotsService.bookSlot).not.toHaveBeenCalled();
  });

  it('books a slot when all destinations are inside radius', async () => {
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address;
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea.mockResolvedValue(true);
    slotsService.bookSlot.mockResolvedValue({ id: 99 } as any);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [{ addressId: 10, label: 'Home' }],
      items: [makeItem({ destinationIndex: 0 })],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.deliveryType).toBe('local');
    expect(capturedBatch.slotBookingId).toBe(99);
    expect(slotsService.bookSlot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slotTemplateId: 1, date: '2026-05-01', batchOrderId: 77 }),
    );
  });

  it('computes priorityFee + extraDestinationFee correctly', async () => {
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address;
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea.mockResolvedValue(true);
    settingsService.getSettings.mockResolvedValue({
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
    } as any);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      priority: true,
      destinations: [
        { addressId: 10, label: 'A' },
        { addressId: 11, label: 'B' },
        { addressId: 12, label: 'C' },
      ],
      items: [
        makeItem({ destinationIndex: 0 }),
        makeItem({ destinationIndex: 1 }),
        makeItem({ destinationIndex: 2 }),
      ],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.priorityFee).toBe(50);
    expect(capturedBatch.extraDestinationFee).toBe(60); // 2 extra * 30
  });
});

describe('cancelBatch', () => {
  let service: OrdersService;

  let batchOrdersRepo: jest.Mocked<Pick<Repository<any>, 'findOneOrFail'>>;
  let slotsService: jest.Mocked<Pick<DeliverySlotsService, 'releaseSlot'>>;
  let dataSource: Partial<DataSource>;

  beforeEach(async () => {
    jest.clearAllMocks();

    batchOrdersRepo = {
      findOneOrFail: jest.fn(),
    };

    slotsService = {
      releaseSlot: jest.fn(),
    };

    // Default transaction mock: provides manager with save + update + findOneOrFail routed to batchOrdersRepo
    const makeMockManager = () => ({
      findOneOrFail: jest.fn().mockImplementation(async (_entity: any, opts: any) => {
        return batchOrdersRepo.findOneOrFail(opts);
      }),
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    });

    dataSource = {
      transaction: jest.fn(async (cb) => cb(makeMockManager())),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn(), findOne: jest.fn(), findOneOrFail: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(OrderItem), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        { provide: getRepositoryToken(PaperSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ThreeDSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(DeliveryAssignment), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Address), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(DeliveryDestination), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(FileMetadata), useValue: { findOneOrFail: jest.fn() } },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        { provide: FirebaseService, useValue: { sendToDevice: jest.fn(), isAvailable: false } },
        { provide: UsersService, useValue: { getFcmToken: jest.fn().mockResolvedValue(null) } },
        { provide: CreditsService, useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() } },
        { provide: NotificationsService, useValue: { createForAllAdmins: jest.fn().mockResolvedValue(undefined) } },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: DeliverySlotsService, useValue: slotsService },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({ priorityFeeAmount: 50, extraDestinationSurcharge: 30 }),
          },
        },
        { provide: DeliverySlotsGateway, useValue: { notifySlotUpdated: jest.fn() } },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('releases slot and marks orders cancelled when before cutoff', async () => {
    const fakeBatch = { id: 1, userId: 1, slotBookingId: 7 };
    batchOrdersRepo.findOneOrFail.mockResolvedValue(fakeBatch as any);
    slotsService.releaseSlot.mockResolvedValue(undefined);

    await service.cancelBatch(1, 1);

    expect(slotsService.releaseSlot).toHaveBeenCalledWith(
      expect.anything(),
      7,
    );
  });

  it('rejects cancellation past cutoff', async () => {
    const fakeBatch = { id: 1, userId: 1, slotBookingId: 7 };
    batchOrdersRepo.findOneOrFail.mockResolvedValue(fakeBatch as any);
    slotsService.releaseSlot.mockRejectedValue(new CancellationClosedException());

    await expect(service.cancelBatch(1, 1)).rejects.toThrow('cancellation closed');
  });
});

describe('updateManualStatus', () => {
  let service: OrdersService;
  let ordersRepo: jest.Mocked<Pick<Repository<Order>, 'findOneOrFail' | 'save'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'create' | 'createForAllAdmins'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    ordersRepo = {
      findOneOrFail: jest.fn(),
      save: jest.fn(),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn(), findOne: jest.fn(), findOneOrFail: ordersRepo.findOneOrFail, create: jest.fn(), save: ordersRepo.save, update: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(OrderItem), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        { provide: getRepositoryToken(PaperSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ThreeDSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(DeliveryAssignment), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Address), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(DeliveryDestination), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(FileMetadata), useValue: { findOneOrFail: jest.fn() } },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        { provide: FirebaseService, useValue: { sendToDevice: jest.fn(), isAvailable: false } },
        { provide: UsersService, useValue: { getFcmToken: jest.fn().mockResolvedValue(null) } },
        { provide: CreditsService, useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() } },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: DeliverySlotsService, useValue: { bookSlot: jest.fn(), releaseSlot: jest.fn(), getAvailability: jest.fn().mockResolvedValue([]) } },
        { provide: DeliverySettingsService, useValue: { isInsideServiceArea: jest.fn().mockResolvedValue(true), getSettings: jest.fn().mockResolvedValue({ priorityFeeAmount: 50, extraDestinationSurcharge: 30 }) } },
        { provide: DeliverySlotsGateway, useValue: { notifySlotUpdated: jest.fn() } },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('fires notification on first set', async () => {
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5, userId: 7, adminStatusNote: null, adminStatusSetAt: null,
    } as Order);
    ordersRepo.save.mockImplementation(async (o) => o as Order);

    await service.updateManualStatus(5, {
      note: 'Reprinting',
      estimatedCompletionAt: '2026-05-01T08:00:00Z',
    });

    expect(notificationsService.create).toHaveBeenCalled();
  });

  it('does NOT fire notification on subsequent edit', async () => {
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5, userId: 7, adminStatusNote: 'Old',
      adminStatusSetAt: new Date(),
    } as Order);
    ordersRepo.save.mockImplementation(async (o) => o as Order);
    notificationsService.create.mockClear();

    await service.updateManualStatus(5, {
      note: 'Newer',
      estimatedCompletionAt: null,
    });

    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});

describe('createBatch — 3D bounds enforcement', () => {
  let service: OrdersService;
  let printerProfileService: jest.Mocked<Pick<PrinterProfileService, 'getProfile'>>;
  let fileMetadataRepo: jest.Mocked<Pick<Repository<FileMetadata>, 'findOneOrFail'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    printerProfileService = {
      getProfile: jest.fn(),
    };

    fileMetadataRepo = {
      findOneOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn(), findOne: jest.fn(), findOneOrFail: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(OrderItem), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        { provide: getRepositoryToken(PaperSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ThreeDSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(DeliveryAssignment), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Address), useValue: { findOne: jest.fn().mockResolvedValue({ id: 9, userId: 99 }) } },
        { provide: getRepositoryToken(DeliveryDestination), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(FileMetadata), useValue: fileMetadataRepo },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        { provide: FirebaseService, useValue: { sendToDevice: jest.fn(), isAvailable: false } },
        { provide: UsersService, useValue: { getFcmToken: jest.fn().mockResolvedValue(null) } },
        { provide: CreditsService, useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() } },
        { provide: NotificationsService, useValue: { createForAllAdmins: jest.fn().mockResolvedValue(undefined) } },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: DeliverySlotsService, useValue: { bookSlot: jest.fn(), releaseSlot: jest.fn(), getAvailability: jest.fn().mockResolvedValue([]) } },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({ priorityFeeAmount: 50, extraDestinationSurcharge: 30 }),
          },
        },
        { provide: DeliverySlotsGateway, useValue: { notifySlotUpdated: jest.fn() } },
        { provide: PrinterProfileService, useValue: printerProfileService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('rejects when any 3D item exceeds the printer profile', async () => {
    printerProfileService.getProfile.mockResolvedValue({
      buildVolumeWidthMm: 180, buildVolumeDepthMm: 180, buildVolumeHeightMm: 180,
      name: 'X', maxFileSizeMb: 200,
    } as any);
    fileMetadataRepo.findOneOrFail.mockResolvedValue({
      id: 1, model3dWidthMm: '200', model3dDepthMm: '50', model3dHeightMm: '50',
    } as any);

    await expect(
      service.createBatch(99, {
        items: [
          {
            category: '3d',
            fileMetadataId: 1,
            quantity: 1,
            threeDSpecs: {} as any,
          },
        ],
        paymentMethod: 'cash',
        deliveryOption: 'delivery',
      } as any),
    ).rejects.toThrow(/build volume/);
  });
});

describe('listExternalDeliveries and updateExternalDeliveryStatus', () => {
  let service: OrdersService;
  let batchOrdersRepo: jest.Mocked<Pick<Repository<any>, 'find' | 'update'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    batchOrdersRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn(), findOne: jest.fn(), findOneOrFail: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(OrderItem), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(BatchOrder), useValue: batchOrdersRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(ThreeDSpec), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(DeliveryAssignment), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Address), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(DeliveryDestination), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(FileMetadata), useValue: { findOneOrFail: jest.fn() } },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        { provide: FirebaseService, useValue: { sendToDevice: jest.fn(), isAvailable: false } },
        { provide: UsersService, useValue: { getFcmToken: jest.fn().mockResolvedValue(null) } },
        { provide: CreditsService, useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() } },
        { provide: NotificationsService, useValue: { createForAllAdmins: jest.fn().mockResolvedValue(undefined) } },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: DeliverySlotsService, useValue: { bookSlot: jest.fn(), releaseSlot: jest.fn() } },
        { provide: DeliverySettingsService, useValue: { isInsideServiceArea: jest.fn().mockResolvedValue(true), getSettings: jest.fn().mockResolvedValue({ priorityFeeAmount: 50, extraDestinationSurcharge: 30 }) } },
        { provide: DeliverySlotsGateway, useValue: { notifySlotUpdated: jest.fn() } },
        {
          provide: PrinterProfileService,
          useValue: { getProfile: jest.fn().mockResolvedValue({ buildVolumeWidthMm: 999, buildVolumeDepthMm: 999, buildVolumeHeightMm: 999, maxFileSizeMb: 999 }) },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('listExternalDeliveries', () => {
    it('filters by externalDeliveryStatus', async () => {
      batchOrdersRepo.find.mockResolvedValue([{ id: 1, deliveryType: 'external' }]);
      const out = await service.listExternalDeliveries('pending_admin');
      expect(batchOrdersRepo.find).toHaveBeenCalledWith({
        where: { deliveryType: 'external', externalDeliveryStatus: 'pending_admin' },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      });
      expect(out).toEqual([{ id: 1, deliveryType: 'external' }]);
    });

    it('omits status filter when no status passed', async () => {
      batchOrdersRepo.find.mockResolvedValue([]);
      await service.listExternalDeliveries(undefined);
      expect(batchOrdersRepo.find).toHaveBeenCalledWith({
        where: { deliveryType: 'external' },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      });
    });
  });

  describe('updateExternalDeliveryStatus', () => {
    it('updates the status', async () => {
      batchOrdersRepo.update.mockResolvedValue({ affected: 1 } as any);
      await service.updateExternalDeliveryStatus(1, 'booked');
      expect(batchOrdersRepo.update).toHaveBeenCalledWith(1, {
        externalDeliveryStatus: 'booked',
      });
    });
  });
});
