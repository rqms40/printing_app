import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/daily-grid', cors: { origin: '*' } })
export class DailyGridGateway {
  @WebSocketServer()
  server: Server;

  notifyUpdated(): void {
    this.server.emit('dailyGridUpdated', {});
  }
}
