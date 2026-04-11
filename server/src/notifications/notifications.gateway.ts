import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Notification } from './entities/notification.entity';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
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
      if (payload.role === 'admin') {
        void client.join('admin_notifications');
      }
      void client.join(`user_${payload.sub}`);
    } catch {
      client.disconnect();
    }
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
