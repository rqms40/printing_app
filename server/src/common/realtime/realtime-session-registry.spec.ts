import { RealtimeSessionRegistry } from './realtime-session-registry';

describe('RealtimeSessionRegistry', () => {
  it('disconnects every namespace session for only the held user', () => {
    const registry = new RealtimeSessionRegistry();
    const orders = makeSocket('orders');
    const location = makeSocket('location');
    const other = makeSocket('other');
    registry.register(10, orders as any);
    registry.register(10, location as any);
    registry.register(20, other as any);

    registry.disconnectUser(10);

    expect(orders.disconnect).toHaveBeenCalledWith(true);
    expect(location.disconnect).toHaveBeenCalledWith(true);
    expect(other.disconnect).not.toHaveBeenCalled();
  });

  it('removes disconnected sessions and leaves no stale user entry', () => {
    const registry = new RealtimeSessionRegistry();
    const socket = makeSocket('orders');
    registry.register(10, socket as any);

    socket.disconnectListener?.();
    registry.disconnectUser(10);

    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('continues disconnecting other namespaces when one socket throws', () => {
    const registry = new RealtimeSessionRegistry();
    const broken = makeSocket('broken');
    const healthy = makeSocket('healthy');
    broken.disconnect.mockImplementation(() => {
      throw new Error('broken namespace');
    });
    registry.register(10, broken as any);
    registry.register(10, healthy as any);

    expect(() => registry.disconnectUser(10)).not.toThrow();

    expect(broken.disconnect).toHaveBeenCalledWith(true);
    expect(healthy.disconnect).toHaveBeenCalledWith(true);
  });
});

function makeSocket(id: string) {
  const socket: {
    id: string;
    disconnect: jest.Mock;
    once: jest.Mock;
    disconnectListener?: () => void;
  } = {
    id,
    disconnect: jest.fn(),
    once: jest.fn((event: string, listener: () => void) => {
      if (event === 'disconnect') socket.disconnectListener = listener;
    }),
  };
  return socket;
}
