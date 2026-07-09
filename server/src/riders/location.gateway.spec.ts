import { WsException } from '@nestjs/websockets';
import { LocationGateway } from './location.gateway';
import { DeliveryStatus } from './entities/delivery-assignment.entity';

describe('LocationGateway', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const assignmentRepo = { findOne: jest.fn(), find: jest.fn() };
  let gateway: LocationGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new (LocationGateway as any)(jwtService, assignmentRepo);
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

  it('allows the owning customer to subscribe only to the current route stop', async () => {
    const join = jest.fn();
    const client = { data: { userId: 10, role: 'customer' }, join };
    const first = {
      id: 1,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: {
        userId: 11,
        destination: { latitude: 7.065, longitude: 125.609 },
      },
      rider: { lastLatitude: 7.064, lastLongitude: 125.608 },
    };
    const later = {
      id: 2,
      riderId: 5,
      status: DeliveryStatus.ON_THE_WAY,
      order: {
        userId: 10,
        destination: { latitude: 7.22, longitude: 125.72 },
      },
      rider: { lastLatitude: 7.064, lastLongitude: 125.608 },
    };
    assignmentRepo.findOne.mockResolvedValue(later);
    assignmentRepo.find.mockResolvedValue([later, first]);

    await expect(
      (gateway as any).handleSubscribe('2', client),
    ).rejects.toBeInstanceOf(WsException);
    expect(join).not.toHaveBeenCalled();

    assignmentRepo.findOne.mockResolvedValue({
      ...first,
      order: { ...first.order, userId: 10 },
    });
    await expect(
      (gateway as any).handleSubscribe('1', client),
    ).resolves.toMatchObject({ event: 'subscribed' });
    expect(join).toHaveBeenCalledWith('delivery_1');
  });

  it('withholds live tracking until the current stop is in transit', async () => {
    const join = jest.fn();
    const client = { data: { userId: 10, role: 'customer' }, join };
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
    assignmentRepo.find.mockResolvedValue([assignment]);

    await expect(
      (gateway as any).handleSubscribe('1', client),
    ).rejects.toBeInstanceOf(WsException);
    expect(join).not.toHaveBeenCalled();
  });

  it('does not expose a client location publishing handler', () => {
    expect((gateway as any).handleLocationUpdate).toBeUndefined();
  });
});
