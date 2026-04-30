import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/ws/delivery-slots', cors: { origin: '*' } })
export class DeliverySlotsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

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
  handleSubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`slots:${data.date}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe-slots')
  handleUnsubscribe(
    @MessageBody() data: { date: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(`slots:${data.date}`);
  }

  notifySlotUpdated(payload: {
    templateId: number;
    date: string;
    bookedCount: number;
  }) {
    this.server.to(`slots:${payload.date}`).emit('slot-updated', payload);
  }

  /// Fire a generic "this date's bookings changed" event. Use when the
  /// thing that changed isn't a single template's count (e.g. reorder,
  /// express toggle, cancellation). Subscribers re-fetch on receipt.
  notifyDateChanged(date: string) {
    this.server
      .to(`slots:${date}`)
      .emit('slot-updated', { date, reason: 'changed' });
  }
}
