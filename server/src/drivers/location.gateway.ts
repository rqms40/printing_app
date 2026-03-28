import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/location', cors: { origin: '*' } })
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() assignmentId: string, @ConnectedSocket() client: Socket) {
    client.join(`delivery_${assignmentId}`);
    return { event: 'subscribed', data: { assignmentId } };
  }

  // Called by DriversService when driver sends GPS update
  broadcastLocation(assignmentId: string, location: any) {
    this.server.to(`delivery_${assignmentId}`).emit('locationUpdate', location);
  }
}
