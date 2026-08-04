import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Notification } from './entities/notification.entity';
import { UsersService } from '../users/users.service';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';
import { authenticateRealtimeSocket } from '../common/realtime/realtime-socket-auth';
import { isAdminRole } from '../users/entities/user.entity';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
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
    if (isAdminRole(identity.role)) {
      await client.join('admin_notifications');
    }
    await client.join(`user_${identity.id}`);
    this.realtimeSessions.register(identity.id, client);
  }

  broadcastToAdmins(notif: Notification): void {
    this.server.to('admin_notifications').emit('newNotification', notif);
  }

  notifyUserCreditsUpdate(userId: number, newCredits: number): void {
    this.server
      .to(`user_${userId}`)
      .emit('creditsUpdate', { credits: newCredits.toString() });
  }

  notifyUser(userId: number, notif: Notification): void {
    this.server.to(`user_${userId}`).emit('newNotification', notif);
  }
}
