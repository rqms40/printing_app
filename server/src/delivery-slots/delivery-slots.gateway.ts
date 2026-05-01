import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/ws/delivery-slots', cors: { origin: '*' } })
export class DeliverySlotsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger('DeliverySlotsGateway');

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) return client.disconnect();
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe-slots')
  async handleSubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `slots:${data.date}`;
    await client.join(room);
    this.logger.log(`socket ${client.id} joined ${room}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe-slots')
  async handleUnsubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
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
