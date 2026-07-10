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
import { UserRole } from '../users/entities/user.entity';
import { DispatchPlanService } from './dispatch-plan.service';

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
  ) {}

  async handleConnection(client: LocationSocket) {
    try {
      if (!(await this.authenticateSocket(client))) {
        client.disconnect();
      }
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
    if (!assignment) throw new WsException('Delivery not found');

    if (role === UserRole.CUSTOMER) {
      if (assignment.order?.userId !== userId) {
        throw new WsException('Forbidden');
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
    } else if (role !== UserRole.ADMIN) {
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
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return null;
    const payload = await this.jwtService.verifyAsync<{
      sub?: unknown;
      role?: unknown;
    }>(token);
    if (
      typeof payload.sub !== 'number' ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0
    ) {
      return null;
    }
    const identity = await this.usersService.findSocketIdentity(payload.sub);
    if (
      !identity?.isActive ||
      payload.role !== identity.role ||
      !Object.values(UserRole).includes(identity.role)
    ) {
      return null;
    }
    socket.data.userId = identity.id;
    socket.data.role = identity.role;
    return identity;
  }
}
