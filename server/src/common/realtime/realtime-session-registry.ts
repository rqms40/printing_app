import { Injectable, Logger } from '@nestjs/common';

export type RegisteredRealtimeSocket = {
  id: string;
  disconnect(close?: boolean): unknown;
  once(event: 'disconnect', listener: () => void): unknown;
};

@Injectable()
export class RealtimeSessionRegistry {
  private readonly logger = new Logger(RealtimeSessionRegistry.name);
  private readonly sessionsByUser = new Map<
    number,
    Set<RegisteredRealtimeSocket>
  >();

  register(userId: number, socket: RegisteredRealtimeSocket): void {
    const sessions = this.sessionsByUser.get(userId) ?? new Set();
    sessions.add(socket);
    this.sessionsByUser.set(userId, sessions);
    socket.once('disconnect', () => this.unregister(userId, socket));
  }

  disconnectUser(userId: number): void {
    const sessions = this.sessionsByUser.get(userId);
    if (!sessions) return;
    this.sessionsByUser.delete(userId);
    for (const socket of sessions) {
      try {
        socket.disconnect(true);
      } catch (error) {
        this.logger.warn(
          `Failed to disconnect realtime socket ${socket.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  private unregister(userId: number, socket: RegisteredRealtimeSocket): void {
    const sessions = this.sessionsByUser.get(userId);
    if (!sessions) return;
    sessions.delete(socket);
    if (sessions.size === 0) this.sessionsByUser.delete(userId);
  }
}
