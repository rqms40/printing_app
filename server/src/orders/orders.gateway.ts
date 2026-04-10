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

@WebSocketGateway({ namespace: '/ws/orders', cors: { origin: '*' } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ role?: string }>(
        token,
      );
      if (payload.role === 'admin') {
        void client.join('admin_orders');
      }
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`order_${orderId}`);
    return { event: 'subscribed', data: { orderId } };
  }

  // Called by OrdersService when status changes
  notifyOrderUpdate(orderId: string, order: any) {
    this.server.to(`order_${orderId}`).emit('orderUpdate', order);
    this.server.to('admin_orders').emit('orderUpdate', order);
  }
}
