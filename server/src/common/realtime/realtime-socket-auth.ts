import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../users/entities/user.entity';
import { UsersService, type SocketIdentity } from '../../users/users.service';

type RealtimeSocketLike = {
  handshake: { auth?: Record<string, unknown> };
  data: { userId?: number; role?: UserRole };
};

export async function authenticateRealtimeSocket(
  jwtService: JwtService,
  usersService: UsersService,
  socket: RealtimeSocketLike,
): Promise<SocketIdentity | null> {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = await jwtService.verifyAsync<{
      sub?: unknown;
      role?: unknown;
    }>(token);
    if (
      typeof payload.sub !== 'number' ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0
    ) {
      return null;
    }
    const identity = await usersService.findSocketIdentity(payload.sub);
    if (
      !identity?.isActive ||
      payload.role !== identity.role ||
      !Object.values(UserRole).includes(identity.role)
    ) {
      return null;
    }
    socket.data.userId = identity.id;
    socket.data.role = identity.role;
    return identity;
  } catch {
    return null;
  }
}

export async function reauthorizeRealtimeSocket(
  usersService: UsersService,
  socket: Pick<RealtimeSocketLike, 'data'>,
): Promise<SocketIdentity | null> {
  const { userId, role } = socket.data;
  if (
    typeof userId !== 'number' ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !role
  ) {
    return null;
  }
  const identity = await usersService.findSocketIdentity(userId);
  if (!identity?.isActive || identity.role !== role) return null;
  return identity;
}
