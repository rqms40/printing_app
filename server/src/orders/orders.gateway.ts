import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

export type DeliveryQueueUpdatedPayload = {
  orderId: number;
  orderRef: string;
  queuePosition: 1;
  queueSize: number;
  canTrackDelivery: boolean;
  assignmentId: number | null;
  planVersion: number;
};

@WebSocketGateway({ namespace: '/ws/orders', cors: { origin: '*' } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        role?: unknown;
        sub?: unknown;
      }>(token);
      if (
        typeof payload.sub !== 'number' ||
        !Number.isInteger(payload.sub) ||
        payload.sub <= 0
      ) {
        client.disconnect();
        return;
      }
      const identity = await this.usersService.findSocketIdentity(payload.sub);
      if (
        !identity?.isActive ||
        payload.role !== identity.role ||
        !Object.values(UserRole).includes(identity.role)
      ) {
        client.disconnect();
        return;
      }
      await client.join(`user_${identity.id}`);
      if (identity.role === UserRole.ADMIN) {
        await client.join('admin_orders');
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

  notifyDeliveryQueueUpdated(
    userId: number,
    payload: DeliveryQueueUpdatedPayload,
  ) {
    this.server.to(`user_${userId}`).emit('deliveryQueueUpdated', payload);
  }
}
