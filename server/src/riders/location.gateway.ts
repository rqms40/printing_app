import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/location', cors: { origin: '*' } })
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() assignmentId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    void socket.join(`delivery_${assignmentId}`);
    return { event: 'subscribed', data: { assignmentId } };
  }

  @SubscribeMessage('updateLocation')
  handleLocationUpdate(
    @MessageBody()
    data: { assignmentId: string; latitude: number; longitude: number },
    @ConnectedSocket() _client: Socket,
  ) {
    // Broadcast to customers watching this delivery
    this.server
      .to(`delivery_${data.assignmentId}`)
      .emit('locationUpdate', data);
    return {
      event: 'locationBroadcasted',
      data: { assignmentId: data.assignmentId },
    };
  }

  // Called by RidersService when rider sends GPS update
  broadcastLocation(assignmentId: string, location: any) {
    this.server.to(`delivery_${assignmentId}`).emit('locationUpdate', location);
  }
}
