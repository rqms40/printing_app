import {
  WebSocketGateway,
  WebSocketServer,
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
      const payload = await this.jwtService.verifyAsync<{
        role?: string;
        sub?: number;
      }>(token);
      if (payload.sub != null) {
        void client.join(`user_${payload.sub}`);
      }
      if (payload.role === 'admin') {
        void client.join('admin_orders');
      }
    } catch {
      client.disconnect();
    }
  }

  // Called by OrdersService when status changes
  notifyOrderUpdate(_orderId: string, order: { userId?: number | null }) {
    if (order?.userId != null) {
      this.server.to(`user_${order.userId}`).emit('orderUpdate', order);
    }
    this.server.to('admin_orders').emit('orderUpdate', order);
  }

  // Called by TamSurveysService after a post-delivery requirement is created
  notifySurveyRequired(
    userId: number,
    payload: { requirementId: number; orderId: number; orderRef: string },
  ) {
    this.server.to(`user_${userId}`).emit('survey-required', payload);
  }

  notifyRiderAssignment(
    riderUserId: number,
    payload: { assignmentId: number; orderId: number; orderRef: string },
  ) {
    this.server.to(`user_${riderUserId}`).emit('riderAssignment', payload);
  }
}
