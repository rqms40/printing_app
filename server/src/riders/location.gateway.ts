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
import { In, Repository } from 'typeorm';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import {
  orderDeliveryAssignmentsByRoute,
  SHOP_LOCATION,
  toGeoPoint,
} from './delivery-route';

type LocationSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { userId?: number; role?: string }
>;

@WebSocketGateway({ namespace: '/ws/location', cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(DeliveryAssignment)
    private readonly assignmentRepo: Repository<DeliveryAssignment>,
  ) {}

  async handleConnection(client: LocationSocket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        role?: string;
      }>(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role ?? 'customer';
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
    const userId = socket.data.userId;
    const role = socket.data.role;
    if (!Number.isInteger(numericId) || numericId <= 0 || !userId) {
      throw new WsException('Unauthorized');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: numericId, isCurrent: true },
      relations: ['order', 'order.destination', 'rider'],
    });
    if (!assignment) throw new WsException('Delivery not found');

    if (role === 'customer') {
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
      const active = await this.assignmentRepo.find({
        where: {
          riderId: assignment.riderId,
          isCurrent: true,
          status: In([
            DeliveryStatus.ASSIGNED,
            DeliveryStatus.ACCEPTED,
            DeliveryStatus.PICKED_UP,
            DeliveryStatus.ON_THE_WAY,
            DeliveryStatus.ARRIVED,
          ]),
        },
        relations: ['order', 'order.destination', 'rider'],
      });
      const riderStart =
        toGeoPoint(
          assignment.rider?.lastLatitude,
          assignment.rider?.lastLongitude,
        ) ?? SHOP_LOCATION;
      const current = orderDeliveryAssignmentsByRoute(active, riderStart)[0];
      if (current?.id !== assignment.id) {
        throw new WsException('Live tracking is not available for this stop');
      }
    } else if (role === 'rider') {
      if (assignment.rider?.userId !== userId) {
        throw new WsException('Forbidden');
      }
    } else if (role !== 'admin') {
      throw new WsException('Forbidden');
    }

    void socket.join(`delivery_${numericId}`);
    return {
      event: 'subscribed',
      data: { assignmentId: String(numericId) },
    };
  }

  // Called by RidersService when rider sends GPS update
  broadcastLocation(assignmentId: string, location: any) {
    this.server.to(`delivery_${assignmentId}`).emit('locationUpdate', location);
  }
}
