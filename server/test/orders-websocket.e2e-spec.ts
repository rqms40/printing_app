import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { OrdersGateway } from '../src/orders/orders.gateway';

describe('Orders websocket realtime rooms (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let jwtService: JwtService;
  let ordersGateway: OrdersGateway;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.listen(0);

    baseUrl = await app.getUrl();
    jwtService = app.get(JwtService);
    ordersGateway = app.get(OrdersGateway);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('pushes order updates to authenticated customer and admin rooms', async () => {
    const customerSocket = await connectOrdersSocket(
      tokenFor({ sub: 101, role: 'customer' }),
    );
    const adminSocket = await connectOrdersSocket(
      tokenFor({ sub: 1, role: 'admin' }),
    );
    const customerUpdate = onceEvent(customerSocket, 'orderUpdate');
    const adminUpdate = onceEvent(adminSocket, 'orderUpdate');
    const payload = {
      id: 42,
      orderId: 'ORD-WS-10042',
      userId: 101,
      orderStatus: 'ready_for_dispatch',
    };

    ordersGateway.notifyOrderUpdate(payload.orderId, payload);

    await expect(customerUpdate).resolves.toMatchObject(payload);
    await expect(adminUpdate).resolves.toMatchObject(payload);
  });

  it('pushes riderAssignment to the assigned rider user room', async () => {
    const riderSocket = await connectOrdersSocket(
      tokenFor({ sub: 70, role: 'rider' }),
    );
    const assignmentEvent = onceEvent(riderSocket, 'riderAssignment');
    const payload = {
      assignmentId: 99,
      orderId: 42,
      orderRef: 'ORD-WS-10042',
    };

    ordersGateway.notifyRiderAssignment(70, payload);

    await expect(assignmentEvent).resolves.toMatchObject(payload);
  });

  function tokenFor(payload: { sub: number; role: string }) {
    return jwtService.sign({
      ...payload,
      email: `ws-${payload.role}-${payload.sub}@example.com`,
    });
  }

  async function connectOrdersSocket(token: string): Promise<Socket> {
    const socket = io(`${baseUrl}/ws/orders`, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await onceConnect(socket);
    await new Promise((resolve) => setImmediate(resolve));
    return socket;
  }
});

function onceConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function onceEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 1500);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}
