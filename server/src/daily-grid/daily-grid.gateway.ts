import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

// No auth guard: daily-grid card data is public (same as the unauthenticated GET /daily-grid REST endpoint).
@WebSocketGateway({ namespace: '/ws/daily-grid', cors: { origin: '*' } })
export class DailyGridGateway {
  @WebSocketServer()
  server: Server;

  notifyUpdated(): void {
    this.server.emit('dailyGridUpdated', {});
  }
}
