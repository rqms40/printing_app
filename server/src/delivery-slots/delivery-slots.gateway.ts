import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';
import {
  authenticateRealtimeSocket,
  reauthorizeRealtimeSocket,
} from '../common/realtime/realtime-socket-auth';
import { UserRole } from '../users/entities/user.entity';

interface DeliverySlotsSocketData {
  userId?: number;
  role?: UserRole;
}

type DeliverySlotsSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  DeliverySlotsSocketData
>;

@WebSocketGateway({ namespace: '/ws/delivery-slots', cors: { origin: '*' } })
export class DeliverySlotsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger('DeliverySlotsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly realtimeSessions: RealtimeSessionRegistry,
  ) {}

  async handleConnection(client: DeliverySlotsSocket) {
    const identity = await authenticateRealtimeSocket(
      this.jwtService,
      this.usersService,
      client,
    );
    if (!identity) return client.disconnect();
    this.realtimeSessions.register(identity.id, client);
  }

  @SubscribeMessage('subscribe-slots')
  async handleSubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: DeliverySlotsSocket,
  ) {
    const identity = await reauthorizeRealtimeSocket(this.usersService, client);
    if (!identity) {
      client.disconnect();
      throw new WsException('Unauthorized');
    }
    const room = `slots:${data.date}`;
    await client.join(room);
    this.logger.log(`socket ${client.id} joined ${room}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe-slots')
  async handleUnsubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: DeliverySlotsSocket,
  ) {
    await client.leave(`slots:${data.date}`);
  }

  notifySlotUpdated(payload: {
    templateId: number;
    date: string;
    bookedCount: number;
  }) {
    const room = `slots:${payload.date}`;
    this.logger.log(`broadcast slot-updated → ${room}`);
    this.server.to(room).emit('slot-updated', payload);
  }

  /// Fire a generic "this date's bookings changed" event. Use when the
  /// thing that changed isn't a single template's count (e.g. reorder,
  /// express toggle, cancellation). Subscribers re-fetch on receipt.
  notifyDateChanged(date: string) {
    const room = `slots:${date}`;
    this.logger.log(`broadcast date-changed → ${room}`);
    this.server.to(room).emit('slot-updated', { date, reason: 'changed' });
  }
}
