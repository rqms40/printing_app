import { UserRole } from '../../users/entities/user.entity';
import {
  authenticateRealtimeSocket,
  reauthorizeRealtimeSocket,
} from './realtime-socket-auth';

describe('realtime socket authentication', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const usersService = { findSocketIdentity: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('accepts only an active database identity matching the signed role', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 10,
      role: UserRole.CLIENT,
    });
    usersService.findSocketIdentity.mockResolvedValue({
      id: 10,
      role: UserRole.CLIENT,
      isActive: true,
    });
    const socket = makeSocket();

    await expect(
      authenticateRealtimeSocket(
        jwtService as any,
        usersService as any,
        socket as any,
      ),
    ).resolves.toMatchObject({ id: 10, role: UserRole.CLIENT });
    expect(socket.data).toEqual({ userId: 10, role: UserRole.CLIENT });
  });

  it.each([
    [undefined, null],
    [0, null],
    [10, null],
    [10, { id: 10, role: UserRole.CLIENT, isActive: false }],
    [10, { id: 10, role: UserRole.RIDER, isActive: true }],
  ])('rejects invalid or unauthorized identity %#', async (sub, identity) => {
    jwtService.verifyAsync.mockResolvedValue({
      sub,
      role: UserRole.CLIENT,
    });
    usersService.findSocketIdentity.mockResolvedValue(identity);

    await expect(
      authenticateRealtimeSocket(
        jwtService as any,
        usersService as any,
        makeSocket() as any,
      ),
    ).resolves.toBeNull();
  });

  it('reloads activity and role before an existing socket action', async () => {
    usersService.findSocketIdentity.mockResolvedValue({
      id: 10,
      role: UserRole.CLIENT,
      isActive: false,
    });
    const socket = makeSocket();
    socket.data = { userId: 10, role: UserRole.CLIENT };

    await expect(
      reauthorizeRealtimeSocket(usersService as any, socket as any),
    ).resolves.toBeNull();
  });
});

function makeSocket() {
  return {
    handshake: { auth: { token: 'signed-token' } },
    data: {} as Record<string, unknown>,
  };
}
