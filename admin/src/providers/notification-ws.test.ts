import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Socket.IO mock ─────────────────────────────────────────────────
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockSocket = {
  connected: false,
  on: mockOn,
  disconnect: mockDisconnect,
};
const mockIo = vi.fn(() => mockSocket);

vi.mock("socket.io-client", () => ({ io: mockIo }));

// ── localStorage mock ──────────────────────────────────────────────
vi.stubGlobal("localStorage", {
  getItem: vi.fn().mockReturnValue("test-jwt-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// ── Helper ─────────────────────────────────────────────────────────
function fireSocketEvent(event: string, data: unknown) {
  const call = mockOn.mock.calls.find(([e]) => e === event);
  if (!call) throw new Error(`No listener registered for "${event}"`);
  call[1](data);
}

// ── Tests ──────────────────────────────────────────────────────────
describe("notification-ws", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIo.mockClear();
    mockOn.mockClear();
    mockDisconnect.mockClear();
    mockSocket.connected = false;
  });

  it("connects to /ws/notifications with JWT in auth", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});

    expect(mockIo).toHaveBeenCalledOnce();
    const [url, opts] = mockIo.mock.calls[0];
    expect(url).toContain("/ws/notifications");
    expect(opts).toMatchObject({ auth: { token: "test-jwt-token" } });

    disconnectNotifications();
  });

  it("does not connect when localStorage has no token", async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});

    expect(mockIo).not.toHaveBeenCalled();
    disconnectNotifications();
  });

  it("callback fires when newNotification event is received", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    subscribeToNotifications(cb);

    const notif = { id: 1, title: "New Order", type: "order_placed" };
    fireSocketEvent("newNotification", notif);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(notif);

    disconnectNotifications();
  });

  it("unsubscribe removes callback so it no longer fires", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    const unsubscribe = subscribeToNotifications(cb);
    unsubscribe();

    fireSocketEvent("newNotification", { id: 1 });

    expect(cb).not.toHaveBeenCalled();
    disconnectNotifications();
  });

  it("disconnect calls socket.disconnect and clears listeners", async () => {
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    const cb = vi.fn();
    subscribeToNotifications(cb);
    disconnectNotifications();

    expect(mockDisconnect).toHaveBeenCalledOnce();
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not create duplicate sockets when already connected", async () => {
    mockSocket.connected = true;
    const { subscribeToNotifications, disconnectNotifications } = await import(
      "@/providers/notification-ws"
    );

    subscribeToNotifications(() => {});
    subscribeToNotifications(() => {});

    expect(mockIo).toHaveBeenCalledOnce();
    disconnectNotifications();
  });
});
