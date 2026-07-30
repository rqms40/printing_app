import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';
import { authenticateRealtimeSocket } from '../common/realtime/realtime-socket-auth';

export type DeliveryQueueUpdatedPayload = {
  orderId: number;
  orderRef: string;
  queuePosition: number;
  queueSize: number;
  canTrackDelivery: boolean;
  assignmentId: number | null;
  planVersion: number;
};

export type RiderDispatchPlanUpdatedPayload = {
  riderProfileId: number;
  planId: number;
  planVersion: number;
} & (
  | {
      change: 'created' | 'reoptimized';
    }
  | {
      change: 'stopCompleted' | 'stopSkipped' | 'completed';
      assignmentId: number;
      stopStatus: 'completed' | 'skipped';
      planStatus: 'active' | 'completed';
    }
);

export type RiderAssignmentUpdatedPayload = {
  assignmentId: number;
  orderId: number;
  orderRef: string;
  status?:
    | 'assigned'
    | 'accepted'
    | 'declined'
    | 'picked_up'
    | 'on_the_way'
    | 'arrived'
    | 'delivered';
  change?: 'assigned' | 'statusUpdated' | 'unassigned';
};

@WebSocketGateway({ namespace: '/ws/orders', cors: { origin: '*' } })
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly realtimeSessions: RealtimeSessionRegistry,
  ) {}

  async handleConnection(client: Socket) {
    const identity = await authenticateRealtimeSocket(
      this.jwtService,
      this.usersService,
      client,
    );
    if (!identity) {
      client.disconnect();
      return;
    }
    await client.join(`user_${identity.id}`);
    if (identity.role === UserRole.ADMIN) {
      await client.join('admin_orders');
    }
    this.realtimeSessions.register(identity.id, client);
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
    payload: RiderAssignmentUpdatedPayload,
  ) {
    this.server.to(`user_${riderUserId}`).emit('riderAssignment', payload);
  }

  notifyRiderDispatchPlanUpdated(
    riderUserId: number,
    payload: RiderDispatchPlanUpdatedPayload,
  ) {
    this.server
      .to(`user_${riderUserId}`)
      .emit('riderDispatchPlanUpdated', payload);
  }

  notifyDeliveryQueueUpdated(
    userId: number,
    payload: DeliveryQueueUpdatedPayload,
  ) {
    this.server.to(`user_${userId}`).emit('deliveryQueueUpdated', payload);
  }
}
