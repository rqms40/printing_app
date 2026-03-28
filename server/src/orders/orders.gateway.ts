import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/orders', cors: { origin: '*' } })
export class OrdersGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
    client.join(`order_${orderId}`);
    return { event: 'subscribed', data: { orderId } };
  }

  // Called by OrdersService when status changes
  notifyOrderUpdate(orderId: string, order: any) {
    this.server.to(`order_${orderId}`).emit('orderUpdate', order);
  }
}
