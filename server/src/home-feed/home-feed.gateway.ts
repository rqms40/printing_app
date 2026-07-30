import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

// No auth guard: the event contains no data and only prompts authenticated clients to refetch.
@WebSocketGateway({ namespace: '/ws/home-feed', cors: { origin: '*' } })
export class HomeFeedGateway {
  @WebSocketServer()
  server: Server;

  notifyUpdated(): void {
    this.server?.emit('homeFeedUpdated', {});
  }
}
