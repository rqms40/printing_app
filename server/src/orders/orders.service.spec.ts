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
        { provide: getRepositoryToken('BatchOrder'), useValue: batchRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: paperSpecsRepo },
        { provide: getRepositoryToken(ThreeDSpec), useValue: threeDSpecsRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        { provide: OrdersGateway, useValue: gateway },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: UsersService, useValue: usersService },
        { provide: CreditsService, useValue: creditsService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
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

      expect(batchRepo.save).toHaveBeenCalledTimes(1);
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
        { provide: getRepositoryToken('BatchOrder'), useValue: {} },
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
