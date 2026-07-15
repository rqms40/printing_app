import { WsException } from '@nestjs/websockets';
import { LocationGateway } from './location.gateway';
import { DeliveryStatus } from './entities/delivery-assignment.entity';
import { UserRole } from '../users/entities/user.entity';

describe('LocationGateway', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const assignmentRepo = { findOne: jest.fn() };
  const usersService = { findSocketIdentity: jest.fn() };
  const dispatchPlanService = { getCurrentPendingStopForRider: jest.fn() };
  const realtimeSessions = { register: jest.fn() };
  let gateway: LocationGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 10,
      role: UserRole.CUSTOMER,
    });
    usersService.findSocketIdentity.mockImplementation(async (id: number) => ({
      id,
      role: UserRole.CUSTOMER,
      isActive: true,
    }));
    gateway = new (LocationGateway as any)(
      jwtService,
      assignmentRepo,
      usersService,
      dispatchPlanService,
      realtimeSessions,
    );
  });

  it('disconnects sockets without a valid JWT', async () => {
    const client = {
      handshake: { auth: {} },
      data: {},
      disconnect: jest.fn(),
    };

    await (gateway as any).handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects an inactive signed user during connection', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 8,
      role: UserRole.CUSTOMER,
    });
    usersService.findSocketIdentity.mockResolvedValue({
      id: 8,
      role: UserRole.CUSTOMER,
      isActive: false,
    });
    const client = {
      handshake: { auth: { token: 'signed-token' } },
      data: {},
      disconnect: jest.fn(),
    };

    await (gateway as any).handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.data).toEqual({});
  });

  it('registers an active socket for post-commit account revocation', async () => {
    const client = {
      id: 'location-1',
      handshake: { auth: { token: 'signed-token' } },
      data: {},
      disconnect: jest.fn(),
    };

    await (gateway as any).handleConnection(client);

    expect(realtimeSessions.register).toHaveBeenCalledWith(10, client);
  });

  it('disconnects a missing or role-mismatched database identity', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 8,
      role: UserRole.ADMIN,
    });
    usersService.findSocketIdentity.mockResolvedValue({
      id: 8,
      role: UserRole.CUSTOMER,
      isActive: true,
    });
    const client = {
      handshake: { auth: { token: 'signed-token' } },
      data: {},
      disconnect: jest.fn(),
    };

    await (gateway as any).handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();

    usersService.findSocketIdentity.mockResolvedValue(null);
    const missingClient = {
      handshake: { auth: { token: 'signed-token' } },
      data: {},
      disconnect: jest.fn(),
    };
    await (gateway as any).handleConnection(missingClient);
    expect(missingClient.disconnect).toHaveBeenCalled();
  });

  it('allows the owner to subscribe to the persisted current stop even when straight-line ordering disagrees', async () => {
    const join = jest.fn().mockResolvedValue(undefined);
    const client = {
      handshake: { auth: { token: 'customer-token' } },
      data: { userId: 10, role: UserRole.CUSTOMER },
      join,
      disconnect: jest.fn(),
    };
    const persistedFirstButFarther = {
      id: 1,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: {
        userId: 10,
        destination: { latitude: 7.22, longitude: 125.72 },
      },
      rider: { lastLatitude: 7.065, lastLongitude: 125.609 },
    };
    const straightLineNearestButLater = {
      id: 2,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: {
        userId: 10,
        destination: { latitude: 7.065, longitude: 125.609 },
      },
      rider: { lastLatitude: 7.065, lastLongitude: 125.609 },
    };
    assignmentRepo.findOne.mockResolvedValue(persistedFirstButFarther);
    dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
      stop: { assignmentId: persistedFirstButFarther.id },
      planVersion: 7,
    });

    await expect(
      (gateway as any).handleSubscribe('1', client),
    ).resolves.toEqual({
      event: 'subscribed',
      data: { assignmentId: '1', planVersion: 7 },
    });
    expect(join).toHaveBeenCalledWith('delivery_1');

    assignmentRepo.findOne.mockResolvedValue(straightLineNearestButLater);
    dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
      stop: { assignmentId: persistedFirstButFarther.id },
      planVersion: 7,
    });
    await expect(
      (gateway as any).handleSubscribe('2', client),
    ).rejects.toBeInstanceOf(WsException);
    expect(join).not.toHaveBeenCalledWith('delivery_2');
  });

  it('withholds live tracking until the current stop is in transit', async () => {
    const join = jest.fn().mockResolvedValue(undefined);
    const client = {
      handshake: { auth: { token: 'customer-token' } },
      data: { userId: 10, role: UserRole.CUSTOMER },
      join,
      disconnect: jest.fn(),
    };
    const assignment = {
      id: 1,
      riderId: 5,
      status: DeliveryStatus.ASSIGNED,
      order: {
        userId: 10,
        destination: { latitude: 7.065, longitude: 125.609 },
      },
      rider: { lastLatitude: 7.064, lastLongitude: 125.608 },
    };
    assignmentRepo.findOne.mockResolvedValue(assignment);
    dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
      stop: { assignmentId: assignment.id },
      planVersion: 1,
    });

    await expect(
      (gateway as any).handleSubscribe('1', client),
    ).rejects.toBeInstanceOf(WsException);
    expect(join).not.toHaveBeenCalled();
  });

  it('rejects an assignment subscription the customer does not own before revealing queue state', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 99,
      role: UserRole.CUSTOMER,
    });
    const client = {
      handshake: { auth: { token: 'other-customer-token' } },
      data: { userId: 99, role: UserRole.CUSTOMER },
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    assignmentRepo.findOne.mockResolvedValue({
      id: 1,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: { userId: 10 },
      rider: { userId: 50 },
    });

    await expect((gateway as any).handleSubscribe('1', client)).rejects.toThrow(
      'Live tracking is not available for this stop',
    );

    expect(
      dispatchPlanService.getCurrentPendingStopForRider,
    ).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('gives a customer the same rejection for a missing and an unowned delivery', async () => {
    const client = {
      handshake: { auth: { token: 'customer-token' } },
      data: { userId: 99, role: UserRole.CUSTOMER },
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    jest.spyOn(gateway as any, 'authenticateSocket').mockResolvedValue({
      id: 99,
      role: UserRole.CUSTOMER,
    });

    assignmentRepo.findOne.mockResolvedValueOnce(null);
    const missing = await (gateway as any)
      .handleSubscribe('4242', client)
      .catch((e: Error) => e.message);

    assignmentRepo.findOne.mockResolvedValueOnce({
      id: 4242,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: { userId: 10 },
      rider: { userId: 50 },
    });
    const unowned = await (gateway as any)
      .handleSubscribe('4242', client)
      .catch((e: Error) => e.message);

    expect(missing).toBe('Live tracking is not available for this stop');
    expect(unowned).toBe(missing);
  });

  it('delivers no locationUpdate to the customer at queue position 2', async () => {
    const joinedRooms = new Set<string>();
    const publishedEvents: Array<{
      room: string;
      event: string;
      payload: unknown;
    }> = [];
    const receivedEvents: Array<{ event: string; payload: unknown }> = [];
    const client = {
      handshake: { auth: { token: 'later-customer-token' } },
      data: { userId: 10, role: UserRole.CUSTOMER },
      join: jest.fn(async (room: string) => {
        joinedRooms.add(room);
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    assignmentRepo.findOne.mockResolvedValue({
      id: 2,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: { userId: 10 },
      rider: { userId: 50 },
    });
    dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
      stop: { assignmentId: 1 },
      planVersion: 7,
    });
    (gateway as any).server = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          publishedEvents.push({ room, event, payload });
          if (joinedRooms.has(room)) receivedEvents.push({ event, payload });
        },
      }),
    };

    await expect((gateway as any).handleSubscribe('2', client)).rejects.toThrow(
      'Live tracking is not available for this stop',
    );
    expect(client.join).not.toHaveBeenCalled();

    gateway.broadcastLocation('1', {
      assignmentId: '1',
      planVersion: 7,
      latitude: 7.064,
      longitude: 125.6079,
      timestamp: '2026-07-15T12:00:00.000Z',
    });

    expect(publishedEvents).toEqual([
      {
        room: 'delivery_1',
        event: 'locationUpdate',
        payload: expect.objectContaining({
          assignmentId: '1',
          latitude: 7.064,
          longitude: 125.6079,
        }),
      },
    ]);
    expect(receivedEvents).toEqual([]);
    expect(client.emit).not.toHaveBeenCalled();
  });

  it('rechecks account activity and role before every subscription', async () => {
    const client = {
      handshake: { auth: { token: 'customer-token' } },
      data: { userId: 10, role: UserRole.CUSTOMER },
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    usersService.findSocketIdentity.mockResolvedValue({
      id: 10,
      role: UserRole.CUSTOMER,
      isActive: false,
    });

    await expect(
      (gateway as any).handleSubscribe('1', client),
    ).rejects.toBeInstanceOf(WsException);

    expect(client.disconnect).toHaveBeenCalled();
    expect(assignmentRepo.findOne).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('does not expose a client location publishing handler', () => {
    expect((gateway as any).handleLocationUpdate).toBeUndefined();
  });
});
