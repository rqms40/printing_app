import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { UsersService, type SocketIdentity } from '../users/users.service';
import { isAdminRole, UserRole } from '../users/entities/user.entity';
import { DispatchPlanService } from './dispatch-plan.service';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';
import { authenticateRealtimeSocket } from '../common/realtime/realtime-socket-auth';

export type RiderLocationUpdatePayload = {
  assignmentId: string;
  planVersion: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

type LocationSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { userId?: number; role?: UserRole }
>;

@WebSocketGateway({ namespace: '/ws/location', cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(DeliveryAssignment)
    private readonly assignmentRepo: Repository<DeliveryAssignment>,
    private readonly usersService: UsersService,
    private readonly dispatchPlanService: DispatchPlanService,
    private readonly realtimeSessions: RealtimeSessionRegistry,
  ) {}

  async handleConnection(client: LocationSocket) {
    try {
      const identity = await this.authenticateSocket(client);
      if (!identity) {
        client.disconnect();
        return;
      }
      this.realtimeSessions.register(identity.id, client);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() assignmentId: string,
    @ConnectedSocket() socket: LocationSocket,
  ) {
    const numericId = Number(assignmentId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new WsException('Unauthorized');
    }

    let identity: SocketIdentity | null = null;
    try {
      identity = await this.authenticateSocket(socket);
    } catch {
      // Authentication failures deliberately share one public response.
    }
    if (!identity) {
      socket.disconnect();
      throw new WsException('Unauthorized');
    }
    const userId = identity.id;
    const role = identity.role;

    const assignment = await this.assignmentRepo.findOne({
      where: { id: numericId, isCurrent: true },
      relations: ['order', 'rider'],
    });
    // One opaque rejection for "no such current delivery" and "not your
    // delivery" so an authenticated customer cannot enumerate which
    // assignment ids are currently live.
    const unavailable = new WsException(
      'Live tracking is not available for this stop',
    );
    if (!assignment) {
      if (role === UserRole.CLIENT) throw unavailable;
      throw new WsException('Delivery not found');
    }

    if (role === UserRole.CLIENT) {
      if (assignment.order?.userId !== userId) {
        throw unavailable;
      }
      if (
        ![DeliveryStatus.ON_THE_WAY, DeliveryStatus.ARRIVED].includes(
          assignment.status,
        )
      ) {
        throw new WsException('Live tracking is not available for this stop');
      }
    } else if (role === UserRole.RIDER) {
      if (assignment.rider?.userId !== userId) {
        throw new WsException('Forbidden');
      }
    } else if (!isAdminRole(role)) {
      throw new WsException('Forbidden');
    }

    const currentStop =
      await this.dispatchPlanService.getCurrentPendingStopForRider(
        assignment.riderId,
      );
    if (currentStop?.stop.assignmentId !== assignment.id) {
      throw new WsException('Live tracking is not available for this stop');
    }

    await socket.join(`delivery_${numericId}`);
    return {
      event: 'subscribed',
      data: {
        assignmentId: String(numericId),
        planVersion: currentStop.planVersion,
      },
    };
  }

  // Called by RidersService when rider sends GPS update
  broadcastLocation(
    assignmentId: string,
    location: RiderLocationUpdatePayload,
  ) {
    this.server.to(`delivery_${assignmentId}`).emit('locationUpdate', location);
  }

  private async authenticateSocket(
    socket: LocationSocket,
  ): Promise<SocketIdentity | null> {
    return authenticateRealtimeSocket(
      this.jwtService,
      this.usersService,
      socket,
    );
  }
}
